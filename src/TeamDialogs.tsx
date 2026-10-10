import { useState } from 'react';
import { Modal, Sprite, errorText } from './components';
import type { Team } from './model';

export function TeamRoster({ team }: { team: Team }) {
  return (
    <ul className="team-roster">
      {team.slots.map((member, i) => (
        <li key={i}>
          {member ? (
            <>
              <Sprite member={member} />
              <span>{member.nickname || member.data.name}</span>
            </>
          ) : (
            <span className="muted">Plaza {i + 1} vacía</span>
          )}
        </li>
      ))}
    </ul>
  );
}
export function SaveTeamDialog({
  team,
  onSave,
  onClose,
}: {
  team: Team;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(team.name),
    [error, setError] = useState('');
  return (
    <Modal title="Guardar equipo en Mis equipos" onClose={onClose}>
      <label>
        Nombre del equipo guardado
        <input autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <TeamRoster team={team} />
      <p className="small muted">
        Se guarda una copia en este navegador. Puedes consultarla y exportarla en Mis
        configuraciones → Mis equipos.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={!name.trim()}
          onClick={() => {
            try {
              onSave(name.trim());
              onClose();
            } catch (e) {
              setError(errorText(e));
            }
          }}
        >
          Guardar equipo
        </button>
      </footer>
    </Modal>
  );
}
export function ClearTeamDialog({
  team,
  onClear,
  onClose,
}: {
  team: Team;
  onClear: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1),
    [confirmation, setConfirmation] = useState('');
  return (
    <Modal
      title={step === 1 ? 'Limpiar equipo · Paso 1 de 2' : 'Confirmar limpieza · Paso 2 de 2'}
      onClose={onClose}
    >
      <p>
        Se vaciarán las {team.slots.filter(Boolean).length} plazas ocupadas de «{team.name}».
      </p>
      <TeamRoster team={team} />
      <p className="small muted">
        El nombre del equipo y las configuraciones guardadas se conservan.
      </p>
      {step === 2 && (
        <label>
          Escribe LIMPIAR para confirmar
          <input
            key="confirmation"
            autoFocus
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
          />
        </label>
      )}
      <footer className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Cancelar
        </button>
        {step === 1 ? (
          <button className="button danger" onClick={() => setStep(2)}>
            Continuar con la limpieza
          </button>
        ) : (
          <button
            className="button danger"
            disabled={confirmation !== 'LIMPIAR'}
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            Confirmar y limpiar equipo
          </button>
        )}
      </footer>
    </Modal>
  );
}
