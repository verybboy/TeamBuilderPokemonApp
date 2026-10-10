import { validateMember, id, type Gen, type Member } from './model';
import { exportShowdown } from './showdown';
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
  localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, entries }));
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
export function configurationFilename(entry: SavedConfiguration) {
  return `${id(entry.name) || 'pokemon'}-${entry.gen === 0 ? 'champions' : `gen${entry.gen}`}.txt`;
}
