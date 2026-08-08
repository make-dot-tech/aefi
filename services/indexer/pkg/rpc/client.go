package rpc

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

type Client struct {
	eth *ethclient.Client
}

func Dial(ctx context.Context, url string) (*Client, error) {
	eth, err := ethclient.DialContext(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("dial rpc: %w", err)
	}
	return &Client{eth: eth}, nil
}

func (c *Client) Close() {
	c.eth.Close()
}

func (c *Client) BlockNumber(ctx context.Context) (uint64, error) {
	return c.eth.BlockNumber(ctx)
}

func (c *Client) FilterLogs(ctx context.Context, from, to uint64, addresses []common.Address) ([]types.Log, error) {
	q := ethereum.FilterQuery{
		FromBlock: new(big.Int).SetUint64(from),
		ToBlock:   new(big.Int).SetUint64(to),
		Addresses: addresses,
	}
	return c.eth.FilterLogs(ctx, q)
}
