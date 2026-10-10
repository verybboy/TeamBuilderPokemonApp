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
  FolderHeart,
  Moon,
  Sun,
  Save,
} from 'lucide-react';
import {
  calcPokemon,
  emptyTeams,
  restoreTeams,
  validateMember,
  apiGeneration,
  mechanicsLabel,
  convertMemberProfile,
  type Gen,
  type Member,
  type Team,
} from './model';
import { loadPokemon } from './api';
import { importShowdown } from './showdown';
import { Editor, Modal, Sprite, Transfer, Types, errorText } from './components';
import Calculator from './Calculator';
import Library from './ConfigurationLibrary';
import DefensiveCoverage from './DefensiveCoverage';
import { SaveTeamDialog, ClearTeamDialog } from './TeamDialogs';
import { moveInfo } from './moves';
import { MoveType } from './MovePicker';
import {
  LIBRARY_KEY,
  restoreLibrary,
  addConfiguration,
  persistLibrary,
  type SavedConfiguration,
  TEAM_LIBRARY_KEY,
  restoreTeamLibrary,
  addTeamConfiguration,
  persistTeamLibrary,
  type SavedTeamConfiguration,
} from './library';
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
function initialLibrary() {
  try {
    return restoreLibrary(localStorage.getItem(LIBRARY_KEY));
  } catch {
    return { entries: [], invalid: false };
  }
}
function initialTheme(): 'light' | 'dark' {
  try {
    const value = localStorage.getItem('pokemon-team-lab:theme');
    if (value === 'light' || value === 'dark') return value;
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function initialTeamLibrary() {
  try {
    return restoreTeamLibrary(localStorage.getItem(TEAM_LIBRARY_KEY));
  } catch {
    return { entries: [], invalid: false };
  }
}
export default function App() {
  const [initial] = useState(initialState),
    [libraryInitial] = useState(initialLibrary),
    [configurations, setConfigurations] = useState(libraryInitial.entries),
    [teamLibraryInitial] = useState(initialTeamLibrary),
    [savedTeams, setSavedTeams] = useState(teamLibraryInitial.entries),
    [savingTeam, setSavingTeam] = useState<number | null>(null),
    [clearingTeam, setClearingTeam] = useState<number | null>(null),
    [view, setView] = useState<'teams' | 'library'>('teams'),
    [theme, setTheme] = useState(initialTheme),
    [teams, setTeams] = useState<Team[]>(initial.saved?.teams || emptyTeams()),
    [gen, setGen] = useState<Gen>(initial.saved?.gen ?? 0),
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
    [deleteSlots, setDeleteSlots] = useState<Slot[] | null>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('pokemon-team-lab:theme', theme);
    } catch {}
  }, [theme]);
  const occupiedSelection = selected.filter((slot) => teams[slot.team].slots[slot.slot]);
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
  function saveConfiguration(member: Member, name: string) {
    const result = addConfiguration(configurations, member, gen, name);
    try {
      persistLibrary(result.entries);
    } catch {
      throw new Error('No se pudo guardar la configuración en este navegador.');
    }
    setConfigurations(result.entries);
    setMessage(`${result.entry.name} guardada en tu biblioteca.`);
  }
  function updateTeamLibrary(entries: SavedTeamConfiguration[]) {
    try {
      persistTeamLibrary(entries);
    } catch {
      throw new Error('No se pudo guardar la biblioteca de equipos en este navegador.');
    }
    setSavedTeams(entries);
  }
  function saveTeam(team: Team, name: string) {
    const result = addTeamConfiguration(savedTeams, team, gen, name);
    updateTeamLibrary(result.entries);
    setMessage(`${result.entry.name} guardado en Mis equipos.`);
  }
  async function importTeamConfiguration(text: string, name: string) {
    setBusy(true);
    try {
      const members = await importShowdown(text, gen);
      saveTeam({ name, slots: [...members, ...Array(6 - members.length).fill(null)] }, name);
    } finally {
      setBusy(false);
    }
  }
  async function loadTeamConfiguration(entry: SavedTeamConfiguration, destination: number) {
    setBusy(true);
    try {
      const snapshot = structuredClone(entry.team);
      for (let i = 0; i < snapshot.slots.length; i++) {
        if (!snapshot.slots[i]) continue;
        const member = convertMemberProfile(snapshot.slots[i]!, entry.gen, gen);
        member.data = await loadPokemon(member.data.name, gen);
        validateMember(member, gen);
        snapshot.slots[i] = member;
      }
      const next = structuredClone(teams);
      next[destination] = snapshot;
      changeTeams(next);
      setSelected((selected) => selected.filter((slot) => slot.team !== destination));
      setMessage(`${entry.name} cargado en el equipo ${destination + 1}.`);
    } catch (e) {
      throw new Error(`No se ha cargado el equipo: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  }
  function renameTeamConfiguration(entry: SavedTeamConfiguration, name: string) {
    updateTeamLibrary(
      savedTeams.map((value) =>
        value.id === entry.id ? { ...value, name, team: { ...value.team, name } } : value,
      ),
    );
  }
  function deleteTeamConfiguration(entry: SavedTeamConfiguration) {
    updateTeamLibrary(savedTeams.filter((value) => value.id !== entry.id));
    setMessage(`${entry.name} eliminado de Mis equipos.`);
  }
  async function addFromLibrary(entry: SavedConfiguration, team: number) {
    const free = teams[team].slots.findIndex((slot) => !slot);
    if (free < 0) {
      setMessage('El equipo está completo. Libera una plaza primero.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const member = convertMemberProfile(entry.member, entry.gen, gen);
      member.data = await loadPokemon(member.data.name, gen);
      validateMember(member, gen);
      const next = structuredClone(teams);
      next[team].slots[free] = member;
      changeTeams(next);
      setMessage(`${entry.name} añadida a ${teams[team].name}, plaza ${free + 1}.`);
    } catch (e) {
      setMessage(`No se ha añadido la configuración: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  }
  async function importConfigurations(text: string, name: string) {
    setBusy(true);
    try {
      const members = await importShowdown(text, gen);
      let entries = configurations;
      for (const member of members)
        entries = addConfiguration(
          entries,
          member,
          gen,
          members.length === 1 ? name : `${name} · ${member.data.name}`,
        ).entries;
      try {
        persistLibrary(entries);
      } catch {
        throw new Error('No se pudo guardar la biblioteca en este navegador.');
      }
      setConfigurations(entries);
      setMessage(`${members.length} configuraciones importadas en la biblioteca.`);
    } finally {
      setBusy(false);
    }
  }
  function renameConfiguration(entry: SavedConfiguration, name: string) {
    const next = configurations.map((value) =>
      value.id === entry.id ? { ...value, name } : value,
    );
    try {
      persistLibrary(next);
    } catch {
      throw new Error('No se pudo guardar el nombre.');
    }
    setConfigurations(next);
  }
  function toggle(team: number, slot: number) {
    setSelected((s) =>
      s.some((p) => p.team === team && p.slot === slot)
        ? s.filter((p) => p.team !== team || p.slot !== slot)
        : [...s, { team, slot }],
    );
  }
  function deleteConfiguration(entry: SavedConfiguration) {
    const next = configurations.filter((value) => value.id !== entry.id);
    try {
      persistLibrary(next);
    } catch {
      throw new Error('No se pudo eliminar la configuración de este navegador.');
    }
    setConfigurations(next);
    setMessage(`${entry.name} eliminada de tu biblioteca.`);
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
        for (let i = 0; i < team.slots.length; i++)
          if (team.slots[i]) {
            const m = convertMemberProfile(team.slots[i]!, gen, value);
            m.data = await loadPokemon(m.data.name, value);
            validateMember(m, value);
            team.slots[i] = m;
          }
      setGen(value);
      changeTeams(next);
      setSelected([]);
      setMessage(
        `${mechanicsLabel(value)} activado.${value === 0 ? ' EVs convertidos a SP; nivel 50 e IVs perfectos.' : ''}`,
      );
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
      const profile: Gen = gen === 0 ? 0 : 9;
      const texts =
        profile === 0
          ? [
              demo[0].replace(
                /Amoonguss[\s\S]*$/,
                'Venusaur @ Sitrus Berry\nAbility: Chlorophyll\nEVs: 252 HP / 156 Def / 100 SpD\nRelaxed Nature\n- Sleep Powder\n- Sludge Bomb\n- Giga Drain\n- Protect',
              ),
              demo[1].replace(
                /Flutter Mane[\s\S]*$/,
                'Sylveon @ Sitrus Berry\nAbility: Pixilate\nEVs: 4 HP / 252 SpA / 252 Spe\nTimid Nature\n- Moonblast\n- Hyper Voice\n- Quick Attack\n- Protect',
              ),
            ]
          : demo;
      const imported = await Promise.all(texts.map((text) => importShowdown(text, 9)));
      if (profile === 0) {
        for (const team of imported)
          for (let i = 0; i < team.length; i++) {
            const m = convertMemberProfile(team[i], 9, profile);
            m.data = await loadPokemon(m.data.name, profile);
            validateMember(m, profile);
            team[i] = m;
          }
      }
      changeTeams(
        imported.map((members, i) => ({
          name: i === 0 ? 'Equipo Aurora' : 'Equipo Eclipse',
          slots: [...members, ...Array(6 - members.length).fill(null)],
        })),
      );
      setGen(profile);
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
            className={`nav-item ${view === 'teams' ? 'active' : ''}`}
            onClick={() => {
              setView('teams');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <LayoutGrid size={19} />
            Constructor de equipos
            <span className="nav-dot" />
          </button>
          <button
            className={`nav-item ${view === 'library' ? 'active' : ''}`}
            onClick={() => {
              setView('library');
              setSelected([]);
            }}
          >
            <FolderHeart size={19} />
            Mis configuraciones
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
            Workspace <span>/</span>{' '}
            <strong>{view === 'teams' ? 'Constructor de equipos' : 'Mis configuraciones'}</strong>
          </div>
          <div className="save-status">
            <span className={storageError ? 'status-dot warning' : 'status-dot'} />
            {storageError
              ? 'Error de guardado'
              : dirty || initial.saved
                ? 'Guardado en este navegador'
                : 'Almacenamiento local'}
            <ShieldCheck size={17} />
            <button
              className="theme-toggle icon-button"
              aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
            </button>
          </div>
        </header>
        <main>
          {view === 'library' ? (
            <>
              {(message || storageError) && (
                <div className="notice" role="status">
                  {storageError || message}
                </div>
              )}
              <Library
                entries={configurations}
                savedTeams={savedTeams}
                teamsInvalid={teamLibraryInitial.invalid && savedTeams.length === 0}
                onLoadTeam={loadTeamConfiguration}
                onImportTeam={importTeamConfiguration}
                onRenameTeam={renameTeamConfiguration}
                onDeleteTeam={deleteTeamConfiguration}
                teams={teams}
                gen={gen}
                busy={busy}
                invalid={libraryInitial.invalid && configurations.length === 0}
                onAdd={addFromLibrary}
                onImport={importConfigurations}
                onRename={renameConfiguration}
                onDelete={deleteConfiguration}
                onChangeMechanics={changeGeneration}
              />
            </>
          ) : (
            <>
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
                      <option value={0}>Pokémon Champions</option>
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
                      <div className="team-name-block">
                        <p className="eyebrow">EQUIPO {String(t + 1).padStart(2, '0')}</p>
                        <div className="team-name-actions">
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
                          <button
                            className="icon-button"
                            disabled={busy || !team.slots.some(Boolean)}
                            title="Guardar en Mis equipos"
                            aria-label={`Guardar equipo ${t + 1}`}
                            onClick={() => setSavingTeam(t)}
                          >
                            <Save size={17} />
                          </button>
                          <button
                            className="icon-button team-clear"
                            disabled={busy || !team.slots.some(Boolean)}
                            title="Limpiar equipo entero"
                            aria-label={`Limpiar equipo ${t + 1}`}
                            onClick={() => setClearingTeam(t)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
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
                            onClick={(e) => {
                              if (!busy && !(e.target as Element).closest('button')) toggle(t, i);
                            }}
                          >
                            <button
                              className="card-select"
                              disabled={busy}
                              aria-pressed={chosen}
                              onClick={() => toggle(t, i)}
                              aria-label={`Seleccionar plaza ${i + 1} de equipo ${t + 1}${m ? `: ${m.data.name}` : ''}`}
                            />
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
                                    types={calcPokemon(m, gen).types.map((type) =>
                                      type.toLowerCase(),
                                    )}
                                  />
                                  <div className="pokemon-meta">
                                    <span title="Habilidad">
                                      {apiGeneration(gen) >= 3 ? m.ability : 'Sin habilidad'}
                                    </span>
                                    <i />{' '}
                                    <span title="Objeto equipado">{m.item || 'Sin objeto'}</span>
                                  </div>
                                  <div className="card-moves">
                                    {m.moves.map((move, n) => (
                                      <span className={!move ? 'unused' : ''} key={n}>
                                        <span className="card-move-name">{move || '—'}</span>
                                        {moveInfo(move, gen) && (
                                          <MoveType type={moveInfo(move, gen)!.type} />
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                </div>
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
                    <DefensiveCoverage team={team} gen={gen} />
                  </section>
                ))}
              </div>
              <div className="workspace-hint">
                <CircleHelp size={16} />
                <span>
                  Selecciona un Pokémon de cada equipo para calcular el daño y comparar quién
                  atacaría primero.
                </span>
                {!count && (
                  <button disabled={busy} onClick={() => void loadDemo()}>
                    {busy ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}
                    Cargar ejemplo
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
                    className="button secondary save-build-button"
                    aria-label="Guardar configuración"
                    disabled={!single || !teams[single.team].slots[single.slot] || busy}
                    onClick={() => {
                      if (!single) return;
                      const member = teams[single.team].slots[single.slot]!;
                      try {
                        saveConfiguration(member, '');
                      } catch (e) {
                        setMessage(errorText(e));
                      }
                    }}
                  >
                    <Save size={16} />
                    <span>Guardar configuración</span>
                  </button>
                  <button
                    className="button danger"
                    aria-label="Borrar"
                    disabled={!occupiedSelection.length || busy}
                    onClick={() => setDeleteSlots(occupiedSelection)}
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
            </>
          )}
        </main>
      </div>
      {editor && (
        <Editor
          key={`${editor.team}-${editor.slot}`}
          member={teams[editor.team].slots[editor.slot]}
          gen={gen}
          onSave={save}
          onSaveConfiguration={saveConfiguration}
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
      {savingTeam !== null && (
        <SaveTeamDialog
          team={teams[savingTeam]}
          onSave={(name) => saveTeam(teams[savingTeam], name)}
          onClose={() => setSavingTeam(null)}
        />
      )}
      {clearingTeam !== null && (
        <ClearTeamDialog
          team={teams[clearingTeam]}
          onClose={() => setClearingTeam(null)}
          onClear={() => {
            const next = structuredClone(teams);
            next[clearingTeam].slots = Array(6).fill(null);
            changeTeams(next);
            setSelected((selected) => selected.filter((slot) => slot.team !== clearingTeam));
            setMessage(`${teams[clearingTeam].name} limpiado.`);
          }}
        />
      )}
      {deleteSlots && (
        <Modal title="Borrar Pokémon" onClose={() => setDeleteSlots(null)}>
          <p>
            ¿Quieres borrar los {deleteSlots.length} Pokémon seleccionados y liberar sus plazas?
          </p>
          <ul className="delete-list">
            {deleteSlots.map((slot) => (
              <li key={`${slot.team}-${slot.slot}`}>
                {teams[slot.team].slots[slot.slot]?.data.name} · {teams[slot.team].name}
              </li>
            ))}
          </ul>
          <footer className="modal-footer">
            <button className="button secondary" onClick={() => setDeleteSlots(null)}>
              Cancelar
            </button>
            <button
              className="button danger"
              onClick={() => {
                const next = structuredClone(teams);
                for (const slot of deleteSlots) next[slot.team].slots[slot.slot] = null;
                changeTeams(next);
                setSelected([]);
                setDeleteSlots(null);
                setMessage(`${deleteSlots.length} Pokémon borrados. Plazas liberadas.`);
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
            Perfiles disponibles: generaciones I–IX y Pokémon Champions, con 0–32 SP por estadística
            y un máximo de 66 SP. Guarda builds en «Mis configuraciones» y descárgalos como .txt. Al
            cambiar de generación se vuelven a validar los equipos; si hay incompatibilidades, se
            conserva la anterior.
          </p>
        </Modal>
      )}
    </div>
  );
}
