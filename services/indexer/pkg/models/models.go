package models

import (
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"time"
)

// EventID builds evt:{chain_id}:{tx_hash}:{log_index}
func EventID(chainID int64, txHash string, logIndex uint) string {
	return fmt.Sprintf("evt:%d:%s:%d", chainID, strings.ToLower(txHash), logIndex)
}

func JobID(chainID int64, jobID string) string {
	return fmt.Sprintf("job:erc8183:%d:%s", chainID, jobID)
}

type BaseEvent struct {
	ID            string
	ChainID       int64
	BlockNumber   uint64
	BlockHash     string
	TxHash        string
	LogIndex      uint
	Address       string
	Topic0        string
	EventName     string
	ObservedAt    time.Time
	RawTopics     []string
	RawData       string
	Decoded       json.RawMessage
	SchemaVersion string
}

type TransferEvent struct {
	Base        BaseEvent
	From        string
	To          string
	Value       *big.Int
	Decimals    int
	EmitterRole string
}

type MemoEvent struct {
	Base         BaseEvent
	Sender       string
	Target       string
	MemoID       string
	Payload      string // hex-encoded memo bytes
	CallDataHash string
	MemoIndex    string
}

type ERC8004Event struct {
	Base      BaseEvent
	Registry  string // identity | reputation | validation
	EventKind string
	AgentID   string
	Payload   json.RawMessage
}

type ERC8183Event struct {
	Base      BaseEvent
	JobID     string // numeric job id string
	EventKind string
	Payload   json.RawMessage
}

type Cursor struct {
	ChainID      int64
	LastBlock    uint64
	LastLogIndex int
}
