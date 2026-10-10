import { generations, id, type Gen, type PokemonData, type Spread } from './model';
const API = 'https://pokeapi.co/api/v2/';
const memory = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(path: string): Promise<T> {
  if (memory.has(path)) return memory.get(path) as T;
  try {
    const cached = localStorage.getItem('ptl-api:' + path);
    if (cached) {
      const c = JSON.parse(cached);
      if (Date.now() - c.time < 7 * 86400000) {
        memory.set(path, c.data);
        return c.data;
      }
    }
  } catch {
    /* Cache is optional. */
  }
  if (pending.has(path)) return pending.get(path) as Promise<T>;
  const p = (async () => {
    const response = await fetch(API + path, { signal: AbortSignal.timeout(20000) });
    if (!response.ok)
      throw new ApiError(
        response.status,
        response.status === 404
          ? 'Pokémon no encontrado en PokéAPI.'
          : 'No se pudo consultar PokéAPI. Inténtalo de nuevo.',
      );
    const data = await response.json();
    memory.set(path, data);
    try {
      localStorage.setItem('ptl-api:' + path, JSON.stringify({ time: Date.now(), data }));
    } catch {}
    return data;
  })();
  pending.set(path, p);
  try {
    return await p;
  } finally {
    pending.delete(path);
  }
}
interface Named {
  name: string;
  url: string;
}
interface RawPokemon {
  id: number;
  name: string;
  species: Named;
  types: { slot: number; type: Named }[];
  stats: { base_stat: number; stat: Named }[];
  abilities: { ability: Named | null; slot?: number }[];
  past_abilities?: { generation: Named; abilities: { ability: Named | null; slot: number }[] }[];
  past_types?: { generation: Named; types: RawPokemon['types'] }[];
  past_stats?: { generation: Named; stats: RawPokemon['stats'] }[];
  moves: { move: Named; version_group_details: { version_group: Named }[] }[];
  sprites: {
    front_default: string;
    front_shiny: string;
    other: { 'official-artwork': { front_default: string; front_shiny: string } };
  };
}
interface Species {
  gender_rate: number;
  generation: Named;
}
interface Version {
  name: string;
  generation: Named;
}
export const names = (gen: Gen, kind: 'species' | 'moves' | 'abilities' | 'items' | 'natures') =>
  Array.from<{ name: string }>(generations.get(gen)[kind])
    .map((x) => x.name)
    .sort((a, b) => a.localeCompare(b));
