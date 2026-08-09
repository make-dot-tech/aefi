package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
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
		s.PollEvery = 5 * time.Second
	}
	if s.BatchSize == 0 {
		s.BatchSize = 10
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

	slog.Info("indexer starting",
		"chain_id", s.ChainID,
		"from_block", from,
		"addresses", len(s.Registry.Addresses()),
		"poll_every", s.PollEvery.String(),
		"batch_size", s.BatchSize,
	)

	backoff := s.PollEvery
	const maxBackoff = 60 * time.Second

	for {
		err := s.pollOnce(ctx, &from)
		sleep := s.PollEvery
		if err != nil {
			if isRateLimited(err) {
				if backoff < s.PollEvery {
					backoff = s.PollEvery
				}
				backoff *= 2
				if backoff > maxBackoff {
					backoff = maxBackoff
				}
				sleep = backoff
				slog.Warn("rpc rate limited; backing off", "err", err, "sleep", sleep.String())
			} else {
				slog.Error("poll error", "err", err)
				sleep = s.PollEvery
				if sleep < 5*time.Second {
					sleep = 5 * time.Second
				}
			}
		} else {
			backoff = s.PollEvery
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(sleep):
		}
	}
}

func isRateLimited(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "429") ||
		strings.Contains(msg, "rate limit") ||
		strings.Contains(msg, "too many requests")
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
