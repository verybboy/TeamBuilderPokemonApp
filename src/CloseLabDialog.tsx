import { useState } from 'react';
import { Modal, errorText } from './components';
import { TeamRoster } from './TeamDialogs';
import { mechanicsLabel } from './model';
import type { Lab } from './labs';

export default function CloseLabDialog({
  lab,
  lastLab,
  onClose,
  onConfirm,
}: {
  lab: Lab;
  lastLab: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [step, setStep] = useState(1),
    [confirmation, setConfirmation] = useState(''),
    [error, setError] = useState('');
  return (
    <Modal
      title={step === 1 ? 'Cerrar LAB · Paso 1 de 2' : 'Confirmar cierre · Paso 2 de 2'}
      subtitle={`${lab.name} · ${mechanicsLabel(lab.gen)}`}
      onClose={onClose}
    >
      <p>Se eliminará «{lab.name}» con sus dos equipos y todos los Pokémon que contienen.</p>
      {step === 1 &&
        lab.teams.map((team, index) => (
          <section className="lab-close-roster" key={index}>
            <h3>
              {team.name} · {team.slots.filter(Boolean).length} Pokémon
            </h3>
            <TeamRoster team={team} />
          </section>
        ))}
      <p className="small muted">
        Las configuraciones de Mis Pokémon y Mis equipos se conservan.
        {lastLab ? ' Al cerrar el último LAB se creará un LAB 1 vacío con Pokémon Champions.' : ''}
      </p>
      {step === 2 && (
        <label>
          Escribe CERRAR para confirmar
          <input
            key="confirmation"
            autoFocus
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Cancelar
        </button>
        {step === 1 ? (
          <button className="button danger" onClick={() => setStep(2)}>
            Continuar con el cierre
          </button>
        ) : (
          <button
            className="button danger"
            disabled={confirmation !== 'CERRAR'}
            onClick={() => {
              try {
                onConfirm();
                onClose();
              } catch (error) {
                setError(errorText(error));
              }
            }}
          >
            Confirmar y cerrar LAB
          </button>
        )}
      </footer>
    </Modal>
  );
}
