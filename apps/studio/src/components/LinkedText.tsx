import type { ReactNode } from "react";
import { ExplorerLink } from "./ExplorerLink";

/** Match tx (64) before address (40) so longer hashes win. */
const HEX_RE = /0x[a-fA-F0-9]{64}|0x[a-fA-F0-9]{40}/g;

interface Props {
  text: string;
  className?: string;
  compact?: boolean;
}

/** Render plain text with Arcscan links for embedded 0x addresses / tx hashes. */
export function LinkedText({ text, className, compact = true }: Props) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  HEX_RE.lastIndex = 0;

  while ((match = HEX_RE.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const value = match[0];
    const kind = value.length === 66 ? "tx" : "address";
    nodes.push(
      <ExplorerLink
        key={`${match.index}-${value}`}
        value={value}
        kind={kind}
        compact={compact}
        className="mono"
      />,
    );
    last = match.index + value.length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return <span className={className}>{nodes.length ? nodes : text}</span>;
}
