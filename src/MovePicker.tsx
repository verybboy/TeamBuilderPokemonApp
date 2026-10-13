import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  moveInfo,
  accuracyLabel,
  powerLabel,
  searchText,
  categoryLabels,
  typeLabels,
  type MoveCategory,
} from './moves';
import type { Gen } from './model';
export function CategoryBadge({
  category,
  compact = false,
}: {
  category: MoveCategory;
  compact?: boolean;
}) {
  return (
    <span
      className={`move-category category-${category.toLowerCase()}`}
      title={categoryLabels[category]}
    >
      <svg viewBox="0 0 24 24" role="img" aria-label={`Categoría ${categoryLabels[category]}`}>
        {category === 'Physical' ? (
          <path
            d="m12 1 2.5 6 6-3-3 6 6 2-6 2.5 3 6-6-3L12 23l-2.5-5.5-6 3 3-6L1 12l5.5-2-3-6 6 3Z"
            fill="currentColor"
          />
        ) : category === 'Special' ? (
          <g fill="none" stroke="currentColor" strokeWidth="1.6">
            <ellipse cx="12" cy="12" rx="10" ry="7" />
            <ellipse cx="12" cy="12" rx="6" ry="4" />
            <circle cx="12" cy="12" r="1.6" />
          </g>
        ) : (
          <g>
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 2a5 5 0 0 1 0 10 5 5 0 0 0 0 10 10 10 0 0 0 0-20" fill="currentColor" />
            <circle cx="12" cy="7" r="1.5" fill="#717880" />
            <circle cx="12" cy="17" r="1.5" fill="currentColor" />
          </g>
        )}
      </svg>
      {!compact && <span>{categoryLabels[category]}</span>}
    </span>
  );
}
export function MoveType({ type }: { type: string }) {
  return <span className={`type type-${type}`}>{typeLabels[type] || type}</span>;
}
export function MoveDetails({
  name,
  gen,
  description = false,
}: {
  name: string;
  gen: Gen;
  description?: boolean;
}) {
  const info = moveInfo(name, gen);
  if (!info) return null;
  return (
    <>
      <span className="move-facts">
        <MoveType type={info.type} />
        <CategoryBadge category={info.category} />
        <span className="move-metric">
          <small>Potencia</small>
          <b>{powerLabel(info.power, info.category)}</b>
        </span>
        <span className="move-metric">
          <small>Acierto</small>
          <b>{accuracyLabel(info.accuracy)}</b>
        </span>
        <span
          className="move-metric"
          title={`PP base: ${info.basePP ?? '—'}. ${gen === 0 ? 'PP de Champions' : 'PP máximos con 3 PP Más'}.`}
        >
          <small>PP</small>
          <b>{info.pp ?? '—'}</b>
        </span>
        {!!info.priority && (
          <span
            className={`move-priority ${info.priority > 0 ? 'positive' : 'negative'}`}
            title="Prioridad base del movimiento"
          >
            Prioridad {info.priority > 0 ? '+' : ''}
            {info.priority}
          </span>
        )}
      </span>
      {description && info.description && (
        <span className="move-description">{info.description}</span>
      )}
    </>
  );
}
export default function MovePicker({
  label,
  value,
  names,
  gen,
  onChange,
}: {
  label: string;
  value: string;
  names: string[];
  gen: Gen;
  onChange: (name: string) => void;
}) {
  const listId = useId(),
    inputId = useId(),
    ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [active, setActive] = useState(0);
  const [popupUp, setPopupUp] = useState(false),
    [popupHeight, setPopupHeight] = useState(330);
  const infos = useMemo(
    () => names.map((name) => moveInfo(name, gen)).filter((info) => !!info),
    [names, gen],
  );
  const options = [
    '',
    ...infos
      .filter((info) =>
        searchText(
          `${info.name} ${info.localizedName} ${typeLabels[info.type]} ${categoryLabels[info.category]}`,
        ).includes(searchText(query)),
      )
      .map((info) => info.name),
  ];
  if (query && !searchText('Sin movimiento').includes(searchText(query))) options.shift();
  const highlighted = Math.min(active, options.length - 1);
  const selected = moveInfo(value, gen);
  useEffect(() => {
    if (open && highlighted >= 0)
      document.getElementById(`${listId}-${highlighted}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, highlighted, query, listId]);
  useEffect(() => {
    if (!open) return;
    function place() {
      const input = ref.current?.querySelector('input')?.getBoundingClientRect();
      if (!input) return;
      const dialog = ref.current?.closest('dialog')?.getBoundingClientRect();
      const below = (dialog?.bottom || window.innerHeight) - input.bottom;
      const above = input.top - (dialog?.top || 0);
      const up = below < 370 && above > below;
      setPopupUp(up);
      setPopupHeight(Math.max(120, Math.min(330, (up ? above : below) - 38)));
    }
    place();
    window.addEventListener('resize', place);
    function outside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('resize', place);
    };
  }, [open]);
  function choose(name: string) {
    onChange(name);
    setOpen(false);
    setQuery('');
    setActive(Math.max(0, infos.findIndex((info) => info.name === name) + 1));
  }
  return (
    <div
      className="move-picker"
      ref={ref}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label htmlFor={inputId}>{label}</label>
      <div className="move-picker-input">
        <input
          id={inputId}
          role="combobox"
          aria-label={label}
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={open && highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
          value={open ? query : value}
          placeholder={open ? 'Busca por nombre, tipo o categoría…' : 'Sin movimiento'}
          onFocus={() => {
            setOpen(true);
            setQuery('');
            setActive(Math.max(0, infos.findIndex((info) => info.name === value) + 1));
          }}
          onClick={() => {
            if (!open) {
              setOpen(true);
              setQuery('');
              setActive(Math.max(0, infos.findIndex((info) => info.name === value) + 1));
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !open) return;
            if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) e.preventDefault();
            if (e.key === 'Escape') {
              e.stopPropagation();
              setOpen(false);
            }
            if (e.key === 'ArrowDown') {
              if (!open) {
                setOpen(true);
                setQuery('');
              }
              setActive((index) => Math.min(index + 1, options.length - 1));
            }
            if (e.key === 'ArrowUp') {
              if (!open) {
                setOpen(true);
                setQuery('');
              }
              setActive((index) => Math.max(0, index - 1));
            }
            if (e.key === 'Enter') {
              if (open && highlighted >= 0) choose(options[highlighted]);
              else {
                setOpen(true);
                setQuery('');
              }
            }
          }}
        />
        <ChevronDown size={16} aria-hidden="true" />
      </div>
      {selected && (
        <div className="selected-move-details">
          <span className="move-localized-name">{selected.localizedName}</span>
          <MoveDetails name={value} gen={gen} description />
        </div>
      )}
      {open && (
        <div className={`move-picker-popup ${popupUp ? 'popup-up' : ''}`}>
          <div className="move-list-heading" aria-hidden="true">
            <span>Movimiento</span>
            <span>Tipo</span>
            <span>Categ.</span>
            <span>Potencia</span>
            <span>Acierto</span>
            <span>PP</span>
            <span>Descripción</span>
          </div>
          <div
            id={listId}
            role="listbox"
            aria-label={`Opciones de ${label}`}
            className="move-list"
            style={{ maxHeight: popupHeight }}
          >
            {options.map((name, index) => {
              const info = moveInfo(name, gen);
              return (
                <div
                  id={`${listId}-${index}`}
                  role="option"
                  aria-label={name || 'Sin movimiento'}
                  aria-selected={name === value}
                  aria-description={
                    info
                      ? `${typeLabels[info.type]}, ${categoryLabels[info.category]}, potencia ${powerLabel(info.power, info.category)}, acierto ${accuracyLabel(info.accuracy)}, ${info.pp ?? '—'} PP. ${info.description}`
                      : undefined
                  }
                  key={name}
                  className={`move-option ${highlighted === index ? 'active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(name)}
                >
                  {info ? (
                    <>
                      <span className="move-option-name">
                        <strong>{info.localizedName}</strong>
                        <small>{info.name !== info.localizedName ? info.name : ''}</small>
                      </span>
                      <MoveType type={info.type} />
                      <CategoryBadge category={info.category} compact />
                      <b>{powerLabel(info.power, info.category)}</b>
                      <b>{accuracyLabel(info.accuracy)}</b>
                      <b title={`PP base: ${info.basePP ?? '—'}`}>{info.pp ?? '—'}</b>
                      <span className="move-option-description" title={info.description}>
                        {info.priority
                          ? `Prioridad ${info.priority > 0 ? '+' : ''}${info.priority}. `
                          : ''}
                        {info.description}
                      </span>
                    </>
                  ) : (
                    <span>Sin movimiento</span>
                  )}
                </div>
              );
            })}
            {!options.length && (
              <p className="move-no-results">No hay movimientos aprendibles que coincidan.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
