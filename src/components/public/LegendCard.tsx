'use client';

import { Icon } from '@/components/Icon';
import { swatchClass } from '@/lib/format';
import type { Category, LegendItem } from '@/lib/schemas';

interface Props {
  open: boolean;
  onToggle: () => void;
  legend: LegendItem[];
  categories: Category[];
  hiddenLegend: Set<string>;
  hiddenCats: Set<string>;
  onToggleLegend: (id: string) => void;
  onToggleCat: (id: string) => void;
}

/** Referencias: qué significa cada color e ícono. Tocar un ítem lo oculta. */
export function LegendCard({ open, onToggle, legend, categories, hiddenLegend, hiddenCats, onToggleLegend, onToggleCat }: Props) {
  if (!legend.length && !categories.length) return null;
  return (
    <div className={`legend${open ? ' is-open' : ''}`}>
      <button className="btn legend__toggle" onClick={onToggle} aria-expanded={open} aria-controls="legend-body">
        <Icon name="layers" size={18} /> Referencias
      </button>
      {open && (
        <div id="legend-body" className="legend__body">
          {legend.length > 0 && (
            <>
              <h3 className="legend__heading">Sectores y recorridos</h3>
              <ul className="legend__list">
                {legend.map((l) => {
                  const off = hiddenLegend.has(l.id);
                  return (
                    <li key={l.id}>
                      <button className={`legend__item${off ? ' is-off' : ''}`} onClick={() => onToggleLegend(l.id)} aria-pressed={!off}>
                        <span className={swatchClass(l)} style={{ ['--swatch' as string]: l.color }} />
                        <span className="legend__text">
                          <strong>{l.name}</strong>
                          {l.description && <span>{l.description}</span>}
                        </span>
                        <Icon name={off ? 'eyeOff' : 'eye'} size={16} className="legend__eye" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {categories.length > 0 && (
            <>
              <h3 className="legend__heading">Puntos</h3>
              <ul className="legend__list">
                {categories.map((c) => {
                  const off = hiddenCats.has(c.id);
                  return (
                    <li key={c.id}>
                      <button className={`legend__item${off ? ' is-off' : ''}`} onClick={() => onToggleCat(c.id)} aria-pressed={!off}>
                        <span className="chip-icon" style={{ ['--chip-color' as string]: c.color }}>
                          <img src={c.icon || '/icons/punto.svg'} alt="" />
                        </span>
                        <span className="legend__text">
                          <strong>{c.name}</strong>
                          {c.description && <span>{c.description}</span>}
                        </span>
                        <Icon name={off ? 'eyeOff' : 'eye'} size={16} className="legend__eye" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
