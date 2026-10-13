import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  X,
  Search,
  LoaderCircle,
  Sparkles,
  Save,
  Clipboard,
  Download,
  ArrowUp,
  ArrowDown,
  FolderHeart,
  Package,
} from 'lucide-react';
import {
  calcPokemon,
  createMember,
  stats,
  statLabels,
  validateMember,
  apiGeneration,
  mechanicsLabel,
  trainingLimits,
  natureLabel,
  natureEffect,
  type Stat,
  type Member,
  type Gen,
  type Team,
} from './model';
import { loadPokemon, loadItemSprite, names } from './api';
import { exportShowdown, importShowdown } from './showdown';
import { downloadText } from './library';
import MovePicker from './MovePicker';
import { typeLabels } from './moves';
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Ha ocurrido un error. Inténtalo de nuevo.';
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!,
      previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    d.showModal();
    return () => {
      d.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal wide' : 'modal'}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="dialog-inner">
        <header className="modal-header">
          <div>
            <p className="eyebrow">POKÉMON TEAM LAB</p>
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="Cerrar ventana" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
function ItemSprite({ item }: { item: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void loadItemSprite(item).then(
      (url) => {
        if (active) setSrc(url);
      },
      () => {
        if (active) setSrc(null);
      },
    );
    return () => {
      active = false;
    };
  }, [item]);
  return (
    <span className="equipped-item" title={`Objeto equipado: ${item}`}>
      {src ? (
        <img
          src={src}
          alt={`Objeto equipado: ${item}`}
          width={30}
          height={30}
          loading="lazy"
          onError={() => setSrc(null)}
        />
      ) : (
        <Package
          size={18}
          role="img"
          aria-label={`Objeto equipado: ${item} (imagen no disponible)`}
        />
      )}
    </span>
  );
}
export function Sprite({
  member,
  large = false,
  showItem = true,
}: {
  member: Member;
  large?: boolean;
  showItem?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const src = member.shiny ? member.data.shinySprite : member.data.sprite;
  useEffect(() => setBroken(false), [src]);
  return (
    <div className={`sprite ${large ? 'large' : ''}`}>
      {broken || !src ? (
        <span className="sprite-fallback">?</span>
      ) : (
        <img
          src={src}
          alt={member.data.name + (member.shiny ? ' variocolor' : '')}
          onError={() => setBroken(true)}
          loading="lazy"
        />
      )}
      {member.shiny && <Sparkles size={16} className="shiny-star" aria-label="Variocolor" />}
      {showItem && member.item && <ItemSprite key={member.item} item={member.item} />}
    </div>
  );
}
export function Types({ types }: { types: string[] }) {
  return (
    <span className="types">
      {types.map((t) => (
        <span key={t} className={`type type-${t}`}>
          {typeLabels[t] || t}
        </span>
      ))}
    </span>
  );
}
export function NatureIndicator({ nature, stat, gen }: { nature: string; stat: Stat; gen: Gen }) {
  if (apiGeneration(gen) < 3) return null;
  const effect = natureEffect(nature);
  if (effect.plus === stat)
    return (
      <ArrowUp
        className="nature-up"
        size={15}
        role="img"
        aria-label={`Sube ${statLabels[stat]} por naturaleza`}
      />
    );
  if (effect.minus === stat)
    return (
      <ArrowDown
        className="nature-down"
        size={15}
        role="img"
        aria-label={`Baja ${statLabels[stat]} por naturaleza`}
      />
    );
  return null;
}
export function Editor({
  member,
  gen,
  onSave,
  onClose,
  onSaveConfiguration,
}: {
  member: Member | null;
  gen: Gen;
  onSave: (m: Member) => void;
  onClose: () => void;
  onSaveConfiguration?: (m: Member, name: string) => void;
}) {
  const [draft, setDraft] = useState<Member | null>(member ? structuredClone(member) : null),
    [query, setQuery] = useState(member?.data.name || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [configurationName, setConfigurationName] = useState(''),
    [configurationSaved, setConfigurationSaved] = useState(false);
  const era = apiGeneration(gen),
    limits = trainingLimits(gen);
  const unrestricted = useMemo(
    () => (gen === 10 ? { abilities: names(gen, 'abilities'), moves: names(gen, 'moves') } : null),
    [gen],
  );
  const pokemonNames = names(gen, 'species'),
    items = names(gen, 'items'),
    natures = names(gen, 'natures'),
    abilities = unrestricted?.abilities ?? draft?.data.abilities ?? [],
    availableMoves = unrestricted?.moves ?? draft?.data.moves ?? [];
  const update = <K extends keyof Member>(key: K, value: Member[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : null));
  async function search() {
    setBusy(true);
    setError('');
    try {
      const data = await loadPokemon(query, gen);
      setDraft(createMember(data));
      setQuery(data.name);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  let calculated: ReturnType<typeof calcPokemon> | null = null;
  try {
    if (draft) calculated = calcPokemon(draft, gen);
  } catch {}
  function save() {
    if (!draft) return;
    try {
      validateMember(draft, gen);
      onSave(draft);
    } catch (e) {
      setError(errorText(e));
    }
  }
  function saveConfiguration() {
    if (!draft || !onSaveConfiguration) return;
    setError('');
    try {
      validateMember(draft, gen);
      onSaveConfiguration(draft, configurationName);
      setConfigurationSaved(true);
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <Modal
      title={member ? 'Editar Pokémon' : 'Añadir Pokémon'}
      subtitle={`${mechanicsLabel(gen)} · Personaliza cada detalle de tu estrategia`}
      onClose={onClose}
      wide
    >
      <form
        className="species-search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <Search size={19} />
        <input
          aria-label="Especie Pokémon"
          list="species-list"
          placeholder="Busca una especie: Torkoal, Garchomp…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <datalist id="species-list">
          {pokemonNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <button className="button secondary" disabled={busy || !query}>
          {busy ? <LoaderCircle className="spin" size={16} /> : null}
          {busy ? 'Buscando…' : 'Cargar especie'}
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {draft && calculated ? (
        <>
          <div className="editor-layout">
            <div className="editor-identity">
              <Sprite member={draft} large />
              <p className="dex-number">#{String(draft.data.number).padStart(3, '0')}</p>
              <h3>{draft.data.name}</h3>
              <Types types={calculated.types.map((t) => t.toLowerCase())} />
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={draft.shiny}
                  onChange={(e) => update('shiny', e.target.checked)}
                />
                <Sparkles size={15} /> Variocolor
              </label>
              <label>
                Mote
                <input
                  value={draft.nickname}
                  maxLength={40}
                  placeholder={draft.data.name}
                  onChange={(e) => update('nickname', e.target.value)}
                />
              </label>
            </div>
            <div className="editor-fields">
              <div className="form-grid">
                <label>
                  Nivel
                  <input
                    type="number"
                    min="1"
                    max="100"
                    disabled={gen === 0}
                    value={draft.level}
                    onChange={(e) => update('level', Number(e.target.value))}
                  />
                </label>
                <label>
                  Sexo
                  <select
                    value={draft.gender}
                    onChange={(e) => update('gender', e.target.value as Member['gender'])}
                  >
                    {draft.data.genders.map((g) => (
                      <option key={g} value={g}>
                        {g === 'M' ? '♂ Macho' : g === 'F' ? '♀ Hembra' : 'Sin sexo'}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Habilidad
                  <select
                    disabled={era < 3}
                    value={draft.ability}
                    onChange={(e) => update('ability', e.target.value)}
                  >
                    {era < 3 ? (
                      <option value="">No existe en esta generación</option>
                    ) : (
                      abilities.map((a) => <option key={a}>{a}</option>)
                    )}
                  </select>
                </label>
                <label>
                  Naturaleza
                  <select
                    disabled={era < 3}
                    value={draft.nature}
                    onChange={(e) => update('nature', e.target.value)}
                  >
                    {natures.map((n) => (
                      <option key={n} value={n}>
                        {natureLabel(n)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="span-2">
                  Objeto equipado
                  <select
                    disabled={era < 2}
                    value={draft.item}
                    onChange={(e) => update('item', e.target.value)}
                  >
                    <option value="">Sin objeto</option>
                    {items.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
              <h4>
                Movimientos{' '}
                <span className="muted">
                  {gen === 10
                    ? 'Todos los movimientos · generación IX'
                    : 'Solo los que puede aprender'}
                </span>
              </h4>
              <p className="small muted move-pp-note">
                {gen === 0 ? 'PP disponibles en Champions.' : 'PP máximos con 3 PP Más.'} Acierto y
                potencia base; los efectos pueden modificarlos.
              </p>
              <div className="editor-moves">
                {draft.moves.map((move, i) => (
                  <MovePicker
                    key={`${draft.data.name}-${i}`}
                    label={`Movimiento ${i + 1}`}
                    value={move}
                    gen={gen}
                    names={availableMoves}
                    onChange={(name) => {
                      const moves = [...draft.moves];
                      moves[i] = name;
                      update('moves', moves);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="stats-header">
            <h4>Características</h4>
            <span
              className={
                stats.reduce((v, s) => v + draft.evs[s], 0) > limits.total ? 'text-error' : 'muted'
              }
            >
              {limits.label}: {stats.reduce((v, s) => v + draft.evs[s], 0)} / {limits.total}
            </span>
          </div>
          <div className="stat-table">
            <div className="stat-row heading">
              <span>Estadística</span>
              <span>Base</span>
              <span>IV</span>
              <span>{gen === 0 ? 'SP' : 'EV'}</span>
              <span>Total</span>
            </div>
            {stats.map((s) => (
              <div className="stat-row" key={s}>
                <span className="stat-name">
                  {statLabels[s]} <NatureIndicator nature={draft.nature} stat={s} gen={gen} />
                </span>
                <span>{calculated!.species.baseStats[s]}</span>
                <input
                  aria-label={`IV ${statLabels[s]}`}
                  type="number"
                  min="0"
                  max="31"
                  disabled={gen === 0}
                  value={draft.ivs[s]}
                  onChange={(e) => update('ivs', { ...draft.ivs, [s]: Number(e.target.value) })}
                />
                <input
                  aria-label={`EV ${statLabels[s]}`}
                  type="number"
                  disabled={era < 3}
                  min="0"
                  max={limits.perStat}
                  value={draft.evs[s]}
                  onChange={(e) => update('evs', { ...draft.evs, [s]: Number(e.target.value) })}
                />
                <strong>{calculated!.rawStats[s]}</strong>
              </div>
            ))}
          </div>
          {gen === 0 && (
            <p className="small muted champions-editor-note">
              Champions: nivel 50, IVs perfectos y hasta 32 SP por característica (66 en total). Los
              SP se aplican dentro del modificador de naturaleza.
            </p>
          )}
          {era < 3 && (
            <p className="small muted">
              En generaciones I–II, Smogon convierte los IVs al modelo de DVs y asume entrenamiento
              máximo. Los EVs, naturalezas y habilidades no se aplican; los DVs de PS se derivan de
              las otras características.
            </p>
          )}
          <div className="hp-editor">
            <label>
              PS actuales
              <input
                aria-label="PS actuales"
                type="number"
                min="0"
                max={calculated.maxHP()}
                value={Math.round((calculated.maxHP() * draft.hpPercent) / 100)}
                onChange={(e) =>
                  update(
                    'hpPercent',
                    Math.max(
                      0,
                      Math.min(100, (Number(e.target.value) / calculated!.maxHP()) * 100),
                    ),
                  )
                }
              />
            </label>
            <span>/ {calculated.maxHP()} PS</span>
            <label>
              Porcentaje de PS
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={Number(draft.hpPercent.toFixed(2))}
                onChange={(e) =>
                  update('hpPercent', Math.max(0, Math.min(100, Number(e.target.value))))
                }
              />
            </label>
            <span>%</span>
            <div className="hp-track">
              <i style={{ width: `${draft.hpPercent}%` }} />
            </div>
          </div>
          <p className="small muted">
            Al cambiar los IVs, EVs o nivel se conserva el porcentaje de PS.
          </p>
          <footer className="modal-footer">
            {onSaveConfiguration && (
              <div className="save-configuration">
                <label>
                  Nombre de configuración
                  <input
                    value={configurationName}
                    maxLength={80}
                    placeholder={`${draft.data.name} · ${draft.nature}`}
                    onChange={(e) => {
                      setConfigurationName(e.target.value);
                      setConfigurationSaved(false);
                    }}
                  />
                </label>
                <button className="button secondary" disabled={busy} onClick={saveConfiguration}>
                  <FolderHeart size={17} />
                  Guardar configuración
                </button>
                {configurationSaved && (
                  <p role="status" className="small">
                    Configuración guardada en tu biblioteca.
                  </p>
                )}
              </div>
            )}
            <button className="button secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="button primary" disabled={busy} onClick={save}>
              <Save size={17} />
              Guardar Pokémon
            </button>
          </footer>
        </>
      ) : (
        <div className="search-empty">
          <Search size={32} />
          <h3>Tu siguiente compañero empieza aquí</h3>
          <p>Busca y carga una especie para ver sus movimientos, habilidades y características.</p>
        </div>
      )}
    </Modal>
  );
}
export function ShowdownExport({
  text,
  filename,
  copyLabel,
}: {
  text: string;
  filename: string;
  copyLabel: string;
}) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState('');
  async function copy() {
    setError('');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError('No se pudo acceder al portapapeles. Selecciona el texto y cópialo manualmente.');
    }
  }
  return (
    <>
      <label className="transfer-label">
        Formato Pokémon Showdown
        <textarea aria-label="Texto de Showdown" className="showdown-text" readOnly value={text} />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer className="modal-footer">
        <button
          className="button secondary"
          disabled={!text}
          onClick={() => downloadText(text, filename)}
        >
          <Download size={16} />
          Descargar .txt
        </button>
        <button className="button primary" disabled={!text} onClick={() => void copy()}>
          <Clipboard size={16} />
          {copied ? 'Copiado' : copyLabel}
        </button>
      </footer>
    </>
  );
}
export function Transfer({
  mode,
  teams,
  gen,
  initialTeam,
  onImport,
  onClose,
}: {
  mode: 'import' | 'export';
  teams: Team[];
  gen: Gen;
  initialTeam: number;
  onImport: (team: number, members: Member[], replace: boolean) => void;
  onClose: () => void;
}) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [team, setTeam] = useState(initialTeam),
    [text, setText] = useState(''),
    [replace, setReplace] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const output = exportShowdown(teams[team].slots, gen);
  async function apply() {
    setBusy(true);
    setError('');
    try {
      const members = await importShowdown(text, gen);
      if (!active.current) return;
      if (!replace && members.length > teams[team].slots.filter((m) => !m).length)
        throw new Error(
          'No hay suficientes plazas libres. Activa «Reemplazar equipo» o libera plazas.',
        );
      onImport(team, members, replace);
    } catch (e) {
      if (active.current) setError(errorText(e));
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return (
    <Modal
      title={mode === 'import' ? 'Importar desde Showdown' : 'Exportar a Showdown'}
      subtitle="Tus equipos, listos para compartir."
      onClose={onClose}
    >
      <label>
        Equipo
        <select
          value={team}
          disabled={busy}
          onChange={(e) => {
            setTeam(Number(e.target.value));
          }}
        >
          {teams.map((t, i) => (
            <option key={i} value={i}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {mode === 'export' ? (
        <ShowdownExport
          key={team}
          text={output}
          filename={`equipo-${team + 1}.txt`}
          copyLabel="Copiar equipo"
        />
      ) : (
        <>
          <label className="transfer-label">
            Formato Import / Export
            <textarea
              aria-label="Texto de Showdown"
              className="showdown-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                'Torkoal @ Charcoal\nAbility: Drought\nLevel: 50\nQuiet Nature\n- Protect\n- Heat Wave\n- Eruption\n- Weather Ball'
              }
            />
          </label>
          <label className="check-line">
            <input
              disabled={busy}
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            Reemplazar el equipo completo
          </label>
          <p className="small muted">
            Hasta seis Pokémon, separados por una línea en blanco. Se validan antes de guardar. Los
            campos no compatibles generan un error.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <footer className="modal-footer">
            <button
              className="button primary"
              onClick={() => void apply()}
              disabled={busy || !text.trim()}
            >
              {busy && <LoaderCircle size={16} className="spin" />}
              {busy ? 'Validando…' : 'Importar Pokémon'}
            </button>
          </footer>
        </>
      )}
    </Modal>
  );
}
