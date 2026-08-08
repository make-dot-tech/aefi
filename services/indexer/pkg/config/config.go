package config

import (
	"os"
	"strconv"
)

type Config struct {
	RPCURL    string
	ChainID   int64
	Database  string
	ABIDir    string
	StartBlock uint64
}

func FromEnv() Config {
	chainID := int64(5042002)
	if v := os.Getenv("ARC_CHAIN_ID"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			chainID = n
		}
	}
	start := uint64(0)
	if v := os.Getenv("INDEXER_START_BLOCK"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			start = n
		}
	}
	rpc := os.Getenv("ARC_RPC_URL")
	if rpc == "" {
		rpc = "https://rpc.testnet.arc.io"
	}
	db := os.Getenv("DATABASE_URL")
	if db == "" {
		db = "postgres://aefi:aefi@localhost:5432/aefi?sslmode=disable"
	}
	abiDir := os.Getenv("INDEXER_ABI_DIR")
	if abiDir == "" {
		abiDir = "abi/5042002"
	}
	return Config{
		RPCURL:     rpc,
		ChainID:    chainID,
		Database:   db,
		ABIDir:     abiDir,
		StartBlock: start,
	}
}
