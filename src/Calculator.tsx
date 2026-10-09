import { useState } from 'react';
import { ArrowRightLeft, Swords, Wind, Sun, Leaf } from 'lucide-react';
import { Modal, Sprite, Types, errorText } from './components';
import { attackOrder, damageFor, type BattleSettings, type SideSettings } from './battle';
import {
  calcPokemon,
  generations,
  id,
  spread,
  stats,
  statLabels,
  type Gen,
  type Member,
} from './model';
const statuses = [
  ['', 'Sin estado'],
  ['brn', 'Quemado'],
  ['par', 'Paralizado'],
  ['psn', 'Envenenado'],
  ['tox', 'Gravemente envenenado'],
  ['slp', 'Dormido'],
  ['frz', 'Congelado'],
];
export default function Calculator({
  members,
  gen,
  onClose,
}: {
  members: [Member, Member];
  gen: Gen;
  onClose: () => void;
}) {
  const side = (m: Member): SideSettings => ({
    reflect: false,
    lightScreen: false,
    tailwind: false,
    abilityOn: ['Intimidate', 'Intrepid Sword', 'Dauntless Shield', 'Slow Start'].includes(
      m.ability,
    ),
    status: '',
    boosts: spread(0),
  });
  const [settings, setSettings] = useState<BattleSettings>({
      weather: '',
      terrain: '',
      doubles: gen >= 3,
      trickRoom: false,
      sides: [side(members[0]), side(members[1])],
    }),
    [selected, setSelected] = useState<[number, number]>([
      members[0].moves.findIndex(Boolean),
      members[1].moves.findIndex(Boolean),
    ]),
    [crits, setCrits] = useState<boolean[][]>([Array(4).fill(false), Array(4).fill(false)]);
  function updateSide(i: number, patch: Partial<SideSettings>) {
    setSettings((s) => {
      const sides = [...s.sides] as BattleSettings['sides'];
      sides[i] = { ...sides[i], ...patch };
      return { ...s, sides };
    });
  }
  const results = members.map((m, i) =>
    m.moves.map((move, j) => {
      try {
        return {
          result: damageFor(members[0], members[1], gen, settings, move, crits[i][j], i === 1),
          error: '',
        };
      } catch (e) {
        return { result: null, error: errorText(e) };
      }
    }),
  );
  let order: ReturnType<typeof attackOrder> | null = null,
    orderError = '';
  try {
    order = attackOrder(members[0], members[1], gen, settings, [
      members[0].moves[selected[0]],
      members[1].moves[selected[1]],
    ]);
  } catch (e) {
    orderError = errorText(e);
  }
  const weatherOptions = [
    ['', 'Sin clima'],
    ['Sun', 'Sol'],
    ['Rain', 'Lluvia'],
    ['Sand', 'Tormenta de arena'],
    ...(gen >= 3 ? [[gen >= 9 ? 'Snow' : 'Hail', gen >= 9 ? 'Nevada' : 'Granizo']] : []),
  ];
  function fighter(i: number) {
    const m = members[i],
      s = settings.sides[i],
      p = calcPokemon(m, gen, s.boosts, s.status);
    return (
      <section className={`combatant combatant-${i}`}>
        <div className="combatant-top">
          <Sprite member={m} />
          <div>
            <p className="eyebrow">
              EQUIPO {i + 1} · NIVEL {m.level}
            </p>
            <h3>{m.nickname || m.data.name}</h3>
            <Types types={p.types.map((t) => t.toLowerCase())} />
          </div>
        </div>
        <dl className="battle-meta">
          <div>
            <dt>Habilidad</dt>
            <dd>{gen >= 3 ? m.ability : '—'}</dd>
          </div>
          <div>
            <dt>Objeto</dt>
            <dd>{m.item || 'Sin objeto'}</dd>
          </div>
          <div>
            <dt>Naturaleza</dt>
            <dd>{gen >= 3 ? m.nature : '—'}</dd>
          </div>
          <div>
            <dt>PS actuales</dt>
            <dd>
              {p.curHP()} / {p.maxHP()} <span className="muted">({m.hpPercent.toFixed(1)} %)</span>
            </dd>
          </div>
        </dl>
        <div className="hp-track">
          <i style={{ width: `${m.hpPercent}%` }} />
        </div>
        <label>
          Estado
          <select value={s.status} onChange={(e) => updateSide(i, { status: e.target.value })}>
            {statuses.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {gen >= 3 && (
          <label
            className="check-line ability-toggle"
            title="Activa el efecto condicionado de habilidades como Intimidate, Flash Fire, Unburden o Slow Start."
          >
            <input
              type="checkbox"
              checked={s.abilityOn}
              onChange={(e) => updateSide(i, { abilityOn: e.target.checked })}
            />
            Efecto condicional de habilidad activo
          </label>
        )}
        <h4>Modificadores de características</h4>
        <div className="boosts">
          {stats
            .filter((t) => t !== 'hp')
            .map((t) => (
              <label key={t}>
                <span>
                  {statLabels[t]} <strong>{p.rawStats[t]}</strong>
                </span>
                <select
                  aria-label={`${statLabels[t]} ${m.data.name}`}
                  value={s.boosts[t]}
                  onChange={(e) =>
                    updateSide(i, { boosts: { ...s.boosts, [t]: Number(e.target.value) } })
                  }
                >
                  {Array.from({ length: 13 }, (_, n) => n - 6).map((n) => (
                    <option key={n} value={n}>
                      {n > 0 ? `+${n}` : n}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </div>
        <h4>
          Movimientos <span className="muted">Daño al rival</span>
        </h4>
        <div className="damage-moves">
          {m.moves.map((move, j) => {
            const r = results[i][j].result,
              moveData = generations.get(gen).moves.get(id(move) as never);
            return (
              <div className={`damage-move ${selected[i] === j ? 'active' : ''}`} key={j}>
                <button
                  disabled={!move}
                  className="move-choice"
                  onClick={() => setSelected((v) => (i === 0 ? [j, v[1]] : [v[0], j]))}
                  aria-pressed={selected[i] === j}
                >
                  <span>
                    <strong>{move || 'Sin movimiento'}</strong>
                    <small>
                      {moveData
                        ? `${moveData.type} · ${moveData.category === 'Status' ? 'Estado' : moveData.category === 'Physical' ? 'Físico' : 'Especial'} · ${moveData.basePower} potencia`
                        : '—'}
                    </small>
                  </span>
                  <b>
                    {r
                      ? r.statusMove
                        ? 'Estado'
                        : `${r.minPercent.toFixed(1)}–${r.maxPercent.toFixed(1)}%`
                      : '—'}
                  </b>
                </button>
                <label className="crit">
                  <input
                    type="checkbox"
                    aria-label={`Crítico ${move || j + 1} de ${m.data.name}`}
                    disabled={!move || r?.statusMove}
                    checked={crits[i][j]}
                    onChange={(e) =>
                      setCrits((c) =>
                        c.map((row, n) =>
                          n === i ? row.map((v, k) => (k === j ? e.target.checked : v)) : row,
                        ),
                      )
                    }
                  />
                  Crítico
                </label>
                {results[i][j].error && <p className="error small">{results[i][j].error}</p>}
              </div>
            );
          })}
        </div>
      </section>
    );
  }
  return (
    <Modal
      title="Calculadora de daño"
      subtitle={`Generación ${gen} · Motor de cálculo Smogon`}
      onClose={onClose}
      wide
    >
      <div className="battle-grid">
        {fighter(0)}
        <section className="field">
          <p className="eyebrow">
            <Swords size={14} /> CAMPO DE COMBATE
          </p>
          <div className="segmented">
            <button
              className={!settings.doubles ? 'active' : ''}
              onClick={() => setSettings((s) => ({ ...s, doubles: false }))}
            >
              Singles
            </button>
            <button
              className={settings.doubles ? 'active' : ''}
              disabled={gen < 3}
              onClick={() => setSettings((s) => ({ ...s, doubles: true }))}
            >
              Dobles
            </button>
          </div>
          <label>
            <Sun size={15} />
            Clima
            <select
              disabled={gen < 2}
              value={settings.weather}
              onChange={(e) =>
                setSettings((s) => ({ ...s, weather: e.target.value as BattleSettings['weather'] }))
              }
            >
              {weatherOptions.map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <Leaf size={15} />
            Terreno
            <select
              disabled={gen < 6}
              value={settings.terrain}
              onChange={(e) =>
                setSettings((s) => ({ ...s, terrain: e.target.value as BattleSettings['terrain'] }))
              }
            >
              <option value="">Sin terreno</option>
              <option value="Electric">Eléctrico</option>
              <option value="Grassy">Herbáceo</option>
              <option value="Misty">Brumoso</option>
              <option value="Psychic" disabled={gen < 7}>
                Psíquico
              </option>
            </select>
          </label>
          <label className="check-line room">
            <input
              disabled={gen < 4}
              type="checkbox"
              checked={settings.trickRoom}
              onChange={(e) => setSettings((s) => ({ ...s, trickRoom: e.target.checked }))}
            />
            Espacio Raro
          </label>
          <div className="field-divider" />
          {settings.sides.map((s, i) => (
            <div className="side-options" key={i}>
              <h4>Equipo {i + 1}</h4>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={s.reflect}
                  onChange={(e) => updateSide(i, { reflect: e.target.checked })}
                />
                Reflejo
              </label>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={s.lightScreen}
                  onChange={(e) => updateSide(i, { lightScreen: e.target.checked })}
                />
                Pantalla de Luz
              </label>
              <label className="check-line">
                <input
                  type="checkbox"
                  disabled={gen < 4}
                  checked={s.tailwind}
                  onChange={(e) => updateSide(i, { tailwind: e.target.checked })}
                />
                <Wind size={14} />
                Viento Afín
              </label>
            </div>
          ))}
          <p className="small muted">
            Los cambios del campo se aplican a los cálculos en ambas direcciones.
          </p>
        </section>
        {fighter(1)}
      </div>
      <div className="attack-order">
        <ArrowRightLeft size={22} />
        <div>
          <p className="eyebrow">ORDEN DE ATAQUE</p>
          <h3>{order?.text || orderError}</h3>
          <p>{order?.detail}</p>
        </div>
        {order && (
          <div className="order-speeds">
            <span>
              Velocidad{' '}
              <b>
                {order.speeds[0]} / {order.speeds[1]}
              </b>
            </span>
            <span>
              Prioridad{' '}
              <b>
                {order.priorities[0]} / {order.priorities[1]}
              </b>
            </span>
          </div>
        )}
      </div>
      <div className="result-details">
        {members.map((m, i) => {
          const r = results[i][selected[i]]?.result;
          return (
            <section key={i}>
              <p className="eyebrow">
                {m.data.name} → {members[1 - i].data.name}
              </p>
              {r ? (
                <>
                  <h3>{r.statusMove ? 'Movimiento de estado' : `${r.min}–${r.max} PS de daño`}</h3>
                  <p className="small">{r.description}</p>
                  {!r.statusMove && (
                    <details>
                      <summary>Ver tiradas de daño</summary>
                      <code>{JSON.stringify(r.rolls)}</code>
                    </details>
                  )}
                </>
              ) : (
                <p>Selecciona un movimiento válido.</p>
              )}
            </section>
          );
        })}
      </div>
      <p className="small muted calculator-note">
        El cálculo representa un ataque aislado. No simula un turno completo ni la activación
        aleatoria de efectos. Los porcentajes de daño usan los PS máximos del rival.
      </p>
    </Modal>
  );
}
