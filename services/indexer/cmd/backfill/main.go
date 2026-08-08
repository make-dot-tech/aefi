package main

import (
	"context"
	"flag"
	"log/slog"
	"os"

	"github.com/joho/godotenv"

	"github.com/make-dot-tech/aefi/services/indexer/pkg/abi"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/config"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/indexer"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/rpc"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/store"
)

func main() {
	_ = godotenv.Load()
	from := flag.Uint64("from", 0, "start block")
	to := flag.Uint64("to", 0, "end block (inclusive)")
	flag.Parse()
	if *from == 0 || *to == 0 || *to < *from {
		slog.Error("usage: backfill -from N -to M")
		os.Exit(2)
	}

	cfg := config.FromEnv()
	ctx := context.Background()

	reg, err := abi.LoadDir(cfg.ABIDir)
	if err != nil {
		slog.Error("abi", "err", err)
		os.Exit(1)
	}
	client, err := rpc.Dial(ctx, cfg.RPCURL)
	if err != nil {
		slog.Error("rpc", "err", err)
		os.Exit(1)
	}
	defer client.Close()
	pg, err := store.NewPostgres(ctx, cfg.Database)
	if err != nil {
		slog.Error("postgres", "err", err)
		os.Exit(1)
	}
	defer pg.Close()

	svc := &indexer.Service{
		ChainID:   cfg.ChainID,
		RPC:       client,
		Store:     pg,
		Registry:  reg,
		BatchSize: 50,
	}
	if err := svc.ProcessRange(ctx, *from, *to); err != nil {
		slog.Error("backfill", "err", err)
		os.Exit(1)
	}
	slog.Info("backfill complete", "from", *from, "to", *to)
}
