package decode

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"reflect"
	"strings"
	"time"

	ethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/make-dot-tech/aefi/services/indexer/pkg/abi"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/models"
)

const systemUSDC = "0xfffffffffffffffffffffffffffffffffffffffe"

// DecodeLog turns a raw allowlisted log into a typed model.
func DecodeLog(chainID int64, reg *abi.Registry, log types.Log) (any, error) {
	spec, ok := reg.Lookup(log.Address)
	if !ok {
		return nil, fmt.Errorf("address not on allowlist: %s", log.Address.Hex())
	}
	contractABI, ok := reg.ABI(log.Address)
	if !ok {
		return nil, fmt.Errorf("no abi for %s", spec.Name)
	}
	if len(log.Topics) == 0 {
		return nil, fmt.Errorf("log missing topic0")
	}

	base := makeBase(chainID, log)

	event, err := contractABI.EventByID(log.Topics[0])
	if err != nil {
		base.EventName = "Unknown"
		base.Decoded = mustJSON(map[string]any{"contract": spec.Name, "decode_error": "unknown_topic0"})
		return base, nil
	}
	base.EventName = event.Name

	fields, err := unpackLog(contractABI, event, log)
	if err != nil {
		base.Decoded = mustJSON(map[string]any{"contract": spec.Name, "event": event.Name, "decode_error": err.Error()})
		return base, nil
	}
	base.Decoded = mustJSON(fields)

	switch spec.Family {
	case "transfer":
		return asTransfer(base, fields, log.Address), nil
	case "memo":
		return asMemo(base, fields, event.Name), nil
	case "erc8004":
		return asERC8004(base, fields, event.Name, spec.Name), nil
	case "erc8183":
		return asERC8183(base, fields, event.Name), nil
	default:
		return base, nil
	}
}

func makeBase(chainID int64, log types.Log) models.BaseEvent {
	topics := make([]string, len(log.Topics))
	for i, t := range log.Topics {
		topics[i] = t.Hex()
	}
	topic0 := ""
	if len(topics) > 0 {
		topic0 = topics[0]
	}
	return models.BaseEvent{
		ID:            models.EventID(chainID, log.TxHash.Hex(), uint(log.Index)),
		ChainID:       chainID,
		BlockNumber:   log.BlockNumber,
		BlockHash:     log.BlockHash.Hex(),
		TxHash:        strings.ToLower(log.TxHash.Hex()),
		LogIndex:      uint(log.Index),
		Address:       strings.ToLower(log.Address.Hex()),
		Topic0:        topic0,
		EventName:     "Unknown",
		ObservedAt:    time.Now().UTC(),
		RawTopics:     topics,
		RawData:       "0x" + hex.EncodeToString(log.Data),
		Decoded:       json.RawMessage(`{}`),
		SchemaVersion: "0.1.0",
	}
}

func unpackLog(contractABI ethabi.ABI, event *ethabi.Event, log types.Log) (map[string]any, error) {
	out := make(map[string]any)
	if len(event.Inputs) == 0 {
		return out, nil
	}

	indexed := make(ethabi.Arguments, 0)
	nonIndexed := make(ethabi.Arguments, 0)
	for _, arg := range event.Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		} else {
			nonIndexed = append(nonIndexed, arg)
		}
	}

	if len(nonIndexed) > 0 {
		vals, err := nonIndexed.Unpack(log.Data)
		if err != nil {
			return nil, fmt.Errorf("unpack data: %w", err)
		}
		for i, arg := range nonIndexed {
			out[arg.Name] = normalizeValue(vals[i])
		}
	}

	// topics[0] is signature; topics[1..] map to indexed inputs in order
	if len(log.Topics)-1 < len(indexed) {
		return nil, fmt.Errorf("topic count %d < indexed args %d", len(log.Topics)-1, len(indexed))
	}
	for i, arg := range indexed {
		topic := log.Topics[i+1]
		switch arg.Type.T {
		case ethabi.AddressTy:
			out[arg.Name] = strings.ToLower(common.BytesToAddress(topic.Bytes()).Hex())
		case ethabi.IntTy, ethabi.UintTy:
			out[arg.Name] = new(big.Int).SetBytes(topic.Bytes()).String()
		case ethabi.BoolTy:
			out[arg.Name] = topic.Big().Cmp(big.NewInt(0)) != 0
		case ethabi.FixedBytesTy, ethabi.BytesTy, ethabi.HashTy:
			out[arg.Name] = topic.Hex()
		case ethabi.StringTy:
			// indexed string is keccak256(value); keep topic hash
			out[arg.Name] = topic.Hex()
			out[arg.Name+"_indexed_hash"] = topic.Hex()
		default:
			out[arg.Name] = topic.Hex()
		}
	}
	_ = contractABI
	return out, nil
}

