import { mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { Generations } from '@smogon/calc';
const root = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/';
const id = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
async function get(url, optional = false) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (optional && response.status === 404) return '';
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.text();
}
// Literal-only AST reader. Functions and other expressions are never evaluated.
const OMIT = Symbol('omit');
function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isIdentifier(node) && node.text === 'undefined') return null;
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  )
    return -Number(node.operand.text);
  if (ts.isArrayLiteralExpression(node)) {
    const values = node.elements.map(literal);
    return values.includes(OMIT) ? OMIT : values;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const value = {};
    for (const field of node.properties) {
      if (!ts.isPropertyAssignment(field)) continue;
      const key = field.name.text;
      const item = literal(field.initializer);
      if (typeof key === 'string' && item !== OMIT) value[key] = item;
    }
    return value;
  }
  return OMIT;
}
function table(text, name) {
  const source = ts.createSourceFile('data.ts', text, ts.ScriptTarget.Latest, true);
  for (const statement of source.statements)
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (declaration.name.getText(source) === name && declaration.initializer) {
          const value = literal(declaration.initializer);
          return value === OMIT ? {} : value;
        }
  return {};
}
function csv(text) {
  const rows = [],
    row = [];
  let field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(field.replace(/\r$/, ''));
      field = '';
      if (c === '\n') {
        rows.push([...row]);
        row.length = 0;
      }
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push([...row]);
  }
  const header = rows.shift();
  return rows
    .filter((row) => row.length === header.length)
    .map((row) => Object.fromEntries(header.map((name, i) => [name, row[i]])));
}
const kinds = {
  pokemon: ['pokedex', 'Pokedex'],
  abilities: ['abilities', 'Abilities'],
  moves: ['moves', 'Moves'],
  items: ['items', 'Items'],
};
const base = {},
  texts = {},
  mods = {};
