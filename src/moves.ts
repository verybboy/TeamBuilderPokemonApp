import { Move } from '@smogon/calc';
import catalogData from './data/moves.json';
import { generations, id, apiGeneration, engineGeneration, type Gen } from './model';
export type MoveCategory = 'Physical' | 'Special' | 'Status';
interface CatalogEntry {
  es?: string;
  accuracy?: number | null;
  pp?: number;
  descriptions: Record<string, string>;
  history?: { before: number; accuracy?: number | null; pp?: number }[];
  champions?: { accuracy?: number | null; pp?: number; priority?: number };
  generations?: Record<string, { accuracy?: number | null; pp?: number; priority?: number }>;
  priority?: number;
  noPPBoosts?: boolean;
  variablePower?: boolean;
  fallback?: string;
}
const catalog = catalogData as Record<string, CatalogEntry>;
export function moveInfo(name: string, gen: Gen) {
  gen = engineGeneration(gen);
  const native = generations.get(gen).moves.get(id(name) as never);
  if (!native) return null;
  const entry =
      catalog[id(name)] || (id(name).startsWith('hiddenpower') ? catalog.hiddenpower : undefined),
    era = apiGeneration(gen);
  let accuracy = entry?.accuracy,
    pp = entry?.pp;
  let priority = entry?.priority ?? native.priority ?? 0;
  if (gen === 0) {
    if (entry?.champions && 'accuracy' in entry.champions) accuracy = entry.champions.accuracy;
    pp = entry?.champions?.pp ?? pp;
    priority = entry?.champions?.priority ?? priority;
    if (pp !== undefined) pp = Math.min(20, pp);
  } else {
    for (const past of entry?.history || []) {
      if (gen >= past.before) continue;
      if ('accuracy' in past) accuracy = past.accuracy;
      if (past.pp !== undefined) pp = past.pp;
    }
    for (let generation = 8; generation >= gen; generation--) {
      const past = entry?.generations?.[generation];
      if (!past) continue;
      if ('accuracy' in past) accuracy = past.accuracy;
      if (past.pp !== undefined) pp = past.pp;
      if (past.priority !== undefined) priority = past.priority;
    }
  }
  const descriptions = Object.entries(entry?.descriptions || {})
    .map(([generation, text]) => [Number(generation), text] as const)
    .sort((a, b) => b[0] - a[0]);
  const description =
    descriptions.find(([generation]) => generation <= era)?.[1] ||
    descriptions.at(-1)?.[1] ||
    entry?.fallback ||
    '';
  const category = native.category || new Move(gen, name).category;
  return {
    name: String(native.name),
    localizedName: entry?.es || String(native.name),
    type: String(native.type).toLowerCase(),
    category: category as MoveCategory,
    power: entry?.variablePower ? 0 : native.basePower,
    accuracy,
    basePP: pp,
    pp:
      pp === undefined
        ? undefined
        : entry?.noPPBoosts
          ? pp
          : gen === 0
            ? (pp / 5 + 1) * 4
            : gen <= 2 && pp === 40
              ? 61
              : Math.floor((pp * 8) / 5),
    priority,
    alwaysCrit: !!native.willCrit,
    description,
  };
}
export const accuracyLabel = (accuracy: number | null | undefined) =>
  accuracy === null ? 'Siempre' : accuracy === undefined ? '—' : `${accuracy}%`;
export const powerLabel = (power: number, category: MoveCategory) =>
  category === 'Status' ? '—' : power || 'Variable';
export const searchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export const categoryLabels = { Physical: 'Físico', Special: 'Especial', Status: 'Estado' };
export const typeLabels: Record<string, string> = {
  normal: 'Normal',
  fire: 'Fuego',
  water: 'Agua',
  electric: 'Eléctrico',
  grass: 'Planta',
  ice: 'Hielo',
  fighting: 'Lucha',
  poison: 'Veneno',
  ground: 'Tierra',
  flying: 'Volador',
  psychic: 'Psíquico',
  bug: 'Bicho',
  rock: 'Roca',
  ghost: 'Fantasma',
  dragon: 'Dragón',
  dark: 'Siniestro',
  steel: 'Acero',
  fairy: 'Hada',
};
