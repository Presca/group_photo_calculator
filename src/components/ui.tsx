"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/* Shared UI primitives: large, touch-friendly, readable outdoors. */

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm",
  secondary:
    "bg-white text-slate-900 border-2 border-slate-300 hover:border-slate-400 active:bg-slate-100",
  danger:
    "bg-white text-red-700 border-2 border-red-300 hover:border-red-400 active:bg-red-50",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-200",
};

export function BigButton({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`min-h-14 rounded-2xl px-6 text-lg font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}

export function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl bg-white p-5 shadow-sm border border-slate-200 ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </span>
  );
}

export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const decimals = step < 1 ? 2 : 0;
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          className="min-h-14 w-14 rounded-2xl border-2 border-slate-300 bg-white text-2xl font-bold text-slate-700 active:bg-slate-100"
          onClick={() => onChange(clamp(Number((value - step).toFixed(decimals))))}
        >
          −
        </button>
        <div className="relative flex-1">
          <input
            type="number"
            inputMode="decimal"
            className="min-h-14 w-full min-w-0 rounded-2xl border-2 border-slate-300 bg-white px-2 text-center text-xl font-bold focus:border-blue-500 focus:outline-none"
            value={Number.isFinite(value) ? value : 0}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (Number.isFinite(parsed)) onChange(clamp(parsed));
            }}
          />
          {suffix && (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
              {suffix}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          className="min-h-14 w-14 rounded-2xl border-2 border-slate-300 bg-white text-2xl font-bold text-slate-700 active:bg-slate-100"
          onClick={() => onChange(clamp(Number((value + step).toFixed(decimals))))}
        >
          +
        </button>
      </div>
    </label>
  );
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            className={`min-h-14 rounded-2xl border-2 px-3 text-base font-semibold transition-colors ${
              value === opt.value
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 bg-white text-slate-700 active:bg-slate-100"
            }`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-800",
    good: "bg-emerald-100 text-emerald-900",
    warn: "bg-amber-100 text-amber-900",
    bad: "bg-red-100 text-red-900",
  };
  return (
    <div className={`rounded-2xl px-4 py-3 ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-lg text-slate-600">{detail}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
