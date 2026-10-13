import { useState } from 'react';
import {
  Circle,
  Swords,
  Feather,
  FlaskConical,
  Mountain,
  Gem,
  Bug,
  Ghost,
  Shield,
  Flame,
  Droplet,
  Leaf,
  Zap,
  Eye,
  Snowflake,
  Bird,
  Moon,
  Sparkles,
  RotateCcw,
  Check,
} from 'lucide-react';
import { typeLabels } from './moves';
import {
  calculatorTypes,
  specialAttacks,
  defenseAbilities,
  offensiveTypes,
  defensiveTypes,
  groupTypeMatchups,
  typeMultiplierLabel,
  type CalculatorType,
  type SpecialAttack,
  type DefenseAbility,
} from './type-calculator';

const icons = {
  normal: Circle,
  fighting: Swords,
  flying: Feather,
  poison: FlaskConical,
  ground: Mountain,
  rock: Gem,
  bug: Bug,
  ghost: Ghost,
  steel: Shield,
  fire: Flame,
  water: Droplet,
  grass: Leaf,
  electric: Zap,
  psychic: Eye,
  ice: Snowflake,
  dragon: Bird,
  dark: Moon,
  fairy: Sparkles,
};
function TypeIcon({ type }: { type: CalculatorType }) {
  const Icon = icons[type];
  return (
    <span className={`type-icon type-${type}`}>
      <Icon size={19} aria-hidden="true" />
    </span>
  );
}
export default function TypeCalculator() {
  const [mode, setMode] = useState<'attack' | 'defense'>('attack'),
    [attacks, setAttacks] = useState<CalculatorType[]>([]),
    [defenses, setDefenses] = useState<CalculatorType[]>([]),
    [specialMoves, setSpecialMoves] = useState<SpecialAttack[]>([]),
    [scrappy, setScrappy] = useState(false),
    [tintedLens, setTintedLens] = useState(false),
    [ability, setAbility] = useState<DefenseAbility>(''),
    [fullHP, setFullHP] = useState(true);
  const offensive = mode === 'attack',
    selected = offensive ? attacks : defenses;
  const groups = groupTypeMatchups(
    offensive
      ? offensiveTypes(attacks, { specialMoves, scrappy, tintedLens })
      : defensiveTypes(defenses, ability, fullHP),
  );
  const abilityInfo = defenseAbilities.find((entry) => entry.key === ability)!;
  function toggle(type: CalculatorType) {
    if (offensive)
      setAttacks((values) =>
        values.includes(type) ? values.filter((v) => v !== type) : [...values, type],
      );
    else
      setDefenses((values) =>
        values.includes(type)
          ? values.filter((v) => v !== type)
          : values.length < 2
            ? [...values, type]
            : values,
      );
  }
  function clear() {
    if (offensive) {
      setAttacks([]);
      setSpecialMoves([]);
      setScrappy(false);
      setTintedLens(false);
    } else {
      setDefenses([]);
      setAbility('');
      setFullHP(true);
    }
  }
  return (
    <section className="type-calculator">
      <header className="type-calculator-header">
        <div>
          <span className="eyebrow">VENTAJAS DE TIPO</span>
          <h1>Calculadora de tipos</h1>
          <p>Explora tus mejores ataques y las resistencias de una combinación de tipos.</p>
        </div>
        <span className="type-rules-badge">Tabla de generación IX</span>
      </header>
      <div className="type-mode" role="group" aria-label="Modo de cobertura">
        <button aria-pressed={offensive} onClick={() => setMode('attack')}>
          <Swords size={18} />
          Cobertura de ataque
        </button>
        <button aria-pressed={!offensive} onClick={() => setMode('defense')}>
          <Shield size={18} />
          Cobertura defensiva
        </button>
      </div>
      <div className="type-calculator-columns">
        <section className="type-choice-panel" aria-label="Selección de tipos">
          <div className="type-panel-heading">
            <h2>Elige los tipos</h2>
            <span>
              {selected.length} / {offensive ? 18 : 2}
            </span>
          </div>
          <p className="type-hint" id="type-selection-hint">
            {offensive
              ? 'Puedes elegir todos los tipos que quieras.'
              : 'Elige uno o dos tipos. Desmarca uno para elegir otro.'}
          </p>
          <div
            className="type-choices"
            role="group"
            aria-label="Tipos disponibles"
            aria-describedby="type-selection-hint"
          >
            {calculatorTypes.map((type) => (
              <button
                key={type}
                aria-pressed={selected.includes(type)}
                disabled={!offensive && selected.length === 2 && !selected.includes(type)}
                onClick={() => toggle(type)}
                className={`type-choice ${selected.includes(type) ? 'chosen' : ''}`}
              >
                <TypeIcon type={type} />
                <span>{typeLabels[type]}</span>
                {selected.includes(type) && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
          </div>
          {offensive ? (
            <>
              <h2>Escoger movimientos especiales</h2>
              <div className="type-extra-choices">
                {specialAttacks.map((move) => (
                  <button
                    key={move.key}
                    title={move.description}
                    aria-pressed={specialMoves.includes(move.key)}
                    onClick={() =>
                      setSpecialMoves((values) =>
                        values.includes(move.key)
                          ? values.filter((v) => v !== move.key)
                          : [...values, move.key],
                      )
                    }
                  >
                    <span className="type-toggle-dot">
                      {specialMoves.includes(move.key) && <Check size={14} />}
                    </span>
                    {move.name}
                  </button>
                ))}
              </div>
              {specialMoves.map((key) => (
                <p className="type-effect-note" key={key}>
                  {specialAttacks.find((move) => move.key === key)!.description}
                </p>
              ))}
              <h2>Escoger habilidades</h2>
              <div className="type-extra-choices">
                <button
                  aria-pressed={tintedLens}
                  onClick={() => setTintedLens(!tintedLens)}
                  title="Duplica el daño de ataques resistidos, sin superar inmunidades."
                >
                  <span className="type-toggle-dot">{tintedLens && <Check size={14} />}</span>
                  Cromolente
                </button>
                <button
                  aria-pressed={scrappy}
                  onClick={() => setScrappy(!scrappy)}
                  title="Normal y Lucha pueden golpear al tipo Fantasma."
                >
                  <span className="type-toggle-dot">{scrappy && <Check size={14} />}</span>Intrépido
                </button>
              </div>
              {(scrappy || tintedLens) && (
                <p className="type-effect-note">
                  {tintedLens && 'Cromolente duplica el daño resistido. '}
                  {scrappy &&
                    'Intrépido elimina la inmunidad de Fantasma frente a Normal y Lucha. '}
                  {scrappy && tintedLens && 'Ambos efectos se aplican a los ataques seleccionados.'}
                </p>
              )}
            </>
          ) : (
            <div className="type-defense-ability">
              <label>
                Elige habilidad
                <select
                  value={ability}
                  onChange={(e) => setAbility(e.target.value as DefenseAbility)}
                >
                  {defenseAbilities.map((entry) => (
                    <option value={entry.key} key={entry.key}>
                      {entry.name}
                      {entry.key ? ` (${entry.key})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {abilityInfo.description && (
                <p className="type-effect-note">{abilityInfo.description}</p>
              )}
              {ability === 'Tera Shell' && (
                <label className="type-full-hp">
                  <input
                    type="checkbox"
                    checked={fullHP}
                    onChange={(e) => setFullHP(e.target.checked)}
                  />
                  PS al máximo
                </label>
              )}
            </div>
          )}
          <button className="button secondary type-clear" onClick={clear}>
            <RotateCcw size={16} />
            Limpiar selección
          </button>
        </section>
        <section
          className="type-result-panel"
          aria-label="Resultados de cobertura"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="type-panel-heading">
            <h2>{offensive ? 'Cobertura de ataque' : 'Cobertura defensiva'}</h2>
          </div>
          <p className="type-hint">
            {offensive
              ? 'El mejor multiplicador disponible frente a cada tipo individual.'
              : 'Daño recibido de cada tipo de ataque.'}
          </p>
          {groups.map((group) => (
            <section
              key={group.multiplier}
              className={`type-result-group ${group.multiplier > 1 ? (offensive ? 'resist' : 'weak') : group.multiplier < 1 ? (offensive ? 'weak' : 'resist') : 'neutral'}`}
            >
              <h3>
                {offensive ? 'Inflige' : 'Sufre'} {typeMultiplierLabel(group.multiplier)}{' '}
                {offensive ? 'a' : 'por'}
                <span>{group.types.length} tipos</span>
              </h3>
              <div className="type-result-grid">
                {group.types.map((type) => (
                  <span key={type} className={`type-result type-${type}`}>
                    <TypeIcon type={type} />
                    {typeLabels[type]}
                  </span>
                ))}
              </div>
            </section>
          ))}
          <p className="type-result-footnote">
            {selected.length === 0 ? 'Sin tipos seleccionados, la tabla parte de 1×. ' : ''}
            Multiplicadores de tipos y efectos elegidos; sin potencia, STAB, objetos ni otros
            efectos de combate.
          </p>
        </section>
      </div>
    </section>
  );
}
