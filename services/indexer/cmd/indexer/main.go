package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
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

	startHealthServer()

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
		PollEvery:  cfg.PollEvery,
		BatchSize:  cfg.BatchSize,
	}

	slog.Info("aefi indexer",
		"rpc", cfg.RPCURL,
		"chain_id", cfg.ChainID,
		"poll_every", cfg.PollEvery.String(),
		"batch_size", cfg.BatchSize,
	)
	if err := svc.Run(ctx); err != nil && err != context.Canceled {
		slog.Error("indexer stopped", "err", err)
		os.Exit(1)
	}
}

// Cloud Run requires a listening PORT; expose a tiny health endpoint.
func startHealthServer() {
	port := os.Getenv("PORT")
	if port == "" {
		return
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "service": "indexer"})
	})
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "service": "indexer"})
	})
	go func() {
		addr := "0.0.0.0:" + port
		slog.Info("indexer health listening", "addr", addr)
		if err := http.ListenAndServe(addr, mux); err != nil {
			slog.Error("health server", "err", err)
		}
	}()
}
