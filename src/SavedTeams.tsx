import { useState } from 'react';
import { ArrowUpFromLine, FolderHeart, Pencil, Trash2, Download } from 'lucide-react';
import { Modal, ShowdownExport, errorText } from './components';
import { TeamRoster } from './TeamDialogs';
import { alphabetical, configurationFilename, type SavedTeamConfiguration } from './library';
import { mechanicsLabel, type Team } from './model';
import { exportShowdown } from './showdown';

export default function SavedTeams({
  entries,
  query,
  destination,
  labName,
  teams,
  busy,
  onLoad,
  onRename,
  onDelete,
}: {
  entries: SavedTeamConfiguration[];
  query: string;
  destination: number;
  labName: string;
  teams: Team[];
  busy: boolean;
  onLoad: (entry: SavedTeamConfiguration, destination: number) => Promise<void>;
  onRename: (entry: SavedTeamConfiguration, name: string) => void;
  onDelete: (entry: SavedTeamConfiguration) => void;
}) {
  const [exporting, setExporting] = useState<SavedTeamConfiguration | null>(null),
    [renaming, setRenaming] = useState<SavedTeamConfiguration | null>(null),
    [deleting, setDeleting] = useState<SavedTeamConfiguration | null>(null),
    [loading, setLoading] = useState<{ entry: SavedTeamConfiguration; destination: number } | null>(
      null,
    ),
    [name, setName] = useState(''),
    [error, setError] = useState('');
  const visible = entries
    .filter((entry) =>
      `${entry.name} ${entry.team.slots.map((m) => m?.data.name || '').join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) => alphabetical(a.name, b.name) || alphabetical(a.id, b.id));
  async function load(entry: SavedTeamConfiguration, team: number) {
    setError('');
    try {
      await onLoad(entry, team);
      setLoading(null);
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <>
      {error && !loading && !renaming && !deleting && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {visible.length ? (
        <div className="library-table-scroll">
          <table className="library-table saved-teams-table">
            <caption className="sr-only">Equipos guardados por nombre</caption>
            <thead>
              <tr>
                <th>Nombre del equipo</th>
                <th>Perfil</th>
                <th>Pokémon</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <strong>{entry.name}</strong>
                    <small>{entry.team.slots.filter(Boolean).length} / 6 Pokémon</small>
                  </td>
                  <td>
                    <span className={`profile-badge ${entry.gen === 0 ? 'champions' : ''}`}>
                      {mechanicsLabel(entry.gen)}
                    </span>
                  </td>
                  <td>
                    <TeamRoster team={entry.team} />
                  </td>
                  <td>
                    <div className="library-actions">
                      <button
                        className="button primary compact"
                        disabled={busy}
                        aria-label={`Cargar ${entry.name} en ${teams[destination].name}`}
                        onClick={() => {
                          setError('');
                          if (teams[destination].slots.some(Boolean))
                            setLoading({ entry, destination });
                          else void load(entry, destination);
                        }}
                      >
                        <Download size={14} />
                        Cargar
                      </button>
                      <button
                        className="button secondary compact"
                        aria-label={`Exportar equipo ${entry.name}`}
                        onClick={() => setExporting(entry)}
                      >
                        <ArrowUpFromLine size={14} />
                        Exportar
                      </button>
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label={`Renombrar equipo ${entry.name}`}
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
                        disabled={busy}
                        aria-label={`Eliminar equipo ${entry.name}`}
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
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="library-empty">
          <FolderHeart size={44} />
          <h2>{query ? 'No hay coincidencias' : 'Tus equipos guardados'}</h2>
          <p>
            {query
              ? 'Prueba otro nombre de equipo o Pokémon.'
              : 'Pulsa el botón de guardar junto al nombre de un equipo en el constructor, o importa un .txt de Showdown.'}
          </p>
        </div>
      )}
      {exporting && (
        <Modal
          title="Exportar equipo a Showdown"
          subtitle={`${exporting.name} · ${mechanicsLabel(exporting.gen)}`}
          onClose={() => setExporting(null)}
        >
          <ShowdownExport
            text={exportShowdown(
              exporting.team.slots.filter((m) => m !== null),
              exporting.gen,
            )}
            filename={configurationFilename(exporting)}
            copyLabel="Copiar equipo"
          />
        </Modal>
      )}
      {loading && (
        <Modal
          title="Cargar equipo guardado"
          subtitle={`LAB de destino: ${labName}`}
          onClose={() => {
            if (!busy) setLoading(null);
          }}
        >
          <p>
            «{loading.entry.name}» reemplazará todos los Pokémon y el nombre de «
            {teams[loading.destination].name}».
          </p>
          <TeamRoster team={loading.entry.team} />
          <p className="small muted">
            El equipo se convierte y valida en el perfil del constructor antes de reemplazarlo.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <footer className="modal-footer">
            <button className="button secondary" disabled={busy} onClick={() => setLoading(null)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void load(loading.entry, loading.destination)}
            >
              {busy ? 'Validando…' : 'Reemplazar equipo'}
            </button>
          </footer>
        </Modal>
      )}
      {renaming && (
        <Modal title="Renombrar equipo guardado" onClose={() => setRenaming(null)}>
          <label>
            Nombre del equipo guardado
            <input
              autoFocus
              value={name}
              maxLength={40}
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
              disabled={!name.trim() || busy}
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
        <Modal title="Eliminar equipo guardado" onClose={() => setDeleting(null)}>
          <p>¿Quieres eliminar «{deleting.name}» de Mis equipos?</p>
          <p className="small muted">Los equipos del constructor se conservan.</p>
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
              disabled={busy}
              onClick={() => {
                try {
                  onDelete(deleting);
                  setDeleting(null);
                } catch (e) {
                  setError(errorText(e));
                }
              }}
            >
              Eliminar equipo guardado
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}
