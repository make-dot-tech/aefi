import { useEffect, useId, useRef, type ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Wider panel for settlement path + panels. */
  size?: "md" | "lg";
  subtitle?: ReactNode;
}

export function Modal({
  title,
  onClose,
  children,
  size = "md",
  subtitle,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="modal-root"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
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
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <div className="modal-subtitle">{subtitle}</div> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="drawer-close"
            onClick={onClose}
          >
            close
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
