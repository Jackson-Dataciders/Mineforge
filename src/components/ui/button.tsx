import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:ring-2 hover:ring-accent/40",
  secondary: "border border-border bg-surface text-text hover:bg-accent/13",
  danger:
    "border border-danger bg-surface text-danger hover:ring-2 hover:ring-danger/40",
  ghost: "text-text hover:bg-accent/13",
};

/** Base button; at least 44 px tall for touch. */
export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

/** Square icon button; `label` is the accessible name and tooltip. */
export function IconButton({
  label,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text transition hover:bg-accent/13 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}
