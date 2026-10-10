import { Sprite } from './components';
import { MoveType } from './MovePicker';
import { defensiveCoverage, multiplierLabel } from './coverage';
import type { Gen, Team } from './model';

export default function DefensiveCoverage({ team, gen }: { team: Team; gen: Gen }) {
  return (
    <section className="defensive-coverage">
      <h3>Cobertura defensiva</h3>
      <p className="small muted">
        Por tipos del perfil elegido, sin habilidades ni objetos. Las inmunidades cuentan como
        resistencias.
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
              {team.slots.map((member, i) => (
                <th scope="col" key={i}>
                  {member ? (
                    <>
                      <Sprite member={member} showItem={false} />
                      <span>{member.data.name}</span>
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
            {defensiveCoverage(team, gen).map((row) => (
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
