import type { ExplainStep } from "../lib/types";

function shortAddr(v?: string): string {
  if (!v) return "—";
  if (v.length < 12) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function nodeLabel(step: ExplainStep): { title: string; detail: string } {
  switch (step.step) {
    case "settlement":
      return {
        title: "Settlement",
        detail: `${shortAddr(step.from)} → ${shortAddr(step.to)}`,
      };
    case "payment":
      return {
        title: "Payment",
        detail: step.amount ? `${step.amount} atomic` : shortAddr(step.payment_id),
      };
    case "memo":
      return {
        title: "Memo",
        detail: shortAddr(step.sender ?? step.memo_id),
      };
    case "job":
      return {
        title: "Job",
        detail: step.job_id ? `ERC-8183 #${step.job_id}` : "job",
      };
    default:
      return { title: step.step, detail: "" };
  }
}

interface Props {
  steps: ExplainStep[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function EvidencePath({ steps, selectedIndex, onSelect }: Props) {
  if (steps.length === 0) {
    return <p className="path-empty">No evidence steps for this transaction.</p>;
  }

  const width = Math.max(640, steps.length * 180);
  const y = 70;
  const gap = width / (steps.length + 1);

  return (
    <div className="path-wrap">
      <svg
        className="path-svg"
        viewBox={`0 0 ${width} 140`}
        role="img"
        aria-label="Evidence path"
      >
        <defs>
          <linearGradient id="pathStroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255, 107, 181, 0.25)" />
            <stop offset="50%" stopColor="rgba(160, 140, 255, 0.85)" />
            <stop offset="100%" stopColor="rgba(110, 200, 255, 0.75)" />
          </linearGradient>
        </defs>
        <path
          className="path-line"
          d={`M ${gap} ${y} H ${width - gap}`}
          fill="none"
          stroke="url(#pathStroke)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {steps.map((step, i) => {
          const x = gap * (i + 1);
          const { title, detail } = nodeLabel(step);
          const active = selectedIndex === i;
          return (
            <g
              key={`${step.step}-${i}`}
              className={`path-node ${active ? "is-active" : ""}`}
              style={{ animationDelay: `${0.15 + i * 0.12}s` }}
              onClick={() => onSelect(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(i);
              }}
            >
              <circle
                cx={x}
                cy={y}
                r={active ? 14 : 11}
                className="path-dot"
              />
              <text x={x} y={y - 28} className="path-title" textAnchor="middle">
                {title}
              </text>
              <text x={x} y={y + 36} className="path-detail" textAnchor="middle">
                {detail}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
