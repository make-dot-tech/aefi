package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/make-dot-tech/aefi/services/indexer/pkg/models"
)

// Store persists canonical events and the indexer cursor.
type Store interface {
	GetCursor(ctx context.Context, chainID int64) (models.Cursor, error)
	UpsertBatch(ctx context.Context, chainID int64, events []any, cursor models.Cursor) error
	Close()
}

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(ctx context.Context, databaseURL string) (*Postgres, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("pgx pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pg ping: %w", err)
	}
	return &Postgres{pool: pool}, nil
}

func (p *Postgres) Close() {
	p.pool.Close()
}

func (p *Postgres) GetCursor(ctx context.Context, chainID int64) (models.Cursor, error) {
	var c models.Cursor
	err := p.pool.QueryRow(ctx, `
		SELECT chain_id, last_block, last_log_index
		FROM indexer_cursor WHERE chain_id = $1
	`, chainID).Scan(&c.ChainID, &c.LastBlock, &c.LastLogIndex)
	if err == pgx.ErrNoRows {
		return models.Cursor{ChainID: chainID}, nil
	}
	if err != nil {
		return c, err
	}
	return c, nil
}

func (p *Postgres) UpsertBatch(ctx context.Context, chainID int64, events []any, cursor models.Cursor) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, ev := range events {
		if err := upsertEvent(ctx, tx, ev); err != nil {
			return err
		}
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO indexer_cursor (chain_id, last_block, last_log_index, updated_at)
		VALUES ($1,$2,$3, now())
		ON CONFLICT (chain_id) DO UPDATE SET
		  last_block = EXCLUDED.last_block,
		  last_log_index = EXCLUDED.last_log_index,
		  updated_at = now()
	`, chainID, cursor.LastBlock, cursor.LastLogIndex)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func upsertEvent(ctx context.Context, tx pgx.Tx, ev any) error {
	switch e := ev.(type) {
	case models.TransferEvent:
		if err := upsertBase(ctx, tx, e.Base); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO evt_transfer (id, from_addr, to_addr, value, decimals, emitter_role)
			VALUES ($1,$2,$3,$4,$5,$6)
			ON CONFLICT (id) DO UPDATE SET
			  from_addr = EXCLUDED.from_addr,
			  to_addr = EXCLUDED.to_addr,
			  value = EXCLUDED.value,
			  decimals = EXCLUDED.decimals,
			  emitter_role = EXCLUDED.emitter_role
		`, e.Base.ID, e.From, e.To, e.Value.String(), e.Decimals, e.EmitterRole)
		return err

	case models.MemoEvent:
		if err := upsertBase(ctx, tx, e.Base); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO evt_memo (id, sender, memo_id, payload, call_data_hash)
			VALUES ($1,$2,$3,$4,$5)
			ON CONFLICT (id) DO UPDATE SET
			  sender = EXCLUDED.sender,
			  memo_id = EXCLUDED.memo_id,
			  payload = EXCLUDED.payload,
			  call_data_hash = EXCLUDED.call_data_hash
		`, e.Base.ID, e.Sender, e.MemoID, e.Payload, e.CallDataHash)
		return err

	case models.ERC8004Event:
		if err := upsertBase(ctx, tx, e.Base); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO evt_erc8004 (id, registry, event_kind, agent_id, payload)
			VALUES ($1,$2,$3,$4,$5)
			ON CONFLICT (id) DO UPDATE SET
			  registry = EXCLUDED.registry,
			  event_kind = EXCLUDED.event_kind,
			  agent_id = EXCLUDED.agent_id,
			  payload = EXCLUDED.payload
		`, e.Base.ID, e.Registry, e.EventKind, nullIfEmpty(e.AgentID), e.Payload)
		return err

	case models.ERC8183Event:
		if err := upsertBase(ctx, tx, e.Base); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO evt_erc8183 (id, job_id, event_kind, payload)
			VALUES ($1,$2,$3,$4)
			ON CONFLICT (id) DO UPDATE SET
			  job_id = EXCLUDED.job_id,
			  event_kind = EXCLUDED.event_kind,
			  payload = EXCLUDED.payload
		`, e.Base.ID, e.JobID, e.EventKind, e.Payload)
		return err

	case models.BaseEvent:
		return upsertBase(ctx, tx, e)

	default:
		return fmt.Errorf("unsupported event type %T", ev)
	}
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func upsertBase(ctx context.Context, tx pgx.Tx, e models.BaseEvent) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO evt_base (
		  id, chain_id, block_number, block_hash, tx_hash, log_index,
		  address, topic0, event_name, observed_at, raw_topics, raw_data, decoded, schema_version
		) VALUES (
		  $1,$2,$3,$4,$5,$6,
		  $7,$8,$9,$10,$11,$12,$13,$14
		)
		ON CONFLICT (chain_id, tx_hash, log_index) DO UPDATE SET
		  id = EXCLUDED.id,
		  block_number = EXCLUDED.block_number,
		  block_hash = EXCLUDED.block_hash,
		  address = EXCLUDED.address,
		  topic0 = EXCLUDED.topic0,
		  event_name = EXCLUDED.event_name,
		  raw_topics = EXCLUDED.raw_topics,
		  raw_data = EXCLUDED.raw_data,
		  decoded = EXCLUDED.decoded,
		  schema_version = EXCLUDED.schema_version
	`, e.ID, e.ChainID, e.BlockNumber, e.BlockHash, e.TxHash, e.LogIndex,
		e.Address, e.Topic0, e.EventName, e.ObservedAt, e.RawTopics, e.RawData, e.Decoded, e.SchemaVersion)
	return err
}
