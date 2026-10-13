import { stats, type Gen, type Member, type Team } from './model';
import { activeLab, emptyWorkspace, restoreWorkspace, type Workspace } from './labs';
import {
  LIBRARY_KEY,
  TEAM_LIBRARY_KEY,
  restoreLibrary,
  restoreTeamLibrary,
  type SavedConfiguration,
  type SavedTeamConfiguration,
} from './library';
import { API_CACHE_PREFIX } from './storage';

export const APP_STORAGE_KEY = 'pokemon-team-lab:v1';
export const THEME_STORAGE_KEY = 'pokemon-team-lab:theme';
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export interface StorageBackup {
  format: 'pokemon-team-lab-backup';
  version: 1;
  exportedAt: string;
  entries: [string, string][];
}
export interface RestoredAppData {
  workspace: Workspace;
  teams: Team[];
  gen: Gen;
  constructorSaved: boolean;
  configurations: SavedConfiguration[];
  savedTeams: SavedTeamConfiguration[];
  theme: 'light' | 'dark' | null;
}
export const isAppStorageKey = (key: string) =>
  key.startsWith('pokemon-team-lab:') || key.startsWith(API_CACHE_PREFIX);
export function createStorageBackup(storage: Storage = localStorage): StorageBackup {
  const entries: [string, string][] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !isAppStorageKey(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) entries.push([key, value]);
  }
  entries.sort(([a], [b]) => a.localeCompare(b));
  return {
    format: 'pokemon-team-lab-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
  };
}
function validateMemberData(member: Member) {
  const data = member.data;
  if (
    !data ||
    typeof data.name !== 'string' ||
    typeof data.apiName !== 'string' ||
    !Number.isInteger(data.number) ||
    data.number < 1 ||
    typeof data.sprite !== 'string' ||
    typeof data.shinySprite !== 'string' ||
    !Array.isArray(data.types) ||
    !data.types.length ||
    !data.types.every((type) => typeof type === 'string') ||
    !Array.isArray(data.moves) ||
    !data.moves.every((move) => typeof move === 'string') ||
    !Array.isArray(data.abilities) ||
    !data.abilities.every((ability) => typeof ability === 'string') ||
    !Array.isArray(data.genders) ||
    !data.genders.every((gender) => ['M', 'F', 'N'].includes(gender)) ||
    !data.baseStats ||
    !stats.every((stat) => Number.isInteger(data.baseStats[stat]) && data.baseStats[stat] >= 0)
  )
    throw new Error('La copia contiene datos incompletos de un Pokémon.');
}
export function validateStorageBackup(value: unknown): {
  backup: StorageBackup;
  data: RestoredAppData;
} {
  if (!value || typeof value !== 'object')
    throw new Error('El archivo no es una copia de Pokémon Team Lab.');
  const input = value as Partial<StorageBackup>;
  if (
    input.format !== 'pokemon-team-lab-backup' ||
    input.version !== 1 ||
    typeof input.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(input.exportedAt)) ||
    !Array.isArray(input.entries)
  )
    throw new Error('Formato o versión de copia de seguridad no compatible.');
  const entries = new Map<string, string>();
  for (const entry of input.entries) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== 'string' ||
      typeof entry[1] !== 'string' ||
      !isAppStorageKey(entry[0]) ||
      entries.has(entry[0])
    )
      throw new Error('La copia contiene claves duplicadas, ajenas a la app o valores inválidos.');
    entries.set(entry[0], entry[1]);
  }
  const constructor = entries.has(APP_STORAGE_KEY)
    ? restoreWorkspace(entries.get(APP_STORAGE_KEY)!)
    : null;
  if (entries.has(APP_STORAGE_KEY) && !constructor)
    throw new Error('Los equipos del constructor de la copia no son válidos.');
  const pokemon = restoreLibrary(entries.get(LIBRARY_KEY) ?? null);
  if (pokemon.invalid) throw new Error('La biblioteca de Pokémon de la copia no es válida.');
  const teams = restoreTeamLibrary(entries.get(TEAM_LIBRARY_KEY) ?? null);
  if (teams.invalid) throw new Error('La biblioteca de equipos de la copia no es válida.');
  const theme = entries.get(THEME_STORAGE_KEY) ?? null;
  if (theme !== null && theme !== 'light' && theme !== 'dark')
    throw new Error('El tema guardado de la copia no es válido.');
  for (const team of [
    ...(constructor?.labs.flatMap((lab) => lab.teams) ?? []),
    ...teams.entries.map((entry) => entry.team),
  ])
    for (const member of team.slots) if (member) validateMemberData(member);
  for (const entry of pokemon.entries) validateMemberData(entry.member);
  const workspace = constructor ?? emptyWorkspace(),
    current = activeLab(workspace);
  return {
    backup: input as StorageBackup,
    data: {
      workspace,
      teams: current.teams,
      gen: current.gen,
      constructorSaved: !!constructor,
      configurations: pokemon.entries,
      savedTeams: teams.entries,
      theme,
    },
  };
}
export function parseStorageBackup(text: string) {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('La copia no puede superar 20 MB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo no contiene un JSON válido.');
  }
  return validateStorageBackup(parsed);
}
export function backupSummary(backup: StorageBackup) {
  const entries = new Map(backup.entries);
  function json(key: string) {
    try {
      return JSON.parse(entries.get(key) || 'null');
    } catch {
      return null;
    }
  }
  const constructor = restoreWorkspace(entries.get(APP_STORAGE_KEY) ?? null),
    pokemon = json(LIBRARY_KEY),
    teams = json(TEAM_LIBRARY_KEY);
  return {
    constructorLabs: constructor?.labs.length ?? 0,
    constructorTeams: constructor?.labs.reduce((sum, lab) => sum + lab.teams.length, 0) ?? 0,
    constructorPokemon: constructor
      ? constructor.labs
          .flatMap((lab) => lab.teams)
          .reduce(
            (sum: number, team: Team) =>
              sum + (Array.isArray(team?.slots) ? team.slots.filter(Boolean).length : 0),
            0,
          )
      : 0,
    pokemon: Array.isArray(pokemon?.entries) ? pokemon.entries.length : 0,
    teams: Array.isArray(teams?.entries) ? teams.entries.length : 0,
    caches: backup.entries.filter(([key]) => key.startsWith(API_CACHE_PREFIX)).length,
    keys: backup.entries.length,
    bytes: backup.entries.reduce((sum, [key, value]) => sum + (key.length + value.length) * 2, 0),
    theme:
      entries.get(THEME_STORAGE_KEY) === 'dark'
        ? 'Oscuro'
        : entries.get(THEME_STORAGE_KEY) === 'light'
          ? 'Claro'
          : 'Sistema',
  };
}
export class BackupRestoreError extends Error {
  constructor(
    message: string,
    public recovery: StorageBackup | null = null,
  ) {
    super(message);
    this.name = 'BackupRestoreError';
  }
}
function removeAppData(storage: Storage) {
  const keys = createStorageBackup(storage).entries.map(([key]) => key);
  for (const key of keys) storage.removeItem(key);
}
export function restoreStorageBackup(
  value: StorageBackup,
  storage: Storage = localStorage,
): RestoredAppData {
  const { backup, data } = validateStorageBackup(value);
  const previous = createStorageBackup(storage);
  // All operations are synchronous; React updates only after a completed restore.
  let changed = false;
  try {
    for (const [key] of previous.entries) {
      storage.removeItem(key);
      changed = true;
    }
    for (const [key, raw] of backup.entries) {
      storage.setItem(key, raw);
      changed = true;
    }
  } catch (error) {
    if (changed)
      try {
        removeAppData(storage);
        for (const [key, raw] of previous.entries) storage.setItem(key, raw);
      } catch {
        throw new BackupRestoreError(
          'El navegador impidió restaurar la copia y recuperar todos los datos anteriores. Descarga la copia de recuperación antes de cerrar esta página.',
          previous,
        );
      }
    const quota =
      !!error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'QuotaExceededError';
    throw new BackupRestoreError(
      `${quota ? 'La copia no cabe en el almacenamiento de este navegador.' : 'No se pudo restaurar la copia en este navegador.'} Se han conservado los datos anteriores.`,
    );
  }
  return data;
}
export function backupFilename(backup: StorageBackup) {
  return `pokemon-team-lab-backup-${new Date(backup.exportedAt)
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, 'Z')}.json`;
}
