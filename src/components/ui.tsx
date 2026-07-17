/** Small accessible UI primitives shared across the app. */

import React, { useId, useState } from 'react';

export function Panel({
  title,
  children,
  className = '',
  actions,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}): React.ReactElement {
  return (
    <section className={`glass p-3 ${className}`}>
      {(title || actions) && (
        <header className="mb-2 flex items-center justify-between">
          {title && <h2 className="panel-title">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}): React.ReactElement {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-lg bg-black/20 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={`tab ${active === t.id ? 'tab-active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Labeled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-1 text-xs text-slate-400">
        {label}
        {hint && <Tooltip text={hint} />}
      </span>
      {children}
    </label>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="mono w-14 shrink-0 text-right text-slate-300">
        {format ? format(value) : value.toFixed(2)}
      </span>
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
}): React.ReactElement {
  return (
    <div className="rounded-lg bg-black/20 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mono text-base" style={accent ? { color: accent } : undefined}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

export function Tooltip({ text }: { text: string }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label="More information"
        className="grid h-3.5 w-3.5 place-items-center rounded-full bg-white/10 text-[9px] text-slate-400 hover:bg-white/20"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-5 left-1/2 z-30 w-52 -translate-x-1/2 rounded-lg border border-white/10 bg-graphite-800 p-2 text-[11px] leading-snug text-slate-300 shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm text-slate-300"
    >
      <span
        className={`relative h-4 w-7 rounded-full transition-colors ${checked ? 'bg-specimen' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </span>
      {label}
    </button>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-white/10 p-8 text-center">
      <div className="max-w-sm space-y-2">
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        <div className="text-xs text-slate-500">{children}</div>
      </div>
    </div>
  );
}
