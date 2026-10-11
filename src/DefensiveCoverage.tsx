import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Sprite, Types } from './components';
import { loadPokemon } from './api';
import { MoveType } from './MovePicker';
import { coverageTeam, defensiveCoverage, multiplierLabel } from './coverage';
import { calcPokemon, megaForm, type Gen, type Member, type PokemonData, type Team } from './model';

function MegaCoverageSprite({ member, gen }: { member: Member; gen: Gen }) {
  const [images, setImages] = useState<Pick<PokemonData, 'sprite' | 'shinySprite'> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void loadPokemon(member.data.name, gen)
      .then(
        (data) => {
          if (active) setImages({ sprite: data.sprite, shinySprite: data.shinySprite });
        },
        () => {},
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [member.data.name, gen]);
  return loading ? (
    <div className="coverage-image-loading">
      <LoaderCircle
        size={22}
        className="spin"
        aria-label={`Cargando imagen de ${member.data.name}`}
      />
    </div>
  ) : (
    <div
      title={
        !images
          ? 'Imagen no disponible. La cobertura usa los tipos de la megaevolución.'
          : undefined
      }
    >
      <Sprite
        member={images ? { ...member, data: { ...member.data, ...images } } : member}
        showItem={false}
      />
    </div>
  );
}

export default function DefensiveCoverage({ team, gen }: { team: Team; gen: Gen }) {
  const forms = team.slots.map((member) => (member ? megaForm(member, gen) : null));
  const signatures = team.slots.map((member, i) =>
    member && forms[i] ? JSON.stringify([gen, member.data.name, member.item]) : '',
  );
  const signatureKey = JSON.stringify(signatures);
  const [selectedMegas, setSelectedMegas] = useState<Record<number, string>>({});
  const enabled = signatures.map((signature, i) => !!signature && selectedMegas[i] === signature);
  useEffect(() => {
    // Reset a slot's preview when its species, stone or mechanics changes, or it is emptied.
    setSelectedMegas((previous) => {
      const next = Object.fromEntries(
        Object.entries(previous).filter(
          ([index, signature]) => signatures[Number(index)] === signature,
        ),
      );
      return Object.keys(next).length === Object.keys(previous).length ? previous : next;
    });
  }, [signatureKey]);
  const preview = coverageTeam(team, gen, enabled);
  return (
    <section className="defensive-coverage">
      <h3>Cobertura defensiva</h3>
      <p className="small muted">
        Por tipos del perfil elegido. Marca Mega para usar los tipos de la forma de su megapiedra.
        Las inmunidades cuentan como resistencias; no se aplican habilidades ni otros efectos de
        objetos.
      </p>
      <div
        className="coverage-scroll"
        tabIndex={0}
        role="region"
        aria-label={`Cobertura de ${team.name}`}
      >
        <table className="coverage-table">
          <caption className="sr-only">Cobertura defensiva de {team.name}</caption>
          <thead>
            <tr>
              <th scope="col">Ataque ↓</th>
              {preview.slots.map((member, i) => (
                <th scope="col" key={i}>
                  {member ? (
                    <>
                      {enabled[i] ? (
                        <MegaCoverageSprite
                          key={`${signatures[i]}:mega`}
                          member={member}
                          gen={gen}
                        />
                      ) : (
                        <Sprite member={member} showItem={false} />
                      )}
                      <span>{member.data.name}</span>
                      <Types
                        types={calcPokemon(member, gen).types.map((type) => type.toLowerCase())}
                      />
                      {forms[i] && (
                        <label className="coverage-mega-toggle" title={forms[i]!}>
                          <input
                            type="checkbox"
                            checked={enabled[i]}
                            aria-label={`Megaevolucionar ${team.slots[i]!.data.name} para cobertura de ${team.name}, plaza ${i + 1}`}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectedMegas((previous) => {
                                const next = { ...previous };
                                if (checked) next[i] = signatures[i];
                                else delete next[i];
                                return next;
                              });
                            }}
                          />
                          Mega
                        </label>
                      )}
                    </>
                  ) : (
                    <span>Plaza {i + 1}</span>
                  )}
                </th>
              ))}
              <th scope="col">
                Total
                <br />
                débil
              </th>
              <th scope="col">
                Total
                <br />
                resiste
              </th>
            </tr>
          </thead>
          <tbody>
            {defensiveCoverage(preview, gen).map((row) => (
              <tr key={row.type}>
                <th scope="row">
                  <MoveType type={row.type} />
                </th>
                {row.multipliers.map((value, i) => (
                  <td
                    key={i}
                    className={
                      value === null
                        ? 'coverage-empty'
                        : value === 0
                          ? 'coverage-immune'
                          : value < 1
                            ? 'coverage-resist'
                            : value > 1
                              ? 'coverage-weak'
                              : ''
                    }
                  >
                    {value === null ? (
                      <span aria-label="Plaza vacía">—</span>
                    ) : value === 1 ? (
                      <span className="sr-only">1×</span>
                    ) : (
                      <span>{multiplierLabel(value)}</span>
                    )}
                  </td>
                ))}
                <td className={`coverage-total weak-${Math.min(row.weak, 3)}`}>{row.weak}</td>
                <td className={`coverage-total resist-${Math.min(row.resist, 3)}`}>{row.resist}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
