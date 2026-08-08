package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/make-dot-tech/aefi/services/indexer/pkg/abi"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/decode"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/models"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/rpc"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/store"
)

type Service struct {
	ChainID    int64
	StartBlock uint64
	RPC        *rpc.Client
	Store      store.Store
	Registry   *abi.Registry
	PollEvery  time.Duration
	BatchSize  uint64
}

func (s *Service) Run(ctx context.Context) error {
	if s.PollEvery == 0 {
		s.PollEvery = 2 * time.Second
	}
	if s.BatchSize == 0 {
		s.BatchSize = 20
	}

	cursor, err := s.Store.GetCursor(ctx, s.ChainID)
	if err != nil {
		return fmt.Errorf("get cursor: %w", err)
	}
	from := cursor.LastBlock
	if from == 0 && s.StartBlock > 0 {
		from = s.StartBlock
	}
	if cursor.LastBlock > 0 {
		// Resume after last fully processed block.
		from = cursor.LastBlock + 1
	}

	slog.Info("indexer starting", "chain_id", s.ChainID, "from_block", from, "addresses", len(s.Registry.Addresses()))

	ticker := time.NewTicker(s.PollEvery)
	defer ticker.Stop()

	for {
		if err := s.pollOnce(ctx, &from); err != nil {
			slog.Error("poll error", "err", err)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (s *Service) pollOnce(ctx context.Context, from *uint64) error {
	head, err := s.RPC.BlockNumber(ctx)
	if err != nil {
		return err
	}
	if *from == 0 {
		*from = head
	}
	if *from > head {
		return nil
	}
	to := *from + s.BatchSize - 1
	if to > head {
		to = head
	}

	logs, err := s.RPC.FilterLogs(ctx, *from, to, s.Registry.Addresses())
	if err != nil {
		return fmt.Errorf("filter logs %d-%d: %w", *from, to, err)
	}

	events := make([]any, 0, len(logs))
	var lastLogIndex int
	for _, lg := range logs {
		ev, err := decode.DecodeLog(s.ChainID, s.Registry, lg)
		if err != nil {
			slog.Warn("decode skip", "err", err, "tx", lg.TxHash.Hex(), "log", lg.Index)
			continue
		}
		events = append(events, ev)
		lastLogIndex = int(lg.Index)
	}

	cursor := models.Cursor{
		ChainID:      s.ChainID,
		LastBlock:    to,
		LastLogIndex: lastLogIndex,
	}
	if err := s.Store.UpsertBatch(ctx, s.ChainID, events, cursor); err != nil {
		return fmt.Errorf("upsert: %w", err)
	}
	slog.Info("indexed range", "from", *from, "to", to, "logs", len(logs), "events", len(events))
	*from = to + 1
	return nil
}

// ProcessRange backfills a closed block interval (inclusive).
func (s *Service) ProcessRange(ctx context.Context, from, to uint64) error {
	if s.BatchSize == 0 {
		s.BatchSize = 50
	}
	for cur := from; cur <= to; {
		end := cur + s.BatchSize - 1
		if end > to {
			end = to
		}
		logs, err := s.RPC.FilterLogs(ctx, cur, end, s.Registry.Addresses())
		if err != nil {
			return fmt.Errorf("filter logs %d-%d: %w", cur, end, err)
		}
		events := make([]any, 0, len(logs))
		lastLogIndex := 0
		for _, lg := range logs {
			ev, err := decode.DecodeLog(s.ChainID, s.Registry, lg)
			if err != nil {
				slog.Warn("decode skip", "err", err)
				continue
			}
			events = append(events, ev)
			lastLogIndex = int(lg.Index)
		}
		cursor := models.Cursor{ChainID: s.ChainID, LastBlock: end, LastLogIndex: lastLogIndex}
		if err := s.Store.UpsertBatch(ctx, s.ChainID, events, cursor); err != nil {
			return err
		}
		slog.Info("backfilled range", "from", cur, "to", end, "events", len(events))
		if end == to {
			break
		}
		cur = end + 1
	}
	return nil
}
