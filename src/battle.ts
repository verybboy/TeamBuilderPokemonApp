import { calculate, Field, Move, Pokemon } from '@smogon/calc';
import { checkAirLock, checkItem, getFinalSpeed } from '@smogon/calc/dist/mechanics/util';
import type { Terrain, Weather } from '@smogon/calc/dist/data/interface';
import { calcPokemon, generations, type Gen, type Member, type Spread } from './model';
import { moveInfo } from './moves';
export interface SideSettings {
  reflect: boolean;
  lightScreen: boolean;
  tailwind: boolean;
  abilityOn: boolean;
  status: string;
  boosts: Spread;
}
export interface BattleSettings {
  weather: '' | Weather;
  terrain: '' | Terrain;
  doubles: boolean;
  trickRoom: boolean;
  sides: [SideSettings, SideSettings];
}
export function fieldFor(settings: BattleSettings, reverse = false) {
  const side = (i: number) => ({
    isReflect: settings.sides[i].reflect,
    isLightScreen: settings.sides[i].lightScreen,
    isTailwind: settings.sides[i].tailwind,
  });
  return new Field({
    gameType: settings.doubles ? 'Doubles' : 'Singles',
    weather: settings.weather || undefined,
    terrain: settings.terrain || undefined,
    attackerSide: side(reverse ? 1 : 0),
    defenderSide: side(reverse ? 0 : 1),
  });
}
function fighters(a: Member, b: Member, gen: Gen, settings: BattleSettings) {
  const left = calcPokemon(a, gen, settings.sides[0].boosts, settings.sides[0].status),
    right = calcPokemon(b, gen, settings.sides[1].boosts, settings.sides[1].status);
  left.abilityOn = settings.sides[0].abilityOn;
  right.abilityOn = settings.sides[1].abilityOn;
  return [left, right] as const;
}
export function damageFor(
  a: Member,
  b: Member,
  gen: Gen,
  settings: BattleSettings,
  moveName: string,
  critical = false,
  reverse = false,
) {
  if (!moveName) return null;
  const [left, right] = fighters(a, b, gen, settings);
  const attacker = reverse ? right : left,
    defender = reverse ? left : right;
  const move = new Move(gen, moveName, {
    isCrit: critical,
    ability: attacker.ability,
    item: attacker.item,
    species: attacker.name,
    overrides: { priority: moveInfo(moveName, gen)?.priority ?? 0 },
  });
  if (attacker.curHP() === 0 || defender.curHP() === 0)
    return {
      min: 0,
      max: 0,
      minPercent: 0,
      maxPercent: 0,
      description: 'No se puede resolver este ataque: uno de los Pokémon está debilitado (0 PS).',
      statusMove: move.category === 'Status',
      rolls: 0,
    };
  const result = calculate(gen, attacker, defender, move, fieldFor(settings, reverse));
  const [min, max] = result.range();
  const hp = defender.maxHP();
  const description =
    max === 0
      ? move.category === 'Status'
        ? `${moveName} es un movimiento de estado y no causa daño directo.`
        : `${moveName} no causa daño al rival en estas condiciones (inmunidad o efecto defensivo).`
      : result.desc();
  return {
    min,
    max,
    minPercent: (min / hp) * 100,
    maxPercent: (max / hp) * 100,
    description,
    statusMove: move.category === 'Status',
    rolls: result.damage,
  };
}
function priority(p: Pokemon, name: string, gen: Gen) {
  const m = new Move(gen, name, { ability: p.ability, item: p.item, species: p.name });
  let n = moveInfo(name, gen)?.priority ?? m.priority;
  if (p.hasAbility('Prankster') && m.category === 'Status') n += 1;
  if (p.hasAbility('Gale Wings') && m.type === 'Flying' && (gen === 6 || p.curHP() === p.maxHP()))
    n += 1;
  if (
    p.hasAbility('Triage') &&
    [
      'Absorb',
      'Mega Drain',
      'Giga Drain',
      'Drain Punch',
      'Draining Kiss',
      'Oblivion Wing',
      'Parabolic Charge',
      'Horn Leech',
      'Bitter Blade',
      'Matcha Gotcha',
      'Leech Life',
      'Dream Eater',
      'Recover',
      'Roost',
      'Slack Off',
      'Soft-Boiled',
      'Milk Drink',
      'Moonlight',
      'Morning Sun',
      'Synthesis',
      'Shore Up',
      'Heal Order',
      'Rest',
      'Wish',
      'Healing Wish',
      'Lunar Dance',
      'Heal Pulse',
      'Floral Healing',
      'Life Dew',
      'Jungle Healing',
      'Strength Sap',
      'Swallow',
      'Revival Blessing',
    ].includes(name)
  )
    n += 3;
  return { n, category: m.category };
}
export function attackOrder(
  a: Member,
  b: Member,
  gen: Gen,
  settings: BattleSettings,
  moves: [string, string],
) {
  if (!moves[0] || !moves[1])
    return {
      text: 'Selecciona un movimiento por Pokémon.',
      detail: '',
      speeds: [0, 0],
      priorities: [0, 0],
    };
  const [left, right] = fighters(a, b, gen, settings),
    g = generations.get(gen),
    field = fieldFor(settings);
  checkAirLock(left, field);
  checkAirLock(right, field);
  checkItem(left, false);
  checkItem(right, false);
  const speeds = [
    getFinalSpeed(g, left, field, field.attackerSide),
    getFinalSpeed(g, right, field, field.defenderSide),
  ];
  const pr = [priority(left, moves[0], gen), priority(right, moves[1], gen)];
  // Slow items and Stall/Mycelium Might order within the same priority bracket.
  const rank = (p: Pokemon, i: number) =>
    p.hasItem('Lagging Tail', 'Full Incense')
      ? -2
      : p.hasAbility('Stall') || (p.hasAbility('Mycelium Might') && pr[i].category === 'Status')
        ? -1
        : p.hasItem('Custap Berry') &&
            p.curHP() <= Math.floor(p.maxHP() / (p.hasAbility('Gluttony') ? 2 : 4))
          ? 1
          : 0;
  let winner: number | null = null,
    reason = '';
  if (pr[0].n !== pr[1].n) {
    winner = pr[0].n > pr[1].n ? 0 : 1;
    reason = 'Prioridad del movimiento';
  } else if (rank(left, 0) !== rank(right, 1)) {
    winner = rank(left, 0) > rank(right, 1) ? 0 : 1;
    reason = 'Habilidad u objeto que altera el orden';
  } else if (speeds[0] !== speeds[1]) {
    winner = settings.trickRoom ? (speeds[0] < speeds[1] ? 0 : 1) : speeds[0] > speeds[1] ? 0 : 1;
    reason = settings.trickRoom ? 'Velocidad bajo Espacio Raro' : 'Velocidad efectiva';
  }
  const random = [left, right].some((p) => p.hasItem('Quick Claw') || p.hasAbility('Quick Draw'));
  const impaired = [left, right].some((p) => p.hasStatus('slp', 'frz', 'par') || p.curHP() === 0);
  return {
    text:
      winner === null
        ? 'Empate de velocidad · Speed Tie'
        : `${winner === 0 ? a.data.name : b.data.name} atacaría primero`,
    detail: `${winner === null ? 'Orden aleatorio entre ambos' : reason}.${random ? ' Quick Claw / Quick Draw puede alterar este orden si se activa.' : ''}${impaired ? ' El orden supone que ambos pueden actuar; los estados o 0 PS pueden impedirlo.' : ''}`,
    speeds,
    priorities: pr.map((p) => p.n),
  };
}
