import type { X402Config } from "./config.js";
import { X402_PRICE_AMOUNT, X402_PRICE_CURRENCY } from "./config.js";

/** MPP challenge so agents that speak WWW-Authenticate: Payment can negotiate. */
export function paymentWwwAuthenticate(cfg: X402Config): string {
  const realm = cfg.resourceBaseUrl.replace(/\/$/, "");
  return `Payment realm="${realm}", currency="${X402_PRICE_CURRENCY}", amount="${X402_PRICE_AMOUNT}"`;
}
