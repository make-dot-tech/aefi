import type { ReactNode } from "react";
import {
  addressExplorerUrl,
  defaultChainId,
  looksLikeAddress,
  looksLikeTxHash,
  shortHex,
  txExplorerUrl,
} from "../lib/explorer";

type Kind = "address" | "tx" | "auto";

interface Props {
  value: string | null | undefined;
  kind?: Kind;
  chainId?: string | number | null;
  /** Show shortened hex; full value remains in title + href. */
  compact?: boolean;
  className?: string;
  children?: ReactNode;
}

export function ExplorerLink({
  value,
  kind = "auto",
  chainId = defaultChainId(),
  compact = true,
  className,
  children,
}: Props) {
  if (!value) return <span className={className}>—</span>;

  const resolved: "address" | "tx" | null =
    kind === "auto"
      ? looksLikeTxHash(value)
        ? "tx"
        : looksLikeAddress(value)
          ? "address"
          : null
      : kind;

  if (!resolved) {
    return <span className={className}>{children ?? value}</span>;
  }

  const href =
    resolved === "tx"
      ? txExplorerUrl(value, chainId)
      : addressExplorerUrl(value, chainId);
  const label = children ?? (compact ? shortHex(value) : value);

  return (
    <a
      className={`explorer-link ${className ?? ""}`.trim()}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={value}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </a>
  );
}