const aliases: Record<string, string> = {
  nidoranf: 'nidoran-f',
  nidoranm: 'nidoran-m',
  mrmime: 'mr-mime',
  mimejr: 'mime-jr',
  mrrime: 'mr-rime',
  farfetchd: 'farfetchd',
  sirfetchd: 'sirfetchd',
  basculin: 'basculin-red-striped',
  indeedee: 'indeedee-male',
  indeedeef: 'indeedee-female',
  basculegion: 'basculegion-male',
  basculegionf: 'basculegion-female',
  taurospaldeacombat: 'tauros-paldea-combat-breed',
  taurospaldeablaze: 'tauros-paldea-blaze-breed',
  taurospaldeaaqua: 'tauros-paldea-aqua-breed',
  ogerpon: 'ogerpon',
  ogerponwellspring: 'ogerpon-wellspring-mask',
  ogerponhearthflame: 'ogerpon-hearthflame-mask',
  ogerponcornerstone: 'ogerpon-cornerstone-mask',
  meowsticf: 'meowstic-female',
  basculinbluestriped: 'basculin-blue-striped',
  basculinwhitestriped: 'basculin-white-striped',
  wishiwashischool: 'wishiwashi-school',
  eiscuenoice: 'eiscue-noice',
  urshifu: 'urshifu-single-strike',
  urshifurapidstrike: 'urshifu-rapid-strike',
  toxtricity: 'toxtricity-amped',
  aegislash: 'aegislash-shield',
  darmanitan: 'darmanitan-standard',
  darmanitangalar: 'darmanitan-galar-standard',
  lycanroc: 'lycanroc-midday',
  wishiwashi: 'wishiwashi-solo',
  mimikyu: 'mimikyu-disguised',
  eiscue: 'eiscue-ice',
  morpeko: 'morpeko-full-belly',
  zygarde: 'zygarde-50',
  giratina: 'giratina-altered',
  landorus: 'landorus-incarnate',
  tornadus: 'tornadus-incarnate',
  thundurus: 'thundurus-incarnate',
  enamorus: 'enamorus-incarnate',
  keldeo: 'keldeo-ordinary',
  meloetta: 'meloetta-aria',
  deoxys: 'deoxys-normal',
  shaymin: 'shaymin-land',
  wormadam: 'wormadam-plant',
  pumpkaboo: 'pumpkaboo-average',
  gourgeist: 'gourgeist-average',
  meowstic: 'meowstic-male',
  oricorio: 'oricorio-baile',
  minior: 'minior-red-meteor',
  dudunsparce: 'dudunsparce-two-segment',
  squawkabilly: 'squawkabilly-green-plumage',
  maushold: 'maushold-family-of-four',
  palafin: 'palafin-zero',
  tatsugiri: 'tatsugiri-curly',
};
export async function loadPokemon(input: string, gen: Gen): Promise<PokemonData> {
  const canonical = names(gen, 'species').find((n) => id(n) === id(input));
  if (!canonical) throw new Error('Selecciona una especie válida para esta generación.');
  let slug =
    aliases[id(canonical)] ||
    canonical
      .toLowerCase()
      .replace(/♀/g, '-f')
      .replace(/♂/g, '-m')
      .replace(/[.’':]/g, '')
      .replace(/\s+/g, '-');
  slug = slug
    .replace(/-alola$/, '-alola')
    .replace(/-galar$/, '-galar')
    .replace(/-hisui$/, '-hisui')
    .replace(/-paldea$/, '-paldea');
  let raw: RawPokemon;
  try {
    raw = await request<RawPokemon>('pokemon/' + slug);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 404) throw e;
    // Resolve remaining form naming differences using the API's own index.
    const list = await request<{ results: Named[] }>('pokemon?limit=100000');
    const found = list.results.find((p) => id(p.name) === id(canonical));
    if (found) raw = await request<RawPokemon>('pokemon/' + found.name);
    else {
      // Some typed/cosmetic forms are exposed only through pokemon-form.
      const form = await request<{
        pokemon: Named;
        types: RawPokemon['types'];
        sprites: Pick<RawPokemon['sprites'], 'front_default' | 'front_shiny'>;
      }>('pokemon-form/' + slug);
      const base = await request<RawPokemon>('pokemon/' + form.pokemon.name);
      raw = {
        ...base,
        types: form.types?.length ? form.types : base.types,
        sprites: {
          ...base.sprites,
          front_default: form.sprites.front_default || base.sprites.front_default,
          front_shiny: form.sprites.front_shiny || base.sprites.front_shiny,
          other: {
            'official-artwork': {
              front_default:
                form.sprites.front_default || base.sprites.other['official-artwork'].front_default,
              front_shiny:
                form.sprites.front_shiny || base.sprites.other['official-artwork'].front_shiny,
            },
          },
        },
      };
    }
  }
  const [species, versions] = await Promise.all([
    request<Species>('pokemon-species/' + raw.species.name),
    request<{ results: Named[] }>('version-group?limit=100'),
  ]);
  const versionData = await Promise.all(
    versions.results.map((v) => request<Version>('version-group/' + v.name)),
  );
  const versionSet = new Set(
    versionData
      .filter((v) => Number(v.generation.url.match(/\/(\d+)\/$/)?.[1]) === gen)
      .map((v) => v.name),
  );
  const g = generations.get(gen);
  const genNumber = (generation: Named) => Number(generation.url.match(/\/(\d+)\/$/)?.[1]);
  const historical = <T extends { generation: Named }>(entries: T[] = []) =>
    entries
      .filter((entry) => gen <= genNumber(entry.generation))
      .sort((a, b) => genNumber(b.generation) - genNumber(a.generation));
  const abilitySlots = new Map(
    raw.abilities.map((ability, index) => [ability.slot ?? index + 1, ability.ability]),
  );
  for (const past of historical(raw.past_abilities))
    for (const ability of past.abilities) abilitySlots.set(ability.slot, ability.ability);
  let types = raw.types;
  for (const past of historical(raw.past_types)) types = past.types;
  const statValues = new Map(raw.stats.map((stat) => [stat.stat.name, stat]));
  for (const past of historical(raw.past_stats))
    for (const stat of past.stats) statValues.set(stat.stat.name, stat);
  const moveMap = new Map(Array.from(g.moves).map((m) => [id(m.name), String(m.name)]));
  const abilityMap = new Map(Array.from(g.abilities).map((a) => [id(a.name), String(a.name)]));
  const baseStats: Spread = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const mapping: Record<string, keyof Spread> = {
    hp: 'hp',
    attack: 'atk',
    defense: 'def',
    'special-attack': 'spa',
    'special-defense': 'spd',
    speed: 'spe',
  };
  for (const s of statValues.values()) baseStats[mapping[s.stat.name]] = s.base_stat;
  const artwork = raw.sprites.other['official-artwork'];
  return {
    apiName: raw.name,
    name: canonical,
    number: raw.id,
    types: [...types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
    baseStats,
    abilities: Array.from(abilitySlots.values())
      .map((a) => (a ? abilityMap.get(id(a.name)) : undefined))
      .filter((a): a is string => !!a),
    moves: raw.moves
      .filter((m) => m.version_group_details.some((v) => versionSet.has(v.version_group.name)))
      .map((m) => moveMap.get(id(m.move.name)))
      .filter((m): m is string => !!m)
      .sort(),
    sprite: artwork.front_default || raw.sprites.front_default || '',
    shinySprite: artwork.front_shiny || raw.sprites.front_shiny || artwork.front_default || '',
    genders:
      species.gender_rate === -1
        ? ['N']
        : species.gender_rate === 0
          ? ['M']
          : species.gender_rate === 8
            ? ['F']
            : ['M', 'F'],
  };
}
