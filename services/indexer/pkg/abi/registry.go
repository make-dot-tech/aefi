package abi

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	ethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

type ContractSpec struct {
	Name    string   `json:"name"`
	Address string   `json:"address"`
	Family  string   `json:"family"` // transfer | memo | erc8004 | erc8183
	Events  []string `json:"events"`
	ABIFile string   `json:"abi_file"`
	Notes   string   `json:"notes"`
}

type Allowlist struct {
	ChainID       int64          `json:"chain_id"`
	Name          string         `json:"name"`
	RPCURLDefault string         `json:"rpc_url_default"`
	Priority      string         `json:"priority"`
	Contracts     []ContractSpec `json:"contracts"`
}

type Registry struct {
	Allowlist Allowlist
	byAddr    map[common.Address]ContractSpec
	abis      map[common.Address]ethabi.ABI
}

func LoadDir(dir string) (*Registry, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "allowlist.json"))
	if err != nil {
		return nil, fmt.Errorf("read allowlist: %w", err)
	}
	var al Allowlist
	if err := json.Unmarshal(raw, &al); err != nil {
		return nil, fmt.Errorf("parse allowlist: %w", err)
	}

	r := &Registry{
		Allowlist: al,
		byAddr:    make(map[common.Address]ContractSpec),
		abis:      make(map[common.Address]ethabi.ABI),
	}

	for _, c := range al.Contracts {
		if c.ABIFile == "" {
			return nil, fmt.Errorf("contract %s missing abi_file", c.Name)
		}
		path := filepath.Join(dir, c.ABIFile)
		parsed, err := loadABIFile(path)
		if err != nil {
			return nil, fmt.Errorf("abi %s (%s): %w", c.Name, c.ABIFile, err)
		}
		addr := common.HexToAddress(c.Address)
		if c.Family == "" {
			c.Family = inferFamily(c.Name)
		}
		r.byAddr[addr] = c
		r.abis[addr] = parsed
	}
	return r, nil
}

func inferFamily(name string) string {
	switch {
	case strings.Contains(name, "memo"):
		return "memo"
	case strings.Contains(name, "8004"):
		return "erc8004"
	case strings.Contains(name, "8183"):
		return "erc8183"
	case strings.Contains(name, "transfer") || strings.Contains(name, "usdc"):
		return "transfer"
	default:
		return "unknown"
	}
}

func loadABIFile(path string) (ethabi.ABI, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return ethabi.ABI{}, err
	}
	return ethabi.JSON(strings.NewReader(string(b)))
}

func (r *Registry) Addresses() []common.Address {
	out := make([]common.Address, 0, len(r.byAddr))
	for a := range r.byAddr {
		out = append(out, a)
	}
	return out
}

func (r *Registry) Lookup(addr common.Address) (ContractSpec, bool) {
	c, ok := r.byAddr[addr]
	return c, ok
}

func (r *Registry) ABI(addr common.Address) (ethabi.ABI, bool) {
	a, ok := r.abis[addr]
	return a, ok
}
