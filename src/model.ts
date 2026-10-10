import { Generations, Pokemon, toID } from '@smogon/calc';
export type Gen = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
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
    evs: m.evs,
    nature: gen >= 3 ? m.nature : 'Hardy',
    ability: gen >= 3 ? m.ability : '',
    item: gen >= 2 ? m.item : '',
    gender: m.gender,
    boosts,
    status: status as Pokemon['status'],
  });
  p.originalCurHP = Math.round((p.maxHP() * m.hpPercent) / 100);
  return p;
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
  if (!g.species.get(toID(m.data.name)))
    throw new Error('Especie no disponible en esta generación.');
  if (!Number.isInteger(m.level) || m.level < 1 || m.level > 100)
    throw new Error('El nivel debe estar entre 1 y 100.');
  for (const s of stats) {
    if (!Number.isInteger(m.ivs[s]) || m.ivs[s] < 0 || m.ivs[s] > 31)
      throw new Error('Los IVs deben estar entre 0 y 31.');
    if (!Number.isInteger(m.evs[s]) || m.evs[s] < 0 || m.evs[s] > 252)
      throw new Error('Los EVs deben estar entre 0 y 252.');
  }
  if (stats.reduce((t, s) => t + m.evs[s], 0) > 510)
    throw new Error('El total de EVs no puede superar 510.');
  if (!Number.isFinite(m.hpPercent) || m.hpPercent < 0 || m.hpPercent > 100)
    throw new Error('Los PS deben estar entre 0 y 100 %.');
  if (!m.data.genders.includes(m.gender)) throw new Error('Sexo incompatible con la especie.');
  if (gen >= 3 && (!m.data.abilities.includes(m.ability) || !g.abilities.get(toID(m.ability))))
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
      ![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(v.gen)
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
