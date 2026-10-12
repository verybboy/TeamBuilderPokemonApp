import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { DatabaseBackup, Download, Upload, ShieldCheck } from 'lucide-react';
import { Modal, errorText } from './components';
import { downloadText } from './library';
import {
  createStorageBackup,
  parseStorageBackup,
  backupSummary,
  backupFilename,
  BackupRestoreError,
  MAX_BACKUP_BYTES,
  type StorageBackup,
} from './backup';

function BackupSummary({ backup }: { backup: StorageBackup }) {
  const summary = backupSummary(backup);
  return (
    <>
      <div className="backup-counts">
        <div>
          <strong>{summary.constructorTeams}</strong>
          <span>Equipos del constructor</span>
          <small>{summary.constructorPokemon} Pokémon en sus plazas</small>
        </div>
        <div>
          <strong>{summary.teams}</strong>
          <span>Equipos guardados</span>
          <small>Mis equipos</small>
        </div>
        <div>
          <strong>{summary.pokemon}</strong>
          <span>Pokémon guardados</span>
          <small>Mis Pokémon</small>
        </div>
      </div>
      <p className="small muted backup-details">
        Tema: {summary.theme} · {summary.caches} respuestas de PokéAPI · {summary.keys} registros ·
        Aproximadamente{' '}
        {(summary.bytes / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} KiB
      </p>
    </>
  );
}
export default function BackupView({
  onRestore,
  recovery,
}: {
  onRestore: (backup: StorageBackup) => void;
  recovery: StorageBackup | null;
}) {
  const [current, setCurrent] = useState<StorageBackup | null>(null),
    [pending, setPending] = useState<StorageBackup | null>(null),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [fileBusy, setFileBusy] = useState(false),
    [filename, setFilename] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      setCurrent(createStorageBackup());
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  function download(backup: StorageBackup) {
    downloadText(
      JSON.stringify(backup, null, 2),
      backupFilename(backup),
      'application/json;charset=utf-8',
    );
  }
  function exportCurrent() {
    setError('');
    setSuccess('');
    try {
      const backup = createStorageBackup();
      download(backup);
      setCurrent(backup);
      setSuccess('Copia de seguridad exportada correctamente.');
    } catch (e) {
      setError(`No se pudo exportar la copia: ${errorText(e)}`);
    }
  }
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setSuccess('');
    setPending(null);
    setFileBusy(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('La copia no puede superar 20 MB.');
      const { backup } = parseStorageBackup(await file.text());
      setFilename(file.name);
      setPending(backup);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setFileBusy(false);
    }
  }
  return (
    <section className="backup-view">
      <div className="library-intro">
        <div>
          <p className="eyebrow">TUS DATOS, CONTIGO</p>
          <h1>Copia de seguridad</h1>
          <p>Exporta todo lo almacenado por Pokémon Team Lab e impórtalo en otro navegador.</p>
        </div>
        <DatabaseBackup size={40} className="backup-symbol" />
      </div>
      <div className="backup-card">
        <h2>Datos de este navegador</h2>
        {current && <BackupSummary backup={current} />}
        <p className="small muted">
          La copia incluye los equipos, Pokémon guardados, perfiles, PS actuales, tema y caché de
          PokéAPI, además de los demás datos locales de la app.
        </p>
        <div className="backup-actions">
          <button className="button primary" disabled={fileBusy} onClick={exportCurrent}>
            <Download size={17} />
            Exportar copia completa
          </button>
          <button
            className="button secondary"
            disabled={fileBusy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={17} />
            {fileBusy ? 'Validando archivo…' : 'Importar copia completa'}
          </button>
        </div>
        <input
          ref={fileInput}
          className="file-input"
          type="file"
          accept=".json,application/json"
          aria-label="Importar copia de seguridad JSON"
          onChange={(e) => void readFile(e)}
        />
        <p className="small muted backup-details">
          <ShieldCheck size={15} /> Archivo .json para restaurar todos tus datos. Se conserva el
          perfil original de cada configuración.
        </p>
      </div>
      {success && (
        <p className="notice" role="status">
          {success}
        </p>
      )}
      {error && !pending && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {recovery && (
        <>
          <p className="error">
            La copia de recuperación se conserva en memoria. Descárgala antes de cerrar esta página.
          </p>
          <button className="button secondary" onClick={() => download(recovery)}>
            <Download size={17} />
            Descargar copia de recuperación
          </button>
        </>
      )}
      <p className="small muted backup-help">
        Al importar, se revisará el archivo y verás un resumen antes de confirmar el reemplazo. Los
        datos de otras aplicaciones de este navegador se conservan. Los archivos Showdown .txt se
        importan desde el constructor o Mis configuraciones.
      </p>
      {pending && (
        <Modal
          title="Restaurar copia de seguridad"
          subtitle={filename}
          onClose={() => {
            setPending(null);
            setError('');
          }}
        >
          <p>
            Esta copia reemplazará los equipos del constructor, Mis equipos, Mis Pokémon, el tema y
            los demás datos locales de la app.
          </p>
          <BackupSummary backup={pending} />
          <p className="small muted">
            Creada el {new Date(pending.exportedAt).toLocaleString('es-ES')}. Puedes descargar
            primero una copia de los datos actuales.
          </p>
          <button className="button secondary compact" onClick={exportCurrent}>
            <Download size={15} />
            Descargar copia actual
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <footer className="modal-footer">
            <button
              className="button secondary"
              onClick={() => {
                setPending(null);
                setError('');
              }}
            >
              Cancelar
            </button>
            <button
              className="button primary"
              onClick={() => {
                setError('');
                try {
                  onRestore(pending);
                  setPending(null);
                  setCurrent(createStorageBackup());
                  setSuccess(
                    'Copia restaurada correctamente. Tus equipos, Pokémon y preferencias ya están disponibles.',
                  );
                } catch (e) {
                  setError(errorText(e));
                  if (e instanceof BackupRestoreError && e.recovery) {
                    setPending(null);
                  }
                }
              }}
            >
              Reemplazar datos y restaurar
            </button>
          </footer>
        </Modal>
      )}
    </section>
  );
}
