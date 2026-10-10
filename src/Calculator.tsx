import { useState, useEffect } from 'react';
import { ArrowRightLeft, Swords, Wind, Sun, Leaf, LoaderCircle } from 'lucide-react';
import { Modal, Sprite, Types, NatureIndicator, errorText } from './components';
import { attackOrder, damageFor, type BattleSettings, type SideSettings } from './battle';
import {
  calcPokemon,
  spread,
  stats,
  statLabels,
  apiGeneration,
  mechanicsLabel,
  natureLabel,
  megaForm,
  megaEvolve,
  trainingLimits,
  withTraining,
  type Gen,
  type Member,
  type PokemonData,
  type Stat,
} from './model';
import { loadPokemon } from './api';
import { MoveDetails } from './MovePicker';
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
  const era = apiGeneration(gen);
  const limits = trainingLimits(gen);
  const [workingMembers, setWorkingMembers] = useState<[Member, Member]>(() =>
    structuredClone(members),
  );
  const [trainingErrors, setTrainingErrors] = useState<[string, string]>(['', '']);
  const formNames = members.map((member) => megaForm(member, gen));
  const [megaEnabled, setMegaEnabled] = useState<[boolean, boolean]>([false, false]);
  const [megaImages, setMegaImages] = useState<
    Record<string, Pick<PokemonData, 'sprite' | 'shinySprite'>>
  >({});
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    formNames.forEach((name, i) => {
      if (!name || !megaEnabled[i]) return;
      const key = `${gen}:${name}`;
      if (megaImages[key]) return;
      setImageLoading((value) => ({ ...value, [key]: true }));
      setImageErrors((value) => ({ ...value, [key]: '' }));
      void loadPokemon(name, gen)
        .then(
          (data) => {
            if (active) setMegaImages((value) => ({ ...value, [key]: data }));
          },
          () => {
            if (active)
              setImageErrors((value) => ({
                ...value,
                [key]:
                  'No se pudo cargar la imagen mega. Desactiva y vuelve a activar para reintentar.',
              }));
          },
        )
        .finally(() => {
          if (active) setImageLoading((value) => ({ ...value, [key]: false }));
        });
    });
    return () => {
      active = false;
    };
  }, [gen, formNames[0], formNames[1], megaEnabled[0], megaEnabled[1]]);
  const battleMembers = workingMembers.map((member, i) =>
    megaEnabled[i] && formNames[i]
      ? megaEvolve(member, gen, megaImages[`${gen}:${formNames[i]}`])
      : member,
  ) as [Member, Member];
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
      doubles: era >= 3,
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
  function updateTraining(i: number, stat: Stat, value: number) {
    try {
      const updated = withTraining(workingMembers[i], gen, stat, value);
      setWorkingMembers((members) => (i === 0 ? [updated, members[1]] : [members[0], updated]));
      setTrainingErrors((errors) => (i === 0 ? ['', errors[1]] : [errors[0], '']));
    } catch (error) {
      setTrainingErrors((errors) =>
        i === 0 ? [errorText(error), errors[1]] : [errors[0], errorText(error)],
      );
    }
  }
  const results = battleMembers.map((m, i) =>
    m.moves.map((move, j) => {
      try {
        return {
          result: damageFor(
            battleMembers[0],
            battleMembers[1],
            gen,
            settings,
            move,
            crits[i][j],
            i === 1,
          ),
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
    order = attackOrder(battleMembers[0], battleMembers[1], gen, settings, [
      battleMembers[0].moves[selected[0]],
      battleMembers[1].moves[selected[1]],
    ]);
  } catch (e) {
    orderError = errorText(e);
  }
  const weatherOptions = [
    ['', 'Sin clima'],
    ['Sun', 'Sol'],
    ['Rain', 'Lluvia'],
    ['Sand', 'Tormenta de arena'],
    ...(era >= 3 ? [[era >= 9 ? 'Snow' : 'Hail', era >= 9 ? 'Nevada' : 'Granizo']] : []),
  ];
  function fighter(i: number) {
    const m = battleMembers[i],
      s = settings.sides[i],
      p = calcPokemon(m, gen, s.boosts, s.status);
    return (
      <section className={`combatant combatant-${i}`} aria-label={`Pokémon de equipo ${i + 1}`}>
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
        {formNames[i] && (
          <div className="mega-control">
            <label className="check-line">
              <input
                type="checkbox"
                checked={megaEnabled[i]}
                aria-label={`Megaevolucionar ${members[i].data.name} (equipo ${i + 1})`}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setMegaEnabled((value) => (i === 0 ? [enabled, value[1]] : [value[0], enabled]));
                  const pokemon = enabled ? megaEvolve(members[i], gen) : members[i];
                  updateSide(i, { abilityOn: side(pokemon).abilityOn });
                }}
              />
              Megaevolucionar
            </label>
            <span className="small muted">
              {formNames[i]} · {members[i].item}
            </span>
            {megaEnabled[i] && imageLoading[`${gen}:${formNames[i]}`] && (
              <p className="small muted">
                <LoaderCircle size={14} className="spin" /> Cargando imagen mega…
              </p>
            )}
            {megaEnabled[i] && imageErrors[`${gen}:${formNames[i]}`] && (
              <p className="small error" role="status">
                {imageErrors[`${gen}:${formNames[i]}`]}
              </p>
            )}
          </div>
        )}
        <dl className="battle-meta">
          <div>
            <dt>Habilidad</dt>
            <dd>{era >= 3 ? m.ability : '—'}</dd>
          </div>
          <div>
            <dt>Objeto</dt>
            <dd>{m.item || 'Sin objeto'}</dd>
          </div>
          <div>
            <dt>Naturaleza</dt>
            <dd>{era >= 3 ? natureLabel(m.nature) : '—'}</dd>
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
        {era >= 3 && (
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
        <div className="battle-training">
          <div className="battle-training-heading">
            <h4>Reparto de {limits.label}</h4>
            <span>
              {limits.label}: {stats.reduce((sum, stat) => sum + m.evs[stat], 0)} / {limits.total}
            </span>
          </div>
          <div className="battle-training-grid">
            {stats.map((stat) => (
              <label key={stat}>
                <span>
                  {statLabels[stat]} <NatureIndicator nature={m.nature} stat={stat} gen={gen} />
                </span>
                <input
                  type="number"
                  min={0}
                  max={limits.perStat}
                  step={1}
                  disabled={era < 3}
                  aria-label={`${limits.label} ${statLabels[stat]} de equipo ${i + 1}`}
                  value={m.evs[stat]}
                  onChange={(e) => updateTraining(i, stat, Number(e.target.value))}
                />
                <strong>{p.rawStats[stat]}</strong>
              </label>
            ))}
          </div>
          {trainingErrors[i] && (
            <p role="alert" className="error small">
              {trainingErrors[i]}
            </p>
          )}
          <button
            className="button secondary compact"
            disabled={era < 3}
            onClick={() => {
              setWorkingMembers((value) => {
                const next = [...value] as [Member, Member];
                next[i] = { ...next[i], evs: { ...members[i].evs } };
                return next;
              });
              setTrainingErrors((errors) => (i === 0 ? ['', errors[1]] : [errors[0], '']));
            }}
          >
            Restablecer reparto
          </button>
          <p className="small muted">
            {era < 3
              ? 'Este perfil usa entrenamiento máximo.'
              : 'Cambios para esta comparación. Se conserva el porcentaje de PS.'}
          </p>
        </div>
        <h4>Modificadores de características</h4>
        <div className="boosts">
          {stats
            .filter((t) => t !== 'hp')
            .map((t) => (
              <label key={t}>
                <span>
                  {statLabels[t]} <NatureIndicator nature={m.nature} stat={t} gen={gen} />
                  <strong>{p.rawStats[t]}</strong>
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
            const r = results[i][j].result;
            return (
              <div className={`damage-move ${selected[i] === j ? 'active' : ''}`} key={j}>
                <button
                  disabled={!move}
                  className="move-choice"
                  onClick={() => setSelected((v) => (i === 0 ? [j, v[1]] : [v[0], j]))}
                  aria-pressed={selected[i] === j}
                >
                  <span className="battle-move-info">
                    <strong>{move || 'Sin movimiento'}</strong>
                    <MoveDetails name={move} gen={gen} />
                  </span>
                  <b className="move-damage-value">
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
      subtitle={`${mechanicsLabel(gen)} · Motor de cálculo Smogon`}
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
              disabled={era < 3}
              onClick={() => setSettings((s) => ({ ...s, doubles: true }))}
            >
              Dobles
            </button>
          </div>
          <label>
            <Sun size={15} />
            Clima
            <select
              disabled={era < 2}
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
              disabled={era < 6}
              value={settings.terrain}
              onChange={(e) =>
                setSettings((s) => ({ ...s, terrain: e.target.value as BattleSettings['terrain'] }))
              }
            >
              <option value="">Sin terreno</option>
              <option value="Electric">Eléctrico</option>
              <option value="Grassy">Herbáceo</option>
              <option value="Misty">Brumoso</option>
              <option value="Psychic" disabled={era < 7}>
                Psíquico
              </option>
            </select>
          </label>
          <label className="check-line room">
            <input
              disabled={era < 4}
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
                  disabled={era < 4}
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
        {battleMembers.map((m, i) => {
          const r = results[i][selected[i]]?.result;
          return (
            <section key={i}>
              <p className="eyebrow">
                {m.data.name} → {battleMembers[1 - i].data.name}
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
