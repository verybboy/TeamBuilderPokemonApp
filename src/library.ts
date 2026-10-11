import { validateMember, id, type Gen, type Member, type Team } from './model';
import { exportShowdown } from './showdown';
import { writeSavedData } from './storage';
export const LIBRARY_KEY = 'pokemon-team-lab:configurations:v1';
export interface SavedConfiguration {
  id: string;
  name: string;
  gen: Gen;
  member: Member;
  savedAt: string;
}
export function restoreLibrary(raw: string | null): {
  entries: SavedConfiguration[];
  invalid: boolean;
} {
  if (!raw) return { entries: [], invalid: false };
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.entries)) throw new Error();
    const ids = new Set<string>();
    for (const entry of value.entries) {
      if (
        typeof entry.id !== 'string' ||
        ids.has(entry.id) ||
        typeof entry.name !== 'string' ||
        !entry.name.trim() ||
        typeof entry.savedAt !== 'string' ||
        ![0, 1, 2, 3, 4, 5, 6, 7, 8, 9].includes(entry.gen)
      )
        throw new Error();
      ids.add(entry.id);
      validateMember(entry.member, entry.gen);
    }
    return { entries: value.entries, invalid: false };
  } catch {
    return { entries: [], invalid: true };
  }
}
export function addConfiguration(
  entries: SavedConfiguration[],
  member: Member,
  gen: Gen,
  name: string,
): { entries: SavedConfiguration[]; entry: SavedConfiguration } {
  validateMember(member, gen);
  const cleanName = name.trim() || `${member.data.name} · ${member.nature}`;
  const signature = exportShowdown([member], gen);
  const existing = entries.find(
    (entry) =>
      entry.gen === gen &&
      entry.name === cleanName &&
      exportShowdown([entry.member], gen) === signature &&
      entry.member.hpPercent === member.hpPercent,
  );
  if (existing) return { entries, entry: existing };
  const entry: SavedConfiguration = {
    id: crypto.randomUUID(),
    name: cleanName,
    gen,
    member: structuredClone(member),
    savedAt: new Date().toISOString(),
  };
  return { entries: [entry, ...entries], entry };
}
export function persistLibrary(entries: SavedConfiguration[]) {
  writeSavedData(LIBRARY_KEY, JSON.stringify({ version: 1, entries }));
}
export function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Keep the object URL alive until the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function configurationFilename(entry: Pick<SavedConfiguration, 'name' | 'gen'>) {
  return `${id(entry.name) || 'pokemon'}-${entry.gen === 0 ? 'champions' : `gen${entry.gen}`}.txt`;
}
export const TEAM_LIBRARY_KEY = 'pokemon-team-lab:teams:v1';
export interface SavedTeamConfiguration {
  id: string;
  name: string;
  gen: Gen;
  team: Team;
  savedAt: string;
}
function validateSavedTeam(team: Team, gen: Gen) {
  if (
    !team ||
    typeof team.name !== 'string' ||
    !team.name.trim() ||
    !Array.isArray(team.slots) ||
    team.slots.length !== 6 ||
    !team.slots.some(Boolean)
  )
    throw new Error('El equipo debe contener entre uno y seis Pokémon.');
  for (const member of team.slots) if (member !== null) validateMember(member, gen);
}
export function restoreTeamLibrary(raw: string | null): {
  entries: SavedTeamConfiguration[];
  invalid: boolean;
} {
  if (!raw) return { entries: [], invalid: false };
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.entries)) throw new Error();
    const ids = new Set<string>();
    for (const entry of value.entries) {
      if (
        typeof entry.id !== 'string' ||
        !entry.id ||
        ids.has(entry.id) ||
        typeof entry.name !== 'string' ||
        !entry.name.trim() ||
        typeof entry.savedAt !== 'string' ||
        ![0, 1, 2, 3, 4, 5, 6, 7, 8, 9].includes(entry.gen) ||
        entry.team?.name !== entry.name
      )
        throw new Error();
      ids.add(entry.id);
      validateSavedTeam(entry.team, entry.gen);
    }
    return { entries: value.entries, invalid: false };
  } catch {
    return { entries: [], invalid: true };
  }
}
function teamSignature(team: Team, gen: Gen) {
  return JSON.stringify(
    team.slots.map((member) => (member ? [exportShowdown([member], gen), member.hpPercent] : null)),
  );
}
export function addTeamConfiguration(
  entries: SavedTeamConfiguration[],
  team: Team,
  gen: Gen,
  name: string,
) {
  const cleanName = (name.trim() || team.name.trim() || 'Mi equipo').slice(0, 40);
  const snapshot = structuredClone(team);
  snapshot.name = cleanName;
  validateSavedTeam(snapshot, gen);
  const signature = teamSignature(snapshot, gen);
  const existing = entries.find(
    (entry) =>
      entry.gen === gen && entry.name === cleanName && teamSignature(entry.team, gen) === signature,
  );
  if (existing) return { entries, entry: existing };
  const entry: SavedTeamConfiguration = {
    id: crypto.randomUUID(),
    name: cleanName,
    gen,
    team: snapshot,
    savedAt: new Date().toISOString(),
  };
  return { entries: [entry, ...entries], entry };
}
export function persistTeamLibrary(entries: SavedTeamConfiguration[]) {
  writeSavedData(TEAM_LIBRARY_KEY, JSON.stringify({ version: 1, entries }));
}
export function alphabetical(a: string, b: string) {
  return a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });
}
