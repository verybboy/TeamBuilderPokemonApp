import { useState, useRef, type ChangeEvent } from 'react';
import {
  Search,
  Download,
  Plus,
  FolderHeart,
  Upload,
  LoaderCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Sprite, Types, Modal, errorText } from './components';
import { mechanicsLabel, natureLabel, stats, trainingLimits, type Gen, type Team } from './model';
import { downloadConfiguration, type SavedConfiguration } from './library';
export default function Library({
  entries,
  teams,
  gen,
  busy,
  invalid,
  onAdd,
  onImport,
  onRename,
  onDelete,
  onChangeMechanics,
}: {
  entries: SavedConfiguration[];
  teams: Team[];
  gen: Gen;
  busy: boolean;
  invalid: boolean;
  onAdd: (entry: SavedConfiguration, team: number) => Promise<void>;
  onImport: (text: string, name: string) => Promise<void>;
  onRename: (entry: SavedConfiguration, name: string) => void;
  onDelete: (entry: SavedConfiguration) => void;
  onChangeMechanics: (gen: Gen) => Promise<void>;
}) {
  const [query, setQuery] = useState(''),
    [team, setTeam] = useState(0),
    [fileBusy, setFileBusy] = useState(false),
    [error, setError] = useState(''),
    [renaming, setRenaming] = useState<SavedConfiguration | null>(null),
    [deleting, setDeleting] = useState<SavedConfiguration | null>(null),
    [name, setName] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const visible = entries.filter((entry) =>
    `${entry.name} ${entry.member.data.name} ${entry.member.nature} ${entry.member.moves.join(' ')}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  async function readFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setFileBusy(true);
    try {
      if (file.size > 30000) throw new Error('El archivo no puede superar 30 KB.');
      await onImport(await file.text(), file.name.replace(/\.txt$/i, ''));
    } catch (error) {
      setError(errorText(error));
    } finally {
      setFileBusy(false);
    }
  }
  return (
    <section className="library-view">
      <div className="library-intro">
        <div>
          <p className="eyebrow">TU COLECCIÓN DE ESTRATEGIAS</p>
          <h1>
            Mis configuraciones <span className="pill">{entries.length}</span>
          </h1>
          <p>Guarda tus builds favoritos. Compáralos y llévalos a un equipo con un clic.</p>
        </div>
        <button
          className="button primary"
          disabled={busy || fileBusy}
          onClick={() => fileInput.current?.click()}
        >
          {fileBusy ? <LoaderCircle size={17} className="spin" /> : <Upload size={17} />}Importar
          .txt
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,text/plain"
          aria-label="Importar archivo de configuración"
          className="file-input"
          onChange={(e) => void readFile(e)}
        />
      </div>
      <div className="library-controls">
        <label className="library-search">
          <Search size={17} />
          <input
            aria-label="Buscar configuraciones"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca por Pokémon, build, naturaleza o movimiento…"
          />
        </label>
        <label>
          Equipo de destino
          <select value={team} onChange={(e) => setTeam(Number(e.target.value))}>
            {teams.map((t, i) => (
              <option key={i} value={i}>
                {t.name} · {6 - t.slots.filter(Boolean).length} plazas libres
              </option>
            ))}
          </select>
        </label>
        <label>
          Perfil de importación / destino
          <select
            aria-label="Mecánicas de la biblioteca"
            disabled={busy || fileBusy}
            value={gen}
            onChange={(e) => void onChangeMechanics(Number(e.target.value) as Gen)}
          >
            <option value={0}>Pokémon Champions</option>
            {Array.from({ length: 9 }, (_, i) => (
              <option value={i + 1} key={i}>
                {mechanicsLabel((i + 1) as Gen)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="small muted library-explanation">
        Cada configuración conserva su perfil. Al añadirla a otro perfil se convierte y valida antes
        de ocupar una plaza. Los .txt de Champions usan los valores SP (0–32) en la línea EVs;
        impórtalos con Champions seleccionado.
      </p>
      {invalid && (
        <p className="error" role="alert">
          No se pudo restaurar la biblioteca. El guardado anterior se conserva hasta que guardes o
          importes una configuración.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {visible.length ? (
        <div className="library-table-scroll">
          <table className="library-table">
            <caption className="sr-only">
              Configuraciones guardadas con reparto de EVs o SP, naturaleza y movimientos
            </caption>
            <thead>
              <tr>
                <th>Pokémon / Configuración</th>
                <th>Perfil</th>
                <th>
                  <span>Reparto EVs / SP</span>
                  <div className="spread-grid">
                    {['PS', 'Atk', 'Def', 'SpA', 'SpD', 'Vel'].map((stat) => (
                      <span key={stat}>{stat}</span>
                    ))}
                  </div>
                </th>
                <th>Naturaleza</th>
                <th>Movimientos</th>
                <th>Habilidad / Objeto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => {
                const m = entry.member;
                return (
                  <tr key={entry.id}>
                    <td>
                      <div className="library-pokemon">
                        <Sprite member={m} />
                        <div>
                          <strong>{m.data.name}</strong>
                          <span>{entry.name}</span>
                          <small>
                            Nv. {m.level} ·{' '}
                            {m.gender === 'M' ? '♂' : m.gender === 'F' ? '♀' : 'Sin sexo'}
                            {m.shiny ? ' · ✨' : ''}
                          </small>
                          <Types types={m.data.types} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`profile-badge ${entry.gen === 0 ? 'champions' : ''}`}>
                        {mechanicsLabel(entry.gen)}
                      </span>
                    </td>
                    <td>
                      <div className="spread-grid values">
                        {stats.map((stat) => (
                          <b key={stat}>{m.evs[stat]}</b>
                        ))}
                      </div>
                      <small>
                        {stats.reduce((sum, stat) => sum + m.evs[stat], 0)} /{' '}
                        {trainingLimits(entry.gen).total} {trainingLimits(entry.gen).label}
                      </small>
                      <small className="library-ivs">
                        IVs: {stats.map((stat) => m.ivs[stat]).join(' / ')}
                      </small>
                    </td>
                    <td>
                      <span className="library-nature">{natureLabel(m.nature)}</span>
                    </td>
                    <td>
                      <div className="library-moves">
                        {m.moves.filter(Boolean).map((move) => (
                          <span key={move}>{move}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <strong className="library-ability">{m.ability || 'Sin habilidad'}</strong>
                      <span className="library-item">{m.item || 'Sin objeto'}</span>
                    </td>
                    <td>
                      <div className="library-actions">
                        <button
                          className="button primary compact"
                          disabled={busy || fileBusy || teams[team].slots.every(Boolean)}
                          aria-label={`Añadir ${entry.name} a ${teams[team].name}`}
                          onClick={() => void onAdd(entry, team)}
                        >
                          <Plus size={15} />
                          Añadir
                        </button>
                        <button
                          className="button secondary compact"
                          aria-label={`Descargar ${entry.name} .txt`}
                          onClick={() => downloadConfiguration(entry)}
                        >
                          <Download size={14} />
                          .txt
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Renombrar ${entry.name}`}
                          onClick={() => {
                            setRenaming(entry);
                            setName(entry.name);
                            setError('');
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="button danger compact"
                          disabled={busy || fileBusy}
                          aria-label={`Eliminar ${entry.name}`}
                          onClick={() => {
                            setDeleting(entry);
                            setError('');
                          }}
                        >
                          <Trash2 size={14} />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="library-empty">
          <FolderHeart size={44} />
          <h2>{query ? 'No hay coincidencias' : 'Tu próxima estrategia merece guardarse'}</h2>
          <p>
            {query
              ? 'Prueba otro nombre, naturaleza o movimiento.'
              : 'En el editor, pulsa «Guardar configuración». También puedes guardar un Pokémon seleccionado o importar un archivo Showdown.'}
          </p>
        </div>
      )}
      {renaming && (
        <Modal title="Renombrar configuración" onClose={() => setRenaming(null)}>
          <label>
            Nombre de configuración
            <input
              autoFocus
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <footer className="modal-footer">
            <button
              className="button primary"
              disabled={!name.trim()}
              onClick={() => {
                try {
                  onRename(renaming, name.trim());
                  setRenaming(null);
                } catch (e) {
                  setError(errorText(e));
                }
              }}
            >
              Guardar nombre
            </button>
          </footer>
        </Modal>
      )}
      {deleting && (
        <Modal title="Eliminar configuración" onClose={() => setDeleting(null)}>
          <p>¿Quieres eliminar «{deleting.name}» de tu biblioteca?</p>
          <p className="small muted">Los Pokémon que hayas añadido a los equipos se conservan.</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <footer className="modal-footer">
            <button className="button secondary" onClick={() => setDeleting(null)}>
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={busy || fileBusy}
              onClick={() => {
                try {
                  onDelete(deleting);
                  setDeleting(null);
                } catch (e) {
                  setError(errorText(e));
                }
              }}
            >
              Eliminar configuración
            </button>
          </footer>
        </Modal>
      )}
    </section>
  );
}
