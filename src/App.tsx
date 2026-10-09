import { useEffect, useState } from 'react';
import {
  Swords,
  LayoutGrid,
  ArrowUpFromLine,
  ArrowDownToLine,
  Plus,
  Pencil,
  Trash2,
  Check,
  ShieldCheck,
  Sparkles,
  LoaderCircle,
  Github,
  ArrowUpRight,
  BookOpen,
  CircleHelp,
} from 'lucide-react';
import {
  calcPokemon,
  emptyTeams,
  restoreTeams,
  validateMember,
  type Gen,
  type Member,
  type Team,
} from './model';
import { loadPokemon } from './api';
import { importShowdown } from './showdown';
import { Editor, Modal, Sprite, Transfer, Types, errorText } from './components';
import Calculator from './Calculator';
const STORAGE = 'pokemon-team-lab:v1';
type Slot = { team: number; slot: number };
const demo = [
  `Torkoal @ Charcoal\nAbility: Drought\nEVs: 252 HP / 252 SpA / 4 SpD\nQuiet Nature\n- Protect\n- Heat Wave\n- Eruption\n- Weather Ball\n\nGarchomp @ Choice Scarf\nAbility: Rough Skin\nEVs: 252 Atk / 4 SpD / 252 Spe\nJolly Nature\n- Earthquake\n- Dragon Claw\n- Rock Slide\n- Protect\n\nAmoonguss @ Sitrus Berry\nAbility: Regenerator\nEVs: 252 HP / 156 Def / 100 SpD\nRelaxed Nature\n- Spore\n- Rage Powder\n- Pollen Puff\n- Protect`,
  `Pelipper @ Focus Sash\nAbility: Drizzle\nEVs: 4 HP / 252 SpA / 252 Spe\nModest Nature\n- Hurricane\n- Weather Ball\n- Tailwind\n- Protect\n\nIncineroar @ Sitrus Berry\nAbility: Intimidate\nEVs: 252 HP / 156 Def / 100 SpD\nCareful Nature\n- Fake Out\n- Flare Blitz\n- Knock Off\n- Parting Shot\n\nFlutter Mane @ Booster Energy\nAbility: Protosynthesis\nEVs: 4 HP / 252 SpA / 252 Spe\nTimid Nature\n- Moonblast\n- Shadow Ball\n- Dazzling Gleam\n- Protect`,
];
function initialState() {
  try {
    const raw = localStorage.getItem(STORAGE);
    return { saved: restoreTeams(raw), invalid: !!raw && !restoreTeams(raw) };
  } catch {
    return { saved: null, invalid: false };
  }
}
export default function App() {
  const [initial] = useState(initialState),
    [teams, setTeams] = useState<Team[]>(initial.saved?.teams || emptyTeams()),
    [gen, setGen] = useState<Gen>(initial.saved?.gen || 9),
    [selected, setSelected] = useState<Slot[]>([]),
    [editor, setEditor] = useState<Slot | null>(null),
    [transfer, setTransfer] = useState<{ mode: 'import' | 'export'; team: number } | null>(null),
    [battle, setBattle] = useState<[Member, Member] | null>(null),
    [help, setHelp] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      initial.invalid
        ? 'No se pudo restaurar el guardado. El contenido anterior no se sobrescribirá hasta que modifiques un equipo.'
        : '',
    ),
    [storageError, setStorageError] = useState(''),
    [dirty, setDirty] = useState(false),
    [deleteSlot, setDeleteSlot] = useState<Slot | null>(null);
  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ version: 1, gen, teams }));
      setStorageError('');
    } catch {
      setStorageError(
        'No se pudo guardar en este navegador. Exporta tus equipos para conservarlos.',
      );
    }
  }, [teams, gen, dirty]);
  const count = teams.reduce((n, t) => n + t.slots.filter(Boolean).length, 0),
    single = selected.length === 1 ? selected[0] : null;
  const canBattle =
    selected.length === 2 &&
    selected[0].team !== selected[1].team &&
    selected.every((s) => teams[s.team].slots[s.slot]);
  function changeTeams(value: Team[]) {
    setTeams(value);
    setDirty(true);
  }
  function save(m: Member) {
    if (!editor) return;
    const next = structuredClone(teams);
    next[editor.team].slots[editor.slot] = m;
    changeTeams(next);
    setEditor(null);
    setMessage(`${m.data.name} guardado en ${teams[editor.team].name}.`);
  }
  function toggle(team: number, slot: number) {
    setSelected((s) =>
      s.some((p) => p.team === team && p.slot === slot)
        ? s.filter((p) => p.team !== team || p.slot !== slot)
        : [...s, { team, slot }],
    );
  }
  function importMembers(team: number, members: Member[], replace: boolean) {
    const next = structuredClone(teams);
    if (replace) next[team].slots = Array(6).fill(null);
    let index = 0;
    for (let i = 0; i < 6 && index < members.length; i++)
      if (!next[team].slots[i]) next[team].slots[i] = members[index++];
    changeTeams(next);
    setTransfer(null);
    setSelected([]);
    setMessage(`${members.length} Pokémon importados en ${teams[team].name}.`);
  }
  async function changeGeneration(value: Gen) {
    if (value === gen) return;
    setBusy(true);
    setMessage('');
    try {
      const next = structuredClone(teams);
      for (const team of next)
        for (const m of team.slots)
          if (m) {
            m.data = await loadPokemon(m.data.name, value);
            validateMember(m, value);
          }
      setGen(value);
      changeTeams(next);
      setSelected([]);
      setMessage(`Mecánicas de la generación ${value} activadas.`);
    } catch (e) {
      setMessage(
        `No se ha cambiado la generación: ${errorText(e)} Adapta o elimina los Pokémon incompatibles primero.`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function loadDemo() {
    setBusy(true);
    setMessage('');
    try {
      const imported = await Promise.all(demo.map((text) => importShowdown(text, 9)));
      changeTeams(
        imported.map((members, i) => ({
          name: i === 0 ? 'Equipo Aurora' : 'Equipo Eclipse',
          slots: [...members, ...Array(6 - members.length).fill(null)],
        })),
      );
      setGen(9);
      setSelected([]);
      setMessage(
        'Ejemplo cargado: sol frente a lluvia. Selecciona un Pokémon de cada equipo para comparar.',
      );
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function startBattle() {
    if (!canBattle) return;
    const slots = [...selected].sort((a, b) => a.team - b.team);
    setBattle(slots.map((s) => teams[s.team].slots[s.slot]!) as [Member, Member]);
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Pokémon Team Lab">
          <span className="brand-mark">
            <span />
          </span>
          <span>
            TEAM<span className="brand-light">LAB</span>
          </span>
        </a>
        <p className="sidebar-caption">POKÉMON WORKSPACE</p>
        <nav aria-label="Navegación principal">
          <button
            className="nav-item active"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <LayoutGrid size={19} />
            Constructor de equipos
            <span className="nav-dot" />
          </button>
          <button
            className="nav-item"
            disabled={!canBattle || busy}
            title="Selecciona un Pokémon de cada equipo"
            onClick={startBattle}
          >
            <Swords size={19} />
            Calculadora de daño
          </button>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <BookOpen size={19} />
            Guía de uso
            <ArrowUpRight size={15} />
          </button>
        </nav>
        <div className="sidebar-tip">
          <span className="tip-icon">
            <Sparkles size={19} />
          </span>
          <h3>Cada detalle cuenta.</h3>
          <p>Un movimiento. Un objeto. Una ventaja para tu próximo combate.</p>
          <div className="tip-line" />
        </div>
        <div className="sidebar-bottom">
          <span className="local-dot" />
          <span>Local. Privado. Tu equipo.</span>
          <a
            href="https://github.com/smogon/damage-calc"
            target="_blank"
            rel="noreferrer"
            aria-label="Motor Smogon en GitHub"
          >
            <Github size={17} />
          </a>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>Constructor de equipos</strong>
          </div>
          <div className="save-status">
            <span className={storageError ? 'status-dot warning' : 'status-dot'} />
            {storageError
              ? 'Error de guardado'
              : dirty || initial.saved
                ? 'Guardado en este navegador'
                : 'Almacenamiento local'}
            <ShieldCheck size={17} />
          </div>
        </header>
        <main>
          <section className="page-intro">
            <div>
              <p className="eyebrow">
                <span /> CONSTRUYE. COMPARA. COMPITE.
              </p>
              <h1>
                Tu estrategia empieza
                <br />
                con un <em>buen equipo.</em>
              </h1>
              <p className="intro-description">
                Prepara tus Pokémon, afina sus características y encuentra
                <br className="desktop-break" /> la ventaja en cada enfrentamiento.
              </p>
            </div>
            <div className="intro-counter">
              <div className="counter-orbit">
                <span className="orbit-dot" />
                <Swords size={33} strokeWidth={1.5} />
              </div>
              <p>
                <strong>{String(count).padStart(2, '0')}</strong>
                <span>
                  / 12
                  <br />
                  POKÉMON
                </span>
              </p>
            </div>
          </section>
          <div className="workspace-toolbar">
            <div className="workspace-tabs">
              <span className="workspace-tab">
                <LayoutGrid size={16} />
                Mis equipos<span className="pill">2</span>
              </span>
            </div>
            <div className="toolbar-controls">
              <label className="generation-label">
                Mecánicas
                <select
                  aria-label="Generación"
                  disabled={busy}
                  value={gen}
                  onChange={(e) => void changeGeneration(Number(e.target.value) as Gen)}
                >
                  {Array.from({ length: 9 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      Generación {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button secondary compact"
                disabled={busy}
                onClick={() => setTransfer({ mode: 'import', team: 0 })}
              >
                <ArrowDownToLine size={16} />
                Importar
              </button>
              <button
                className="button secondary compact"
                disabled={busy || !count}
                onClick={() => setTransfer({ mode: 'export', team: 0 })}
              >
                <ArrowUpFromLine size={16} />
                Exportar
              </button>
            </div>
          </div>
          {(message || storageError) && (
            <div className={`notice ${storageError ? 'error' : ''}`} role="status">
              <span>{storageError || message}</span>
              <button
                className="icon-button"
                aria-label="Cerrar aviso"
                onClick={() => {
                  setMessage('');
                  setStorageError('');
                }}
              >
                ×
              </button>
            </div>
          )}
          <div className="teams-grid">
            {teams.map((team, t) => (
              <section className={`team-panel team-${t}`} key={t}>
                <header className="team-header">
                  <div className="team-avatar">{t === 0 ? 'A' : 'E'}</div>
                  <div>
                    <p className="eyebrow">EQUIPO {String(t + 1).padStart(2, '0')}</p>
                    <input
                      className="team-name"
                      aria-label={`Nombre equipo ${t + 1}`}
                      value={team.name}
                      maxLength={40}
                      disabled={busy}
                      onChange={(e) => {
                        const next = structuredClone(teams);
                        next[t].name = e.target.value;
                        changeTeams(next);
                      }}
                    />
                  </div>
                  <span className="team-count">
                    {team.slots.filter(Boolean).length}
                    <span> / 6</span>
                  </span>
                  <button
                    className="icon-button"
                    disabled={busy}
                    title="Importar en este equipo"
                    aria-label={`Importar en equipo ${t + 1}`}
                    onClick={() => setTransfer({ mode: 'import', team: t })}
                  >
                    <ArrowDownToLine size={18} />
                  </button>
                </header>
                <div className="team-slots">
                  {team.slots.map((m, i) => {
                    const chosen = selected.some((s) => s.team === t && s.slot === i);
                    return (
                      <article
                        key={i}
                        className={`pokemon-card ${m ? 'filled' : 'empty'} ${chosen ? 'selected' : ''}`}
                      >
                        <label className="slot-check">
                          <input
                            type="checkbox"
                            disabled={busy}
                            checked={chosen}
                            onChange={() => toggle(t, i)}
                            aria-label={`Seleccionar plaza ${i + 1} de equipo ${t + 1}${m ? `: ${m.data.name}` : ''}`}
                          />
                          <span>{chosen ? <Check size={12} /> : null}</span>
                        </label>
                        <span className="slot-number">{String(i + 1).padStart(2, '0')}</span>
                        {m ? (
                          <>
                            <Sprite member={m} />
                            <div className="pokemon-info">
                              <div className="pokemon-title">
                                <button
                                  className="name-button"
                                  disabled={busy}
                                  onClick={() => setEditor({ team: t, slot: i })}
                                >
                                  {m.nickname || m.data.name}
                                </button>
                                <span className="pokemon-level">
                                  Nv. {m.level}{' '}
                                  <span>
                                    {m.gender === 'M' ? '♂' : m.gender === 'F' ? '♀' : '—'}
                                  </span>
                                </span>
                              </div>
                              <Types
                                types={calcPokemon(m, gen).types.map((type) => type.toLowerCase())}
                              />
                              <div className="pokemon-meta">
                                <span title="Habilidad">
                                  {gen >= 3 ? m.ability : 'Sin habilidad'}
                                </span>
                                <i /> <span title="Objeto equipado">{m.item || 'Sin objeto'}</span>
                              </div>
                              <div className="card-moves">
                                {m.moves.map((move, n) => (
                                  <span className={!move ? 'unused' : ''} key={n}>
                                    {move || '—'}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              className="card-edit icon-button"
                              disabled={busy}
                              aria-label={`Editar ${m.data.name}`}
                              onClick={() => setEditor({ team: t, slot: i })}
                            >
                              <Pencil size={15} />
                            </button>
                          </>
                        ) : (
                          <button
                            className="empty-content"
                            disabled={busy}
                            onClick={() => setEditor({ team: t, slot: i })}
                          >
                            <span className="empty-plus">
                              <Plus size={20} />
                            </span>
                            <span>
                              <strong>Añadir Pokémon</strong>
                              <small>Una plaza para tu próxima estrategia</small>
                            </span>
                            <ArrowUpRight size={17} />
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
                <footer className="team-footer">
                  <span>
                    <span className="local-dot" />
                    Guardado local
                  </span>
                  <button
                    disabled={!team.slots.some(Boolean) || busy}
                    onClick={() => setTransfer({ mode: 'export', team: t })}
                  >
                    Exportar equipo <ArrowUpRight size={14} />
                  </button>
                </footer>
              </section>
            ))}
          </div>
          <div className="workspace-hint">
            <CircleHelp size={16} />
            <span>
              Selecciona un Pokémon de cada equipo para calcular el daño y comparar quién atacaría
              primero.
            </span>
            {!count && (
              <button disabled={busy} onClick={() => void loadDemo()}>
                {busy ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}Cargar
                ejemplo
              </button>
            )}
          </div>
          <div className="action-bar">
            <div className="selection-status">
              <span className="selection-icon">
                <Check size={16} />
              </span>
              <strong>
                {selected.length}{' '}
                {selected.length === 1 ? 'plaza seleccionada' : 'plazas seleccionadas'}
              </strong>
              {selected.length > 0 && <button onClick={() => setSelected([])}>Limpiar</button>}
            </div>
            <div className="selection-actions">
              <button
                className="button secondary"
                disabled={!single || busy}
                onClick={() => single && setEditor(single)}
              >
                <Pencil size={16} />
                {single && teams[single.team].slots[single.slot] ? 'Editar' : 'Añadir / editar'}
              </button>
              <button
                className="button danger"
                disabled={!single || !teams[single.team].slots[single.slot] || busy}
                onClick={() => single && setDeleteSlot(single)}
              >
                <Trash2 size={16} />
                <span>Borrar</span>
              </button>
              <button
                className="button primary"
                disabled={!canBattle || busy}
                onClick={startBattle}
              >
                <Swords size={17} />
                Enfrentar Pokémon
                <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
          <footer className="page-footer">
            <span>
              POKÉMON TEAM LAB <i>·</i> El laboratorio de tu próxima victoria.
            </span>
            <span>
              Datos de{' '}
              <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">
                PokéAPI
              </a>{' '}
              <i>·</i> Cálculos de{' '}
              <a href="https://github.com/smogon/damage-calc" target="_blank" rel="noreferrer">
                Smogon
              </a>
            </span>
          </footer>
        </main>
      </div>
      {editor && (
        <Editor
          key={`${editor.team}-${editor.slot}`}
          member={teams[editor.team].slots[editor.slot]}
          gen={gen}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}{' '}
      {transfer && (
        <Transfer
          {...transfer}
          initialTeam={transfer.team}
          teams={teams}
          gen={gen}
          onImport={importMembers}
          onClose={() => setTransfer(null)}
        />
      )}{' '}
      {battle && <Calculator members={battle} gen={gen} onClose={() => setBattle(null)} />}{' '}
      {deleteSlot && (
        <Modal title="Borrar Pokémon" onClose={() => setDeleteSlot(null)}>
          <p>
            ¿Quieres liberar la plaza de{' '}
            <strong>{teams[deleteSlot.team].slots[deleteSlot.slot]?.data.name}</strong> en{' '}
            {teams[deleteSlot.team].name}?
          </p>
          <footer className="modal-footer">
            <button className="button secondary" onClick={() => setDeleteSlot(null)}>
              Cancelar
            </button>
            <button
              className="button danger"
              onClick={() => {
                const next = structuredClone(teams);
                next[deleteSlot.team].slots[deleteSlot.slot] = null;
                changeTeams(next);
                setSelected([]);
                setDeleteSlot(null);
                setMessage('Plaza liberada.');
              }}
            >
              Borrar Pokémon
            </button>
          </footer>
        </Modal>
      )}{' '}
      {help && (
        <Modal title="Una estrategia, paso a paso" onClose={() => setHelp(false)}>
          <ol className="help-steps">
            <li>
              <strong>Construye dos equipos.</strong>
              <p>
                Añade Pokémon en una plaza vacía o importa texto de Showdown. Usa nombres de
                especies, movimientos y objetos en inglés.
              </p>
            </li>
            <li>
              <strong>Afina tu equipo.</strong>
              <p>
                Edita movimientos, habilidad, objeto, naturaleza, IVs, EVs y PS. El porcentaje de
                vida se conserva al cambiar las características.
              </p>
            </li>
            <li>
              <strong>Compara un enfrentamiento.</strong>
              <p>
                Marca una plaza ocupada de cada equipo. «Enfrentar Pokémon» abre los cálculos de
                ambos Pokémon, el campo y el orden de ataque.
              </p>
            </li>
            <li>
              <strong>Conserva tu trabajo.</strong>
              <p>
                Los equipos se guardan en este navegador. Exporta una copia de Showdown antes de
                borrar los datos del navegador. El formato Showdown no conserva los PS actuales.
              </p>
            </li>
          </ol>
          <p className="small muted">
            Perfil elegido: mecánicas de Showdown de generaciones I–IX con IVs/EVs y nivel 50 por
            defecto. No aplica la distribución de Stat Points ni el catálogo exclusivo de Champions.
            Al cambiar de generación se vuelven a validar los equipos; si hay incompatibilidades, se
            conserva la anterior.
          </p>
        </Modal>
      )}
    </div>
  );
}
