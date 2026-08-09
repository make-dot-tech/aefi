import { useEffect, useId, useRef, type ReactNode } from "react";

/** Depth of open modals — Escape / body lock only apply to the topmost. */
let modalStack = 0;
/** Overflow captured when the first modal opens; restored when the last closes. */
let savedBodyOverflow: string | null = null;

interface Props {
  title: string;
  /** Full string for title tooltip when truncated. */
  titleFull?: string;
  onClose: () => void;
  children: ReactNode;
  /** Wider panel for settlement path + panels. */
  size?: "md" | "lg";
  subtitle?: ReactNode;
  /** Stack above another modal (e.g. settlement over agent details). */
  elevated?: boolean;
}

export function Modal({
  title,
  titleFull,
  onClose,
  children,
  size = "md",
  subtitle,
  elevated = false,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (modalStack === 0) {
      savedBodyOverflow = document.body.style.overflow;
    }
    modalStack += 1;
    const depth = modalStack;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (depth !== modalStack) return;
      e.stopPropagation();
      onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      modalStack -= 1;
      window.removeEventListener("keydown", onKey);
      if (modalStack === 0) {
        document.body.style.overflow = savedBodyOverflow ?? "";
        savedBodyOverflow = null;
      }
    };
    // Mount/unmount only — onClose is read via ref so stacked modals don't
    // recapture overflow:hidden and leave the page stuck after close.
  }, []);

  return (
    <div
      className={`modal-root${elevated ? " is-elevated" : ""}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      <div
        className={`modal-panel is-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="drawer-head">
          <div className="modal-title-stack">
            <h2 id={titleId} title={titleFull ?? title}>
              {title}
            </h2>
            {subtitle ? <div className="modal-subtitle">{subtitle}</div> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="drawer-close"
            onClick={() => onCloseRef.current()}
          >
            close
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
