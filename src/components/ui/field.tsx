import { useId, type InputHTMLAttributes } from "react";

/** Labeled text input with optional hint and error. */
export function TextField({
  label,
  hint,
  error,
  className = "",
  inputClassName = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  inputClassName?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint && hintId, error && errorId].filter(Boolean).join(" ") ||
          undefined
        }
        className={`min-h-11 rounded-md border border-border bg-bg px-3 text-base text-text aria-invalid:border-danger ${inputClassName}`}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
