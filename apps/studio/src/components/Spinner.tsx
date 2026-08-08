interface Props {
  size?: "sm" | "md";
  label?: string;
}

export function Spinner({ size = "sm", label }: Props) {
  return (
    <span
      className={`spinner spinner-${size}`}
      role="status"
      aria-label={label ?? "Loading"}
    >
      <span className="spinner-ring" aria-hidden="true" />
      {label ? <span className="spinner-label">{label}</span> : null}
    </span>
  );
}
