import snapshot from './data/wiki.json';
import { generations, id, stats, type Gen, type Spread } from './model';
import { moveInfo, searchText, typeLabels, categoryLabels, type MoveCategory } from './moves';
export type WikiKind = 'pokemon' | 'abilities' | 'moves' | 'items';
export const wikiKindLabels = {
  pokemon: 'Pokémon',
  abilities: 'Habilidades',
  moves: 'Movimientos',
  items: 'Objetos',
};
interface Effect {
  chance?: number;
  status?: string;
  volatileStatus?: string;
  boosts?: Record<string, number>;
  self?: Effect;
}
interface Profile {
  abilities?: Record<string, string>;
  short?: string;
  description?: string;
  nonstandard?: string;
  accuracy?: number | boolean;
  pp?: number;
  priority?: number;
  secondary?: Effect | null;
  secondaries?: Effect[] | null;
  self?: Effect | null;
}
interface RecordData {
  name: string;
  es?: string;
  gen: number;
  num?: number;
  sprite?: number;
  slug?: string;
  noPPBoosts?: boolean;
  profiles: Record<string, Profile>;
}
const catalog = snapshot as unknown as Record<WikiKind, Record<string, RecordData>>;
interface Base {
  kind: WikiKind;
  id: string;
  name: string;
  localizedName: string;
  nonstandard?: string;
}
export interface WikiPokemon extends Base {
  kind: 'pokemon';
  number: number;
  types: string[];
  abilities: string[];
  hiddenAbility: string | null;
  baseStats: Readonly<Spread>;
  sprite?: number;
}
export interface WikiMove extends Base {
  kind: 'moves';
  type: string;
  category: MoveCategory;
  power: number;
  accuracy: number | null | undefined;
  pp: number | undefined;
  basePP: number | undefined;
  maxPP: number | undefined;
  priority: number;
  description: string;
  detail: string;
  effects: string[];
}
export interface WikiNamed extends Base {
  kind: 'abilities' | 'items';
  description: string;
  detail: string;
  slug?: string;
}
export type WikiEntry = WikiPokemon | WikiMove | WikiNamed;
function profile(entry: RecordData, gen: Gen) {
  let result = entry.profiles[9] || {};
  if (gen === 0) return entry.profiles[0] || result;
  for (let era = 8; era >= gen; era--) if (entry.profiles[era]) result = entry.profiles[era];
  return result;
}
const effectStats: Record<string, string> = {
  atk: 'Ataque',
  def: 'Defensa',
  spa: 'At. Esp.',
  spd: 'Def. Esp.',
  spe: 'Velocidad',
  accuracy: 'precisión',
  evasion: 'evasión',
  spc: 'Especial',
};
const statuses: Record<string, string> = {
  brn: 'quemar',
  par: 'paralizar',
  psn: 'envenenar',
  tox: 'envenenar gravemente',
  slp: 'dormir',
  frz: 'congelar',
  confusion: 'confundir',
  flinch: 'hacer retroceder',
};
function effectText(effect: Effect, self = false): string[] {
  const subject = self ? 'al usuario' : 'al objetivo';
  const prefix = effect.chance === undefined ? '' : `${effect.chance}% de `;
  const result: string[] = [],
    actions: string[] = [];
  const status = effect.status || effect.volatileStatus;
  if (status && statuses[status]) actions.push(statuses[status]);
  for (const [stat, stages] of Object.entries(effect.boosts || {}))
    if (effectStats[stat] && stages)
      actions.push(
        `${stages > 0 ? 'subir' : 'bajar'} ${effectStats[stat]} ${Math.abs(stages)} nivel${Math.abs(stages) !== 1 ? 'es' : ''}`,
      );
  if (actions.length) result.push(`${prefix}${actions.join(' y ')} ${subject}.`);
  if (effect.self) result.push(...effectText({ ...effect.self, chance: effect.chance }, true));
  return result;
}
export function wikiEntry(kind: WikiKind, key: string, gen: Gen): WikiEntry | null {
  const nativeKind = kind === 'pokemon' ? 'species' : kind;
  const native = generations.get(gen)[nativeKind].get(key as never);
  if (!native) return null;
  const record =
    catalog[kind][key] ||
    (kind === 'moves' && key.startsWith('hiddenpower') ? catalog.moves.hiddenpower : undefined);
  if (!record || (gen !== 0 && record.gen > gen)) return null;
  const current = profile(record, gen),
    name = String(native.name);
  if (current.nonstandard && ['CAP', 'Custom', 'Future'].includes(current.nonstandard)) return null;
  const common = {
    kind,
    id: key,
    name,
    localizedName: record.es || name,
    nonstandard: current.nonstandard,
  };
  if (kind === 'pokemon') {
    const species = generations.get(gen).species.get(key as never)!;
    const abilityNames = current.abilities || {};
    const validAbility = (name: string | undefined) =>
      name && generations.get(gen).abilities.get(id(name) as never) ? name : null;
    const abilities = [
      ...new Set(
        [validAbility(abilityNames['0']), validAbility(abilityNames['1'])].filter(
          (value): value is string => !!value,
        ),
      ),
    ];
    const hiddenAbility = gen === 0 || gen >= 5 ? validAbility(abilityNames.H) : null;
    const localizedName =
      record.es && species.baseSpecies
        ? `${record.es} · ${name.slice(String(species.baseSpecies).length).replace(/^-/, '').replaceAll('-', ' ')}`
        : common.localizedName;
    return {
      ...common,
      kind,
      localizedName,
      number: record.num!,
      types: species.types.map((type) => type.toLowerCase()),
      abilities,
      hiddenAbility,
      baseStats: species.baseStats,
      sprite: record.sprite,
    };
  }
  if (kind === 'moves') {
    const info = moveInfo(name, gen);
    if (!info) return null;
    const basePP = current.pp ?? info.basePP;
    const maxPP =
      basePP === undefined
        ? undefined
        : record.noPPBoosts
          ? basePP
          : gen === 0
            ? (Math.min(20, basePP) / 5 + 1) * 4
            : gen <= 2 && basePP === 40
              ? 61
              : Math.floor((basePP * 8) / 5);
    const effects = [
      ...(current.secondaries || (current.secondary ? [current.secondary] : [])),
    ].flatMap((effect) => effectText(effect));
    if (current.self) effects.push(...effectText(current.self, true));
    return {
      ...common,
      kind,
      localizedName: info.localizedName,
      type: info.type,
      category: info.category,
      power: info.power,
      accuracy:
        current.accuracy === true
          ? null
          : typeof current.accuracy === 'number'
            ? current.accuracy
            : info.accuracy,
      basePP,
      pp: gen === 0 ? maxPP : basePP,
      maxPP,
      priority: current.priority ?? info.priority,
      description: current.short || info.description || 'Sin descripción disponible.',
      detail: current.description || current.short || info.description,
      effects,
    };
  }
  return {
    ...common,
    kind,
    description: current.short || 'Sin descripción disponible.',
    detail: current.description || current.short || '',
    slug: record.slug,
  };
}
const cached = new Map<Gen, WikiEntry[]>();
export function wikiCatalog(gen: Gen): WikiEntry[] {
  if (cached.has(gen)) return cached.get(gen)!;
  const g = generations.get(gen),
    result: WikiEntry[] = [];
  for (const kind of Object.keys(wikiKindLabels) as WikiKind[]) {
    const collection = kind === 'pokemon' ? g.species : g[kind];
    for (const native of collection) {
      const entry = wikiEntry(kind, String(native.id), gen);
      if (entry) result.push(entry);
    }
  }
  cached.set(gen, result);
  return result;
}
function searchable(entry: WikiEntry) {
  if (entry.kind === 'pokemon')
    return `${entry.name} ${entry.localizedName} ${entry.types.map((type) => typeLabels[type]).join(' ')} ${[...entry.abilities, entry.hiddenAbility || ''].map((ability) => `${ability} ${catalog.abilities[id(ability)]?.es || ''}`).join(' ')}`;
  if (entry.kind === 'moves')
    return `${entry.name} ${entry.localizedName} ${entry.description} ${entry.effects.join(' ')} ${typeLabels[entry.type]} ${categoryLabels[entry.category]}`;
  return `${entry.name} ${entry.localizedName} ${entry.description}`;
}
export function searchWiki(gen: Gen, query: string, kind: WikiKind | 'all' = 'all') {
  const tokens = searchText(query).trim().split(/\s+/).filter(Boolean);
  const candidates = wikiCatalog(gen).filter(
    (entry) =>
      (kind === 'all' || entry.kind === kind) &&
      tokens.every((token) => searchText(searchable(entry)).includes(token)),
  );
  const needle = searchText(query.trim());
  const rank = (entry: WikiEntry) =>
    [entry.name, entry.localizedName].some((name) => searchText(name) === needle)
      ? 0
      : [entry.name, entry.localizedName].some((name) => searchText(name).startsWith(needle))
        ? 1
        : 2;
  return candidates.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      Object.keys(wikiKindLabels).indexOf(a.kind) - Object.keys(wikiKindLabels).indexOf(b.kind) ||
      a.name.localeCompare(b.name, 'es'),
  );
}
export const wikiStatKeys = (gen: Gen) =>
  gen === 1 ? stats.filter((stat) => stat !== 'spd') : stats;
export function abilityLabel(name: string) {
  return catalog.abilities[id(name)]?.es || name;
}