await Promise.all(
  Object.entries(kinds).map(async ([kind, [file, variable]]) => {
    base[kind] = table(await get(`${root}data/${file}.ts`), variable);
    if (kind !== 'pokemon')
      texts[kind] = table(await get(`${root}data/text/${file}.ts`), `${variable}Text`);
  }),
);
// Each classic mod inherits from the next generation; Champions inherits generation IX.
for (const gen of [8, 7, 6, 5, 4, 3, 2, 1, 0]) {
  const mod = gen === 0 ? 'champions' : `gen${gen}`;
  mods[gen] = {};
  await Promise.all(
    Object.entries(kinds).map(async ([kind, [file, variable]]) => {
      mods[gen][kind] = table(await get(`${root}data/mods/${mod}/${file}.ts`, true), variable);
    }),
  );
}
const csvRoot = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
const [abilityNames, itemNames, pokemonNames, pokemonRows, itemRows] = await Promise.all(
  ['ability_names', 'item_names', 'pokemon_species_names', 'pokemon', 'items'].map(async (file) =>
    csv(await get(`${csvRoot}${file}.csv`)),
  ),
);
function localized(rows, numberField) {
  const english = new Map(
    rows
      .filter((row) => row.local_language_id === '9')
      .map((row) => [row[numberField], id(row.name)]),
  );
  return Object.fromEntries(
    rows
      .filter((row) => row.local_language_id === '7')
      .map((row) => [english.get(row[numberField]), row.name])
      .filter(([key]) => key),
  );
}
const spanish = {
  abilities: localized(abilityNames, 'ability_id'),
  items: localized(itemNames, 'item_id'),
};
const spanishPokemon = new Map(
  pokemonNames
    .filter((row) => row.local_language_id === '7')
    .map((row) => [Number(row.pokemon_species_id), row.name]),
);
const sprites = new Map(
  pokemonRows.map((row) => [
    id(
      row.identifier
        .replace(/-female$/, 'f')
        .replace(/-male$/, '')
        .replace(/-standard$/, ''),
    ),
    Number(row.id),
  ]),
);
const itemSlugs = new Map(
  itemRows.map((row) => [
    id(row.identifier.replace(/--held$/, '').replace(/--bag$/, '')),
    row.identifier,
  ]),
);
const merged = { 9: base };
for (const gen of [8, 7, 6, 5, 4, 3, 2, 1, 0]) {
  const parent = merged[gen === 0 ? 9 : gen + 1];
  merged[gen] = {};
  for (const kind of Object.keys(kinds)) {
    const result = { ...parent[kind] };
    for (const [key, patch] of Object.entries(mods[gen][kind])) {
      if (patch === null) {
        delete result[key];
        continue;
      }
      result[key] = patch.inherit ? { ...result[key], ...patch } : patch;
    }
    merged[gen][kind] = result;
  }
}
function description(kind, key, gen, field) {
  const text = texts[kind][key] || {};
  let value = text[field] || '';
  if (gen === 0) value = text.champions?.[field] ?? value;
  else for (let era = 8; era >= gen; era--) value = text[`gen${era}`]?.[field] ?? value;
  // Text aliases are resolved using the same selected generation.
  if (value.startsWith('#') || value.startsWith('=')) {
    const target = value.slice(1).split('.')[0];
    if (target !== key && texts[kind][target]) return description(kind, target, gen, field);
  }
  return value.replace(/\s+/g, ' ').trim();
}
const catalog = {
  version: 1,
  generatedAt: new Date().toISOString(),
  pokemon: {},
  abilities: {},
  moves: {},
  items: {},
};
for (const kind of Object.keys(kinds)) {
  for (const [key, entry] of Object.entries(base[kind])) {
    if (!entry.name || (kind === 'pokemon' && (!entry.num || entry.num < 1))) continue;
    const nativeKind = kind === 'pokemon' ? 'species' : kind;
    const firstGen = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((gen) =>
      Generations.get(gen)[nativeKind].get(key),
    );
    const record = { name: entry.name, gen: entry.gen ?? firstGen ?? 9 };
    if (kind === 'pokemon') {
      record.num = entry.num;
      record.es = spanishPokemon.get(entry.num) || entry.name;
      record.sprite = sprites.get(key) ?? (!entry.forme ? entry.num : undefined);
    } else if (spanish[kind]?.[key]) record.es = spanish[kind][key];
    if (kind === 'items')
      record.slug = itemSlugs.get(key) ?? entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (kind === 'moves' && entry.noPPBoosts) record.noPPBoosts = true;
    record.profiles = {};
    for (const gen of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const current = merged[gen][kind][key];
      if (!current || (gen !== 0 && record.gen > gen)) continue;
      const profile = {};
      if (kind === 'pokemon') {
        profile.abilities =
          gen < 3 && gen !== 0
            ? {}
            : Object.fromEntries(
                Object.entries(current.abilities || {}).filter(
                  ([slot]) =>
                    slot === '0' || slot === '1' || ((gen === 0 || gen >= 5) && slot === 'H'),
                ),
              );
      } else {
        profile.short = description(kind, key, gen, 'shortDesc') || current.shortDesc || '';
        profile.description = description(kind, key, gen, 'desc') || current.desc || profile.short;
        if (kind === 'moves') {
          for (const field of [
            'accuracy',
            'pp',
            'priority',
            'secondary',
            'secondaries',
            'self',
            'drain',
            'recoil',
            'multihit',
            'volatileStatus',
            'status',
          ])
            if (current[field] !== undefined) profile[field] = current[field];
        }
      }
      if (current.isNonstandard) profile.nonstandard = current.isNonstandard;
      // Store only changes; lookup walks IX -> selected gen (Champions applies its own patch).
      record.profiles[gen] = profile;
    }
    const profiles = record.profiles;
    for (let gen = 1; gen < 9; gen++)
      if (profiles[gen] && JSON.stringify(profiles[gen]) === JSON.stringify(profiles[gen + 1]))
        delete profiles[gen];
    if (profiles[0] && JSON.stringify(profiles[0]) === JSON.stringify(profiles[9]))
      delete profiles[0];
    if (kind === 'abilities' && key === 'runaway')
      record.profiles[0] = {
        short: 'This Pokemon cannot be trapped and can switch out.',
        description:
          'This Pokemon cannot be trapped and can switch out. In Champions, Run Away clears trapping effects.',
      };
    catalog[kind][key] = record;
  }
}
if (
  !catalog.pokemon.heatran ||
  !catalog.abilities.heatproof ||
  !catalog.moves.heatwave ||
  !catalog.items.heatrock
)
  throw new Error('Incomplete wiki sources');
await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/data/wiki.json', import.meta.url), JSON.stringify(catalog) + '\n');
const license = await get(`${root}LICENSE`);
await writeFile(new URL('../src/data/showdown-LICENSE', import.meta.url), license);
console.log(
  JSON.stringify(
    Object.fromEntries(Object.keys(kinds).map((kind) => [kind, Object.keys(catalog[kind]).length])),
  ),
);
for (const gen of [0, 1, 2, 3, 5, 7, 9]) {
  const g = Generations.get(gen);
  console.log(
    JSON.stringify({
      gen,
      pokemon: [...g.species].length,
      moves: [...g.moves].length,
      abilities: [...g.abilities].length,
      items: [...g.items].length,
    }),
  );
}
