package decode_test

import (
	"math/big"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/make-dot-tech/aefi/services/indexer/pkg/abi"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/decode"
	"github.com/make-dot-tech/aefi/services/indexer/pkg/models"
)

func abiDir(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "abi", "5042002"))
}

func TestDecodeSystemTransfer(t *testing.T) {
	reg, err := abi.LoadDir(abiDir(t))
	if err != nil {
		t.Fatal(err)
	}

	from := common.HexToAddress("0x1111111111111111111111111111111111111111")
	to := common.HexToAddress("0x2222222222222222222222222222222222222222")
	value := big.NewInt(5_000_000_000_000_000_000) // 5 USDC @ 18 decimals

	topic0 := crypto.Keccak256Hash([]byte("Transfer(address,address,uint256)"))
	log := types.Log{
		Address: common.HexToAddress("0xfffffffffffffffffffffffffffffffffffffffe"),
		Topics: []common.Hash{
			topic0,
			common.BytesToHash(from.Bytes()),
			common.BytesToHash(to.Bytes()),
		},
		Data:        common.LeftPadBytes(value.Bytes(), 32),
		BlockNumber: 100,
		TxHash:      common.HexToHash("0xabc0000000000000000000000000000000000000000000000000000000000001"),
		Index:       3,
		BlockHash:   common.HexToHash("0xbbb0000000000000000000000000000000000000000000000000000000000001"),
	}

	ev, err := decode.DecodeLog(5042002, reg, log)
	if err != nil {
		t.Fatal(err)
	}
	tr, ok := ev.(models.TransferEvent)
	if !ok {
		t.Fatalf("got %T", ev)
	}
	if tr.EmitterRole != "system_usdc" {
		t.Fatalf("role %s", tr.EmitterRole)
	}
	if tr.Decimals != 18 {
		t.Fatalf("decimals %d", tr.Decimals)
	}
	if !strings.EqualFold(tr.From, from.Hex()) || !strings.EqualFold(tr.To, to.Hex()) {
		t.Fatalf("from/to %s %s", tr.From, tr.To)
	}
	if tr.Value.Cmp(value) != 0 {
		t.Fatalf("value %s", tr.Value)
	}
	if tr.Base.EventName != "Transfer" {
		t.Fatalf("name %s", tr.Base.EventName)
	}
}

func TestDecodeMemo(t *testing.T) {
	reg, err := abi.LoadDir(abiDir(t))
	if err != nil {
		t.Fatal(err)
	}

	sender := common.HexToAddress("0x3333333333333333333333333333333333333333")
	target := common.HexToAddress("0x3600000000000000000000000000000000000000")
	memoID := common.HexToHash("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	callHash := common.HexToHash("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
	memoBytes := []byte(`{"job_id":"42"}`)
	memoIndex := big.NewInt(7)

	topic0 := crypto.Keccak256Hash([]byte("Memo(address,address,bytes32,bytes32,bytes,uint256)"))

	// non-indexed: callDataHash, memo, memoIndex
	arguments := mustPackMemoData(t, callHash, memoBytes, memoIndex)

	log := types.Log{
		Address: common.HexToAddress("0x5294E9927c3306DcBaDb03fe70b92e01cCede505"),
		Topics: []common.Hash{
			topic0,
			common.BytesToHash(sender.Bytes()),
			common.BytesToHash(target.Bytes()),
			memoID,
		},
		Data:        arguments,
		BlockNumber: 200,
		TxHash:      common.HexToHash("0xabc0000000000000000000000000000000000000000000000000000000000002"),
		Index:       1,
		BlockHash:   common.HexToHash("0xbbb0000000000000000000000000000000000000000000000000000000000002"),
	}

	ev, err := decode.DecodeLog(5042002, reg, log)
	if err != nil {
		t.Fatal(err)
	}
	m, ok := ev.(models.MemoEvent)
	if !ok {
		t.Fatalf("got %T want MemoEvent; decoded=%v", ev, ev)
	}
	if !strings.EqualFold(m.Sender, sender.Hex()) {
		t.Fatalf("sender %s", m.Sender)
	}
	if !strings.EqualFold(m.MemoID, memoID.Hex()) {
		t.Fatalf("memoId %s", m.MemoID)
	}
	if m.MemoIndex != "7" {
		t.Fatalf("memoIndex %s", m.MemoIndex)
	}
}

func mustPackMemoData(t *testing.T, callHash common.Hash, memo []byte, idx *big.Int) []byte {
	t.Helper()
	reg, err := abi.LoadDir(abiDir(t))
	if err != nil {
		t.Fatal(err)
	}
	a, ok := reg.ABI(common.HexToAddress("0x5294E9927c3306DcBaDb03fe70b92e01cCede505"))
	if !ok {
		t.Fatal("no memo abi")
	}
	ev, ok := a.Events["Memo"]
	if !ok {
		t.Fatal("no Memo event")
	}
	nonIndexed := ev.Inputs.NonIndexed()
	b, err := nonIndexed.Pack(callHash, memo, idx)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func TestDecodeJobCreated(t *testing.T) {
	reg, err := abi.LoadDir(abiDir(t))
	if err != nil {
		t.Fatal(err)
	}

	jobID := big.NewInt(99)
	client := common.HexToAddress("0x4444444444444444444444444444444444444444")
	provider := common.HexToAddress("0x5555555555555555555555555555555555555555")
	evaluator := common.HexToAddress("0x6666666666666666666666666666666666666666")
	expiredAt := big.NewInt(1_700_000_000)
	hook := common.Address{}

	topic0 := crypto.Keccak256Hash([]byte("JobCreated(uint256,address,address,address,uint256,address)"))
	a, _ := reg.ABI(common.HexToAddress("0x0747EEf0706327138c69792bF28Cd525089e4583"))
	ev := a.Events["JobCreated"]
	data, err := ev.Inputs.NonIndexed().Pack(evaluator, expiredAt, hook)
	if err != nil {
		t.Fatal(err)
	}

	log := types.Log{
		Address: common.HexToAddress("0x0747EEf0706327138c69792bF28Cd525089e4583"),
		Topics: []common.Hash{
			topic0,
			common.BigToHash(jobID),
			common.BytesToHash(client.Bytes()),
			common.BytesToHash(provider.Bytes()),
		},
		Data:        data,
		BlockNumber: 300,
		TxHash:      common.HexToHash("0xabc0000000000000000000000000000000000000000000000000000000000003"),
		Index:       0,
		BlockHash:   common.HexToHash("0xbbb0000000000000000000000000000000000000000000000000000000000003"),
	}

	out, err := decode.DecodeLog(5042002, reg, log)
	if err != nil {
		t.Fatal(err)
	}
	j, ok := out.(models.ERC8183Event)
	if !ok {
		t.Fatalf("got %T", out)
	}
	if j.JobID != "99" || j.EventKind != "JobCreated" {
		t.Fatalf("%+v", j)
	}
}
