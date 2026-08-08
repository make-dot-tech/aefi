package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"

	"github.com/make-dot-tech/aefi/services/indexer/pkg/abi"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/config"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/indexer"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/rpc"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/store"
)

func main() {
	_ = godotenv.Load()
	cfg := config.FromEnv()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	reg, err := abi.LoadDir(cfg.ABIDir)
	if err != nil {
		slog.Error("load abi registry", "err", err)
		os.Exit(1)
	}

	client, err := rpc.Dial(ctx, cfg.RPCURL)
	if err != nil {
		slog.Error("rpc dial", "err", err)
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
		ChainID:    cfg.ChainID,
		StartBlock: cfg.StartBlock,
		RPC:        client,
		Store:      pg,
		Registry:   reg,
	}

	slog.Info("aefi indexer", "rpc", cfg.RPCURL, "chain_id", cfg.ChainID)
	if err := svc.Run(ctx); err != nil && err != context.Canceled {
		slog.Error("indexer stopped", "err", err)
		os.Exit(1)
	}
}
