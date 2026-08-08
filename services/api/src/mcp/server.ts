import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as caps from "../handlers/capabilities.js";

const tools = [
  {
    name: "verify_payment",
    description:
      "Verify whether a payment settled and what evidence links it to agents, jobs, and authority.",
    inputSchema: {
      type: "object",
      properties: {
        tx_hash: { type: "string" },
        payment_id: { type: "string" },
        transfer_ref: { type: "string" },
      },
    },
  },
  {
    name: "explain_transaction",
    description: "Explain a transaction as structured evidence-backed intelligence.",
    inputSchema: {
      type: "object",
      properties: { hash: { type: "string" } },
      required: ["hash"],
    },
  },
  {
    name: "lookup_job",
    description: "Look up an ERC-8183 job and linked payments/outcomes.",
    inputSchema: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
    },
  },
  {
    name: "get_agent_activity",
    description: "Return observed activity for an agent identity or wallet.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "check_authority",
    description:
      "Assess mandate and task authority. May return authorization_evidence_missing.",
    inputSchema: { type: "object", additionalProperties: true },
  },
  {
    name: "trace_task",
    description: "Trace a task execution (coverage gaps until adapters exist).",
    inputSchema: {
      type: "object",
      properties: { task_execution_id: { type: "string" } },
      required: ["task_execution_id"],
    },
  },
  {
    name: "search_providers",
    description:
      "Search providers by natural-language intent (semantic) and/or structured performance filters. Returns evidence-backed rankings fused with graph metrics.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural-language capability intent (semantic recall)",
        },
        capability: { type: "string" },
        minimum_verified_jobs: { type: "number" },
        minimum_completion_rate: { type: "number" },
        minimum_confidence: {
          type: "string",
          enum: ["high", "medium", "low", "unverified"],
        },
        limit: { type: "number" },
      },
    },
  },
] as const;

export function createMcpServer() {
  const server = new Server(
    { name: "aefi", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    let result: unknown;
    switch (name) {
      case "verify_payment":
        result = await caps.verifyPayment(args as { tx_hash?: string });
        break;
      case "explain_transaction":
        result = await caps.explainTransaction(String(args.hash ?? ""));
        break;
      case "lookup_job":
        result = await caps.lookupJob(String(args.job_id ?? ""));
        break;
      case "get_agent_activity":
        result = await caps.getAgentActivity(String(args.id ?? ""));
        break;
      case "check_authority":
        result = caps.checkAuthority(args);
        break;
      case "trace_task":
        result = caps.traceTask(String(args.task_execution_id ?? ""));
        break;
      case "search_providers":
        result = await caps.searchProviders(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });

  return server;
}

export async function startMcpStdio() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
