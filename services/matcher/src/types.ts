export type NodeLabel =
  | "Wallet"
  | "Agent"
  | "Job"
  | "Payment"
  | "TransferEvent"
  | "MemoEvent"
  | "Evidence"
  | "Outcome";

export type RelType =
  | "SETTLED_BY"
  | "ANNOTATED_BY"
  | "FOR_JOB"
  | "REQUESTER"
  | "PROVIDER"
  | "EVALUATOR"
  | "HAS_FEEDBACK"
  | "FROM_WALLET"
  | "TO_WALLET"
  | "CONTROLS"
  | "SUPPORTS"
  | "HAS_OUTCOME";

export interface GraphNode {
  label: NodeLabel;
  id: string;
  props?: Record<string, unknown>;
}

export interface GraphEdge {
  type: RelType;
  from: string;
  to: string;
  props?: Record<string, unknown>;
}

export interface Fact {
  code: string;
  present: boolean;
  strength?: "exact" | "strong" | "medium" | "weak";
  refs: string[];
}

export interface ProjectionBatch {
  nodes: GraphNode[];
  edges: GraphEdge[];
  facts: Fact[];
}

export interface Cursor {
  lastBlock: number;
  lastLogIndex: number;
}

export interface BaseRow {
  id: string;
  chain_id: string;
  block_number: string;
  tx_hash: string;
  log_index: number;
  address: string;
  event_name: string;
  decoded: Record<string, unknown>;
}

export interface TransferRow extends BaseRow {
  from_addr: string;
  to_addr: string;
  value: string;
  decimals: number;
  emitter_role: string;
}

export interface MemoRow extends BaseRow {
  sender: string;
  memo_id: string | null;
  payload: string | null;
  call_data_hash: string | null;
}

export interface Erc8183Row extends BaseRow {
  job_id: string;
  event_kind: string;
  payload: Record<string, unknown>;
}

export interface Erc8004Row extends BaseRow {
  registry: string;
  event_kind: string;
  agent_id: string | null;
  payload: Record<string, unknown>;
}

export function emptyBatch(): ProjectionBatch {
  return { nodes: [], edges: [], facts: [] };
}

export function mergeBatches(...batches: ProjectionBatch[]): ProjectionBatch {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const facts: Fact[] = [];
  for (const b of batches) {
    for (const n of b.nodes) nodes.set(`${n.label}:${n.id}`, n);
    for (const e of b.edges) edges.set(`${e.type}:${e.from}->${e.to}`, e);
    facts.push(...b.facts);
  }
  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    facts,
  };
}

export const ids = {
  wallet: (chainId: string | number, address: string) =>
    `wallet:${chainId}:${address.toLowerCase()}`,
  transfer: (evtId: string) => evtId.replace(/^evt:/, "xfer:"),
  memo: (evtId: string) => evtId.replace(/^evt:/, "memo:"),
  payment: (chainId: string | number, txHash: string, logIndex: number) =>
    `pay:${chainId}:${txHash.toLowerCase()}:${logIndex}`,
  job: (chainId: string | number, jobId: string) =>
    `job:erc8183:${chainId}:${jobId}`,
  agent8004: (chainId: string | number, agentId: string) =>
    `agent:erc8004:${chainId}:${agentId}`,
  agentWallet: (chainId: string | number, address: string) =>
    `agent:wallet:${chainId}:${address.toLowerCase()}`,
  evidence: (evtId: string) => evtId.replace(/^evt:/, "evidence:"),
  outcome: (chainId: string | number, jobId: string, kind: string) =>
    `outcome:erc8183:${chainId}:${jobId}:${kind}`,
};
