'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { byOrder, formatBytes, kindLabel, swatchClass } from '@/lib/format';
import { compressPhoto } from '@/lib/image';
import type { MapFeature } from '@/lib/schemas';
import { api } from './api';
import { ColorInput, Field, Slider, TextArea, TextInput, Toggle } from './controls';
import { ImageDrop } from './ImageDrop';
import type { EditorData } from './useEditorData';

interface Props {
  feature: MapFeature;
  ed: EditorData;
  onClose: () => void;
  onFocus: () => void;
  onDelete: () => void;
  onToast: (msg: string, kind?: 'ok' | 'error') => void;
  onGoTo: (tab: 'categories' | 'legend') => void;
}

export function Inspector({ feature: f, ed, onClose, onFocus, onDelete, onToast, onGoTo }: Props) {
  const { categories, legend } = ed.data;
  const [uploading, setUploading] = useState(false);
  const update = (patch: Partial<MapFeature>, delay?: number) => ed.updateFeature(f.id, patch, { delay });
  const setStyle = (patch: Partial<MapFeature['style']>) => ed.updateFeature(f.id, (x) => ({ ...x, style: { ...x.style, ...patch } }));

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const { full, thumb } = await compressPhoto(file);
      const [a, b] = await Promise.all([api.upload(full.blob, 'photo'), api.upload(thumb.blob, 'thumb')]);
      update({ photo: { url: a.url, thumbUrl: b.url, width: full.width, height: full.height, bytes: a.bytes } }, 0);
      onToast(`Foto optimizada: ${formatBytes(file.size)} → ${formatBytes(a.bytes)}`);
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  }

  const legendKind = f.kind === 'area' ? 'area' : 'line';
  const legendOptions = legend.filter((l) => l.kind === legendKind).sort(byOrder);
  const isShape = f.kind === 'line' || f.kind === 'area';

  return (
    <div className="inspector">
      <header className="inspector__head">
        <div>
          <span className="eyebrow">{kindLabel(f.kind)}</span>
          <h2 className="inspector__title">{f.title || (f.kind === 'label' ? 'Texto' : 'Sin título')}</h2>
        </div>
        <div className="inspector__head-actions">
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onFocus} title="Centrar en el mapa">
            <Icon name="target" size={16} />
          </button>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose} title="Cerrar (Esc)">
            <Icon name="close" size={16} />
          </button>
        </div>
      </header>

      <div className="inspector__body">
        {f.kind === 'label' ? (
          <>
            <Field label="Texto">
              <TextInput value={f.title} onChange={(title) => update({ title })} maxLength={120} placeholder="Ej.: ZONA DE LIBROS" autoFocus />
            </Field>
            <Field label="Tamaño">
              <Slider value={f.style.textSize ?? 14} min={8} max={48} onChange={(textSize) => setStyle({ textSize })} format={(v) => `${v} px`} />
            </Field>
            <Field label="Rotación">
              <Slider value={f.style.rotation ?? 0} min={-180} max={180} onChange={(rotation) => setStyle({ rotation })} format={(v) => `${v}°`} />
            </Field>
            <div className="grid-2">
              <Field label="Color">
                <ColorInput value={f.style.textColor ?? '#1f2a2e'} onChange={(textColor) => setStyle({ textColor })} />
              </Field>
              <Field label="Contorno">
                <ColorInput value={f.style.haloColor ?? '#ffffff'} onChange={(haloColor) => setStyle({ haloColor })} />
              </Field>
            </div>
            <p className="tip">Arrastrá el punto naranja en el mapa para moverlo.</p>
          </>
        ) : (
          <>
            <Field label="Título">
              <TextInput
                value={f.title}
                onChange={(title) => update({ title })}
                maxLength={120}
                placeholder={f.kind === 'point' ? 'Ej.: Libros de Don Pepe' : 'Opcional'}
                autoFocus={f.kind === 'point'}
              />
            </Field>

            {f.kind === 'point' && (
              <Field label="Ícono">
                <div className="icon-grid">
                  {[...categories].sort(byOrder).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`icon-grid__item${f.categoryId === c.id ? ' is-active' : ''}`}
                      style={{ ['--chip-color' as string]: c.color }}
                      onClick={() => update({ categoryId: c.id }, 0)}
                      title={c.name}
                    >
                      <img src={c.icon || '/icons/punto.svg'} alt="" />
                      <span>{c.name}</span>
                    </button>
                  ))}
                  <button type="button" className="icon-grid__item icon-grid__item--add" onClick={() => onGoTo('categories')} title="Crear o subir íconos">
                    <Icon name="plus" size={18} />
                    <span>Nuevo</span>
                  </button>
                </div>
              </Field>
            )}

            {isShape && (
              <Field label={f.kind === 'line' ? 'Significado (leyenda)' : 'Tipo de zona (leyenda)'}>
                <div className="legend-pick">
                  {legendOptions.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={`legend-pick__item${f.legendId === l.id ? ' is-active' : ''}`}
                      onClick={() => update({ legendId: l.id }, 0)}
                    >
                      <span className={swatchClass(l)} style={{ ['--swatch' as string]: l.color }} />
                      {l.name}
                    </button>
                  ))}
                  <button type="button" className="legend-pick__item legend-pick__item--add" onClick={() => onGoTo('legend')}>
                    <Icon name="plus" size={14} /> Nuevo color / significado
                  </button>
                </div>
                {!f.legendId && <span className="field__hint field__hint--warn">Sin leyenda no se muestra en el mapa público.</span>}
              </Field>
            )}

            {f.kind === 'line' && (
              <Field label="Desplazar hacia una vereda" hint="Útil para pintar solo un lado de la calle.">
                <Slider value={f.style.offset ?? 0} min={-20} max={20} onChange={(offset) => setStyle({ offset })} format={(v) => (v === 0 ? 'centro' : `${v > 0 ? 'der.' : 'izq.'} ${Math.abs(v)}`)} />
              </Field>
            )}

            <Field label="Descripción">
              <TextArea value={f.description} onChange={(description) => update({ description })} maxLength={4000} rows={5} placeholder="Qué hay acá, qué conviene saber, piques…" />
            </Field>

            <Field label="Foto" hint="Se comprime sola a WebP liviano antes de subir.">
              {f.photo ? (
                <div className="photo">
                  <img src={f.photo.thumbUrl} alt="" />
                  <div className="photo__meta">
                    <span>
                      {f.photo.width}×{f.photo.height} · {formatBytes(f.photo.bytes)}
                    </span>
                    <div className="photo__actions">
                      <ImageDrop onFile={uploadPhoto} busy={uploading} className="drop--inline">
                        <span className="btn btn--sm">{uploading ? <span className="spinner" /> : 'Reemplazar'}</span>
                      </ImageDrop>
                      <button type="button" className="btn btn--sm btn--danger" onClick={() => update({ photo: null }, 0)}>
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <ImageDrop onFile={uploadPhoto} busy={uploading} />
              )}
            </Field>
          </>
        )}

        <div className="inspector__divider" />
        <Toggle checked={f.published} onChange={(published) => update({ published }, 0)} label="Publicado" hint={f.published ? 'Visible en el mapa público' : 'Borrador: solo lo ves vos'} />
      </div>

      <footer className="inspector__foot">
        <span className="inspector__coords" title="Actualizado">
          {new Date(f.updatedAt).toLocaleString('es-UY', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
        <button className="btn btn--sm btn--danger" onClick={onDelete}>
          <Icon name="trash" size={15} /> Eliminar
        </button>
      </footer>
    </div>
  );
}
