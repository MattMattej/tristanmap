'use client';

import { useEffect, useId, useState } from 'react';

export function Field({ label, hint, children, inline }: { label: string; hint?: React.ReactNode; children: React.ReactNode; inline?: boolean }) {
  return (
    <label className={`field${inline ? ' field--inline' : ''}`}>
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  return (
    <input
      className="input"
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function TextArea({ value, onChange, placeholder, maxLength, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; rows?: number }) {
  return (
    <div className="textarea-wrap">
      <textarea className="input textarea" rows={rows} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      {maxLength && (
        <span className="textarea-count">
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

/** Selector de color: muestra + código hex editable. */
export function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const id = useId();
  return (
    <div className="color">
      <label className="color__swatch" style={{ background: value }} htmlFor={id} title="Elegir color">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label ?? 'Color'} />
      </label>
      <input
        className="input color__hex"
        value={text}
        spellCheck={false}
        maxLength={7}
        aria-label={label ? `${label} (hex)` : 'Código de color'}
        onChange={(e) => {
          const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
          setText(v);
          if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toLowerCase());
        }}
        onBlur={() => setText(value)}
      />
    </div>
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = (v) => String(v),
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as string]: `${((value - min) / (max - min)) * 100}%` }}
      />
      <output className="slider__value">{format(value)}</output>
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
      <span className="toggle__text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; title?: string }[] }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} title={o.title} className={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="section">
      <header className="section__head">
        <h3 className="section__title">{title}</h3>
        {actions}
      </header>
      <div className="section__body">{children}</div>
    </section>
  );
}