func normalizeValue(v any) any {
	switch t := v.(type) {
	case common.Address:
		return strings.ToLower(t.Hex())
	case *big.Int:
		return t.String()
	case []byte:
		return "0x" + hex.EncodeToString(t)
	case [32]byte:
		return "0x" + hex.EncodeToString(t[:])
	default:
		rv := reflect.ValueOf(v)
		if rv.IsValid() && rv.Kind() == reflect.Array && rv.Type().Elem().Kind() == reflect.Uint8 {
			b := make([]byte, rv.Len())
			for i := 0; i < rv.Len(); i++ {
				b[i] = byte(rv.Index(i).Uint())
			}
			return "0x" + hex.EncodeToString(b)
		}
		return v
	}
}

func asTransfer(base models.BaseEvent, fields map[string]any, addr common.Address) models.TransferEvent {
	from, _ := fields["from"].(string)
	to, _ := fields["to"].(string)
	valStr, _ := fields["value"].(string)
	value := new(big.Int)
	if valStr != "" {
		value.SetString(valStr, 10)
	}
	role := "other"
	if strings.ToLower(addr.Hex()) == systemUSDC {
		role = "system_usdc"
	}
	return models.TransferEvent{
		Base:        base,
		From:        strings.ToLower(from),
		To:          strings.ToLower(to),
		Value:       value,
		Decimals:    18,
		EmitterRole: role,
	}
}

func asMemo(base models.BaseEvent, fields map[string]any, eventName string) any {
	if eventName == "BeforeMemo" {
		// Keep as base-only audit breadcrumb; memoIndex in decoded JSON.
		return base
	}
	sender, _ := fields["sender"].(string)
	target, _ := fields["target"].(string)
	memoID, _ := fields["memoId"].(string)
	payload, _ := fields["memo"].(string)
	callHash, _ := fields["callDataHash"].(string)
	memoIndex, _ := fields["memoIndex"].(string)
	return models.MemoEvent{
		Base:         base,
		Sender:       strings.ToLower(sender),
		Target:       strings.ToLower(target),
		MemoID:       strings.ToLower(memoID),
		Payload:      payload,
		CallDataHash: strings.ToLower(callHash),
		MemoIndex:    memoIndex,
	}
}

func asERC8004(base models.BaseEvent, fields map[string]any, eventName, contractName string) models.ERC8004Event {
	registry := "identity"
	switch {
	case strings.Contains(contractName, "reputation"):
		registry = "reputation"
	case strings.Contains(contractName, "validation"):
		registry = "validation"
	}
	agentID := ""
	if v, ok := fields["agentId"].(string); ok {
		agentID = v
	} else if eventName == "Transfer" {
		// ERC-721 Transfer uses tokenId as agent id
		if v, ok := fields["tokenId"].(string); ok {
			agentID = v
		}
	}
	return models.ERC8004Event{
		Base:      base,
		Registry:  registry,
		EventKind: eventName,
		AgentID:   agentID,
		Payload:   mustJSON(fields),
	}
}

func asERC8183(base models.BaseEvent, fields map[string]any, eventName string) models.ERC8183Event {
	jobID, _ := fields["jobId"].(string)
	return models.ERC8183Event{
		Base:      base,
		JobID:     jobID,
		EventKind: eventName,
		Payload:   mustJSON(fields),
	}
}

func mustJSON(v any) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		return json.RawMessage(`{}`)
	}
	return b
}
