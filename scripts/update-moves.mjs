import { mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
// Read upstream data as data only: never execute downloaded TypeScript.
const root = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.text();
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
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((name, i) => [name, r[i]])));
}
const files = ['moves', 'move_names', 'move_flavor_text', 'move_changelog', 'version_groups'];
const [tables, championsText, showdownText, previousTexts] = await Promise.all([
  Promise.all(files.map(async (file) => csv(await get(`${root}${file}.csv`)))),
  get(
    'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/champions/moves.ts',
  ),
  get('https://play.pokemonshowdown.com/data/moves.json'),
  Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      get(
        `https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen${i + 1}/moves.ts`,
      ),
    ),
  ),
]);
const [moves, names, descriptions, history, groups] = tables;
const generations = new Map(groups.map((group) => [group.id, Number(group.generation_id)]));
const clean = (value) => value.replace(/\s+/g, ' ').trim();
const toId = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const byNumber = new Map();
const catalog = {};
for (const move of moves) {
  const entry = {
    accuracy: move.accuracy ? Number(move.accuracy) : null,
    pp: Number(move.pp),
    descriptions: {},
  };
  if (!move.power && Number(move.damage_class_id) > 1) entry.variablePower = true;
  catalog[toId(move.identifier)] = entry;
  byNumber.set(move.id, entry);
}
for (const row of names) {
  if (row.local_language_id === '7' && byNumber.has(row.move_id))
    byNumber.get(row.move_id).es = row.name;
}
// Spanish game text selected by generation; repeated descriptions are collapsed.
const flavors = new Map();
for (const row of descriptions) {
  if (row.language_id === '9') {
    const entry = byNumber.get(row.move_id);
    if (entry && (!entry.fallbackRank || entry.fallbackRank < Number(row.version_group_id))) {
      entry.fallback = clean(row.flavor_text);
      entry.fallbackRank = Number(row.version_group_id);
    }
  }
  if (row.language_id !== '7') continue;
  const gen = generations.get(row.version_group_id);
  if (!gen) continue;
  const key = `${row.move_id}:${gen}`,
    rank = Number(row.version_group_id);
  if (!flavors.has(key) || flavors.get(key).rank < rank)
    flavors.set(key, { rank, text: clean(row.flavor_text) });
}
for (const [number, entry] of byNumber) {
  let previous = '';
  for (let gen = 1; gen <= 9; gen++) {
    const value = flavors.get(`${number}:${gen}`)?.text;
    if (value && value !== previous) {
      entry.descriptions[gen] = value;
      previous = value;
    }
  }
}
for (const row of history) {
  const entry = byNumber.get(row.move_id),
    before = generations.get(row.changed_in_version_group_id);
  if (!entry || !before || (!row.pp && !row.accuracy)) continue;
  const change = { before };
  if (row.pp) change.pp = Number(row.pp);
  if (row.accuracy) change.accuracy = Number(row.accuracy);
  (entry.history ||= []).push(change);
}
for (const entry of Object.values(catalog)) entry.history?.sort((a, b) => b.before - a.before);
// Supply names/details for moves absent from PokéAPI and never-miss semantics.
for (const [key, move] of Object.entries(JSON.parse(showdownText))) {
  const entry = (catalog[key] ||= {
    accuracy: move.accuracy === true ? null : move.accuracy,
    pp: move.pp,
    descriptions: {},
  });
  if (move.shortDesc) entry.fallback = move.shortDesc;
  if (move.noPPBoosts) entry.noPPBoosts = true;
  entry.priority = move.priority || 0;
  if (move.accuracy === true) entry.accuracy = null;
}
function readOverrides(text, target) {
  const parsed = ts.createSourceFile('moves.ts', text, ts.ScriptTarget.Latest, true);
  function inspect(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(parsed) === 'Moves' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          !ts.isObjectLiteralExpression(property.initializer)
        )
          continue;
        const key = property.name.getText(parsed).replace(/^['"]|['"]$/g, '');
        if (!catalog[key]) continue;
        const overrides = {};
        for (const field of property.initializer.properties) {
          if (!ts.isPropertyAssignment(field)) continue;
          const name = field.name.getText(parsed);
          if (!['pp', 'accuracy', 'priority'].includes(name)) continue;
          if (ts.isNumericLiteral(field.initializer))
            overrides[name] = Number(field.initializer.text);
          if (
            ts.isPrefixUnaryExpression(field.initializer) &&
            field.initializer.operator === ts.SyntaxKind.MinusToken &&
            ts.isNumericLiteral(field.initializer.operand)
          )
            overrides[name] = -Number(field.initializer.operand.text);
          if (field.initializer.kind === ts.SyntaxKind.TrueKeyword) overrides[name] = null;
        }
        if (Object.keys(overrides).length) target(key, overrides);
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(parsed);
}
readOverrides(championsText, (key, overrides) => {
  catalog[key].champions = overrides;
});
previousTexts.forEach((text, i) =>
  readOverrides(text, (key, overrides) => {
    (catalog[key].generations ||= {})[i + 1] = overrides;
  }),
);
for (const entry of Object.values(catalog)) delete entry.fallbackRank;
if (!catalog.heatwave || catalog.protect?.champions?.pp !== 5 || !catalog.heatwave.es)
  throw new Error('Invalid move catalog sources');
await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/data/moves.json', import.meta.url), JSON.stringify(catalog) + '\n');
console.log(
  `Saved ${Object.keys(catalog).length} moves with Spanish descriptions and accuracy/PP history.`,
);
