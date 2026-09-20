import type { Context, MiddlewareHandler, Next } from "hono";
import {
  createGatewayMiddleware,
  type PaymentRequest,
  type PaymentResponse,
} from "@circle-fin/x402-batching/server";
import type { X402Config } from "./config.js";
import { FREE_V1_PATHS, gatewayRequirePrice } from "./config.js";
import { paymentWwwAuthenticate } from "./mpp.js";
import { unb64json } from "./codec.js";

type GatewayMiddlewareFn = (
  req: PaymentRequest,
  res: PaymentResponse,
  next: (err?: unknown) => void,
) => void | Promise<void>;

interface CaptureResponse {
  statusCode: number;
  headers: Headers;
  body: string;
  ended: boolean;
  setHeader: (name: string, value: string | number) => void;
  getHeader: (name: string) => string | number | string[] | undefined;
  end: (chunk?: string | Buffer) => void;
  json: (data: unknown) => void;
  status: (code: number) => CaptureResponse;
}

function nodeHeaders(c: Context): Record<string, string> {
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

function toPaymentRequest(c: Context): PaymentRequest {
  const headers = nodeHeaders(c);
  const url = new URL(c.req.url);
  return {
    headers,
    url: `${url.pathname}${url.search}`,
    method: c.req.method,
  } as PaymentRequest;
}

function captureResponse(): CaptureResponse {
  const headers = new Headers();
  const cap: CaptureResponse = {
    statusCode: 200,
    headers,
    body: "",
    ended: false,
    setHeader(name, value) {
      headers.set(String(name), String(value));
    },
    getHeader(name) {
      return headers.get(String(name)) ?? undefined;
    },
    end(chunk) {
      cap.ended = true;
      if (chunk !== undefined) {
        cap.body += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      }
    },
    json(data) {
      headers.set("Content-Type", "application/json");
      cap.ended = true;
      cap.body = JSON.stringify(data);
    },
    status(code) {
      cap.statusCode = code;
      return cap;
    },
  };
  return cap;
}

function copyCapturedHeaders(c: Context, headers: Headers): void {
  headers.forEach((value, key) => {
    if (key.toLowerCase() === "content-type") return;
    c.header(key, value);
  });
}

function parseJsonBody(raw: string): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { error: raw };
  }
}

function paymentRequiredFromHeader(header: string | undefined): Record<string, unknown> | null {
  if (!header) return null;
  try {
    const decoded = unb64json<Record<string, unknown>>(header);
    return decoded && typeof decoded === "object" ? decoded : null;
  } catch {
    return null;
  }
}

async function runGateway(
  mw: GatewayMiddlewareFn,
  c: Context,
  next: Next,
  cfg: X402Config,
): Promise<Response | void> {
  const req = toPaymentRequest(c);
  const cap = captureResponse();
  const apiKey = cfg.apiKey;
  const presented = nodeHeaders(c)["x-aefi-api-key"];
  const apiKeyBypass = Boolean(apiKey && presented && presented === apiKey);

  let downstream: Promise<void> | undefined;
  const wrappedNext = (err?: unknown) => {
    if (err) {
      downstream = Promise.reject(err);
      return downstream;
    }
    if (!downstream) {
      copyCapturedHeaders(c, cap.headers);
      if (req.payment) {
        c.header("x-aefi-auth", "x402");
      } else if (apiKeyBypass) {
        c.header("x-aefi-auth", "api-key");
      }
      downstream = Promise.resolve(next());
    }
    return downstream;
  };

  await mw(req, cap as unknown as PaymentResponse, wrappedNext);
  if (downstream && !cap.ended) {
    await downstream;
  }

  if (!cap.ended) return;

  copyCapturedHeaders(c, cap.headers);
  c.header("WWW-Authenticate", paymentWwwAuthenticate(cfg));

  const status = cap.statusCode as 400 | 402 | 403 | 500 | 503;
  let body = parseJsonBody(cap.body);
  if (status === 402) {
    const fromHeader = paymentRequiredFromHeader(cap.headers.get("PAYMENT-REQUIRED") ?? undefined);
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    if (fromHeader && !Array.isArray(record.accepts)) {
      body = fromHeader;
    }
  }
  return c.json(body as Record<string, unknown>, status);
}

/**
 * Circle Gateway x402 middleware (`createGatewayMiddleware` + `gateway.require`)
 * adapted to Hono. Unpaid calls get HTTP 402 with `accepts[]` + PAYMENT-REQUIRED
 * and an MPP `WWW-Authenticate: Payment` challenge.
 */
export function createGatewayHonoMiddleware(cfg: X402Config): MiddlewareHandler {
  const gateway = createGatewayMiddleware({
    sellerAddress: cfg.payTo,
    facilitatorUrl: cfg.facilitatorUrl ?? undefined,
    description: "aefi evidence API",
    ...(cfg.networks.length > 0 ? { networks: cfg.networks } : {}),
  });

  gateway.onProtectedRequest(async (ctx) => {
    if (!cfg.apiKey) return;
    const key = ctx.getHeader("x-aefi-api-key");
    if (key && key === cfg.apiKey) {
      return { grantAccess: true };
    }
  });

  const requirePayment = gateway.require(gatewayRequirePrice(cfg));

  return async (c, next) => {
    if (c.req.method === "OPTIONS" || FREE_V1_PATHS.has(c.req.path)) {
      await next();
      return;
    }
    return runGateway(requirePayment, c, next, cfg);
  };
}
