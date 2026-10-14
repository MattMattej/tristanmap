'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/Icon';

/** Zona para soltar o elegir una imagen. */
export function ImageDrop({
  onFile,
  accept = 'image/*',
  busy,
  children,
  className = '',
  label = 'Soltá una imagen o hacé clic para elegirla',
}: {
  onFile: (file: File) => void;
  accept?: string;
  busy?: boolean;
  children?: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop${over ? ' is-over' : ''}${busy ? ' is-busy' : ''} ${className}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <button type="button" className="drop__button" onClick={() => input.current?.click()} disabled={busy}>
        {children ?? (
          <span className="drop__empty">
            {busy ? <span className="spinner" /> : <Icon name="upload" size={22} />}
            <span>{busy ? 'Optimizando y subiendo…' : label}</span>
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
