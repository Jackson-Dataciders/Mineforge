"use client";

import { useId, useState, type ReactNode } from "react";

const INPUT =
  "min-h-11 rounded-md border border-border bg-bg px-3 text-base text-text";

/** Labeled number input; an empty field reports `NaN` (rejected on save). */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  className = "",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className={`${INPUT} w-full min-w-0`}
      />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
  disabled = false,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        disabled={disabled}
        className={`${INPUT} px-2`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 accent-accent"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  maxLength = 5000,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`${INPUT} py-2`}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** A titled group of fields on a surface card. */
export function FieldSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Responsive grid for short fields. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
  );
}

/**
 * Integer input that reports a value only when it is committed (blur or
 * Enter) and valid; anything else snaps back. For values whose every
 * intermediate keystroke would trigger an expensive or lossy change.
 */
export function CommittedIntField({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    // The value changed from outside: show it.
    setShown(value);
    setText(String(value));
  }
  const commit = () => {
    const n = Number(text);
    if (Number.isInteger(n) && n >= min && n <= max) {
      if (n !== value) onCommit(n);
    } else setText(String(value));
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={text}
        min={min}
        max={max}
        step={1}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className={`${INPUT} w-full min-w-0`}
      />
    </div>
  );
}
