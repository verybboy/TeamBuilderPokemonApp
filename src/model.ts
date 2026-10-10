import { Generations, Pokemon, toID } from '@smogon/calc';
// Smogon's generation 0 selects the native Champions engine.
export type Gen = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const mechanicsLabel = (gen: Gen) => (gen === 0 ? 'Pokémon Champions' : `Generación ${gen}`);
export const apiGeneration = (gen: Gen): Exclude<Gen, 0> => (gen === 0 ? 9 : gen);
export const trainingLimits = (gen: Gen) =>
  gen === 0 ? { perStat: 32, total: 66, label: 'SP' } : { perStat: 252, total: 510, label: 'EVs' };
export const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
export type Stat = (typeof stats)[number];
export type Spread = Record<Stat, number>;
export const statLabels: Record<Stat, string> = {
  hp: 'PS',
  atk: 'Ataque',
  def: 'Defensa',
  spa: 'At. Esp.',
  spd: 'Def. Esp.',
  spe: 'Velocidad',
};
export const spread = (n: number): Spread => ({ hp: n, atk: n, def: n, spa: n, spd: n, spe: n });
export const generations = Generations;
export const id = (s: string) => String(toID(s));
export function natureEffect(nature: string) {
  const value = generations.get(9).natures.get(toID(nature));
  return value && value.plus !== value.minus
    ? { plus: value.plus, minus: value.minus }
    : { plus: undefined, minus: undefined };
}
export function natureLabel(nature: string) {
  const { plus, minus } = natureEffect(nature);
  return plus && minus
    ? `${nature} (↑ ${statLabels[plus]} / ↓ ${statLabels[minus]})`
    : `${nature} (neutra)`;
}
export function convertMemberProfile(member: Member, from: Gen, to: Gen): Member {
  const converted = structuredClone(member);
  if (from !== 0 && to === 0) {
    for (const stat of stats) converted.evs[stat] = Math.floor((converted.evs[stat] + 4) / 8);
    converted.level = 50;
    converted.ivs = spread(31);
  }
  if (from === 0 && to !== 0)
    for (const stat of stats)
      converted.evs[stat] = converted.evs[stat] === 0 ? 0 : converted.evs[stat] * 8 - 4;
  return converted;
}
export interface PokemonData {
  apiName: string;
  name: string;
  number: number;
  types: string[];
  baseStats: Spread;
  abilities: string[];
  moves: string[];
  sprite: string;
  shinySprite: string;
  genders: ('M' | 'F' | 'N')[];
}
export interface Member {
  data: PokemonData;
  nickname: string;
  level: number;
  ivs: Spread;
  evs: Spread;
  ability: string;
  nature: string;
  item: string;
  gender: 'M' | 'F' | 'N';
  shiny: boolean;
  moves: string[];
  hpPercent: number;
}
export interface Team {
  name: string;
  slots: (Member | null)[];
}
export const emptyTeams = (): Team[] => [
  { name: 'Equipo Aurora', slots: Array(6).fill(null) },
  { name: 'Equipo Eclipse', slots: Array(6).fill(null) },
];
export function createMember(data: PokemonData): Member {
  return {
    data,
    nickname: '',
    level: 50,
    ivs: spread(31),
    evs: spread(0),
    ability: data.abilities[0] || '',
    nature: 'Hardy',
    item: '',
    gender: data.genders[0] || 'N',
    shiny: false,
    moves: ['', '', '', ''],
    hpPercent: 100,
  };
}
export function calcPokemon(m: Member, gen: Gen, boosts: Partial<Spread> = {}, status = '') {
  const g = generations.get(gen);
  if (!g.species.get(toID(m.data.name)))
    throw new Error(`${m.data.name} no está disponible en la generación ${gen}.`);
  const p = new Pokemon(g, m.data.name, {
    level: m.level,
    ivs: m.ivs,
    evs: gen !== 0 && gen < 3 ? spread(252) : m.evs,
    nature: apiGeneration(gen) >= 3 ? m.nature : 'Hardy',
    ability: apiGeneration(gen) >= 3 ? m.ability : '',
    item: apiGeneration(gen) >= 2 ? m.item : '',
    gender: m.gender,
    boosts,
    status: status as Pokemon['status'],
  });
  p.originalCurHP = Math.round((p.maxHP() * m.hpPercent) / 100);
  return p;
}
export function megaForm(member: Member, gen: Gen): string | null {
  const g = generations.get(gen);
  const forms = g.items.get(toID(member.item))?.megaStone as
    Readonly<Record<string, string>> | undefined;
  const form = forms?.[member.data.name];
  return form && g.species.get(toID(form)) ? form : null;
}
export function withTraining(member: Member, gen: Gen, stat: Stat, value: number): Member {
  if (apiGeneration(gen) < 3)
    throw new Error('Este perfil usa entrenamiento máximo, sin EVs editables.');
  const limits = trainingLimits(gen);
  if (!Number.isInteger(value) || value < 0 || value > limits.perStat)
    throw new Error(`${limits.label}: introduce un entero de 0 a ${limits.perStat}.`);
  const evs = { ...member.evs, [stat]: value };
  if (stats.reduce((sum, stat) => sum + evs[stat], 0) > limits.total)
    throw new Error(
      `El reparto de ${limits.label} no puede superar ${limits.total}. Reduce otra estadística primero.`,
    );
  return { ...member, evs };
}
export function megaEvolve(
  member: Member,
  gen: Gen,
  images?: Pick<PokemonData, 'sprite' | 'shinySprite'>,
): Member {
  const name = megaForm(member, gen);
  if (!name) throw new Error('La megapiedra no es compatible con este Pokémon y perfil.');
  const species = generations.get(gen).species.get(toID(name))!;
  const mega = structuredClone(member);
  mega.data = {
    ...mega.data,
    name,
    apiName: name.toLowerCase(),
    types: species.types.map((type) => type.toLowerCase()),
    baseStats: { ...species.baseStats },
    abilities: species.abilities ? [species.abilities[0]] : [],
    sprite: images?.sprite || '',
    shinySprite: images?.shinySprite || images?.sprite || '',
  };
  mega.ability = mega.data.abilities[0] || '';
  return mega;
}
export function validateMember(m: Member, gen: Gen) {
  if (
    typeof m.nickname !== 'string' ||
    typeof m.shiny !== 'boolean' ||
    typeof m.ability !== 'string' ||
    typeof m.item !== 'string' ||
    typeof m.nature !== 'string' ||
    !Array.isArray(m.moves) ||
    m.moves.length !== 4 ||
    m.moves.some((move) => typeof move !== 'string')
  )
    throw new Error('Datos del Pokémon inválidos.');
  const g = generations.get(gen);
  const limits = trainingLimits(gen);
  if (!g.species.get(toID(m.data.name)))
    throw new Error('Especie no disponible en esta generación.');
  if (!Number.isInteger(m.level) || m.level < 1 || m.level > 100)
    throw new Error('El nivel debe estar entre 1 y 100.');
  if (gen === 0 && (m.level !== 50 || stats.some((stat) => m.ivs[stat] !== 31)))
    throw new Error('Champions usa nivel 50 e IVs perfectos (31).');
  for (const s of stats) {
    if (!Number.isInteger(m.ivs[s]) || m.ivs[s] < 0 || m.ivs[s] > 31)
      throw new Error('Los IVs deben estar entre 0 y 31.');
    if (!Number.isInteger(m.evs[s]) || m.evs[s] < 0 || m.evs[s] > limits.perStat)
      throw new Error(`Los ${limits.label} deben estar entre 0 y ${limits.perStat}.`);
  }
  if (stats.reduce((t, s) => t + m.evs[s], 0) > limits.total)
    throw new Error(`El total de ${limits.label} no puede superar ${limits.total}.`);
  if (!Number.isFinite(m.hpPercent) || m.hpPercent < 0 || m.hpPercent > 100)
    throw new Error('Los PS deben estar entre 0 y 100 %.');
  if (!m.data.genders.includes(m.gender)) throw new Error('Sexo incompatible con la especie.');
  if (
    apiGeneration(gen) >= 3 &&
    (!m.data.abilities.includes(m.ability) || !g.abilities.get(toID(m.ability)))
  )
    throw new Error('Habilidad no válida para esta especie y generación.');
  if (!g.natures.get(toID(m.nature))) throw new Error('Naturaleza desconocida.');
  if (m.item && !g.items.get(toID(m.item)))
    throw new Error('Objeto no disponible en esta generación.');
  const used = m.moves.filter(Boolean);
  if (!used.length) throw new Error('Selecciona al menos un movimiento.');
  if (new Set(used).size !== used.length) throw new Error('No se pueden repetir movimientos.');
  for (const move of used)
    if (!m.data.moves.includes(move) || !g.moves.get(toID(move)))
      throw new Error(`${move} no está disponible para esta especie y generación.`);
}
export function restoreTeams(raw: string | null): { teams: Team[]; gen: Gen } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (
      v.version !== 1 ||
      !Array.isArray(v.teams) ||
      v.teams.length !== 2 ||
      ![0, 1, 2, 3, 4, 5, 6, 7, 8, 9].includes(v.gen)
    )
      return null;
    for (const t of v.teams) {
      if (typeof t.name !== 'string' || t.slots?.length !== 6) return null;
      for (const m of t.slots)
        if (m) {
          if (
            !Array.isArray(m.data?.types) ||
            !Array.isArray(m.data?.moves) ||
            !Array.isArray(m.data?.abilities) ||
            typeof m.data.sprite !== 'string' ||
            m.moves?.length !== 4
          )
            return null;
          validateMember(m, v.gen);
        }
    }
    return { teams: v.teams, gen: v.gen };
  } catch {
    return null;
  }
}
