// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Pokemon } from '@smogon/calc';
import { createMember, emptyTeams, type PokemonData } from './model';
import { LIBRARY_KEY, TEAM_LIBRARY_KEY, addConfiguration, addTeamConfiguration } from './library';
import {
  APP_STORAGE_KEY,
  THEME_STORAGE_KEY,
  createStorageBackup,
  parseStorageBackup,
  validateStorageBackup,
  restoreStorageBackup,
  backupSummary,
  BackupRestoreError,
} from './backup';
import { request, resetApiMemory } from './api';

function member() {
  const p = new Pokemon(9, 'Torkoal');
  const data: PokemonData = {
    name: 'Torkoal',
    apiName: 'torkoal',
    number: 324,
    types: ['fire'],
    baseStats: p.species.baseStats,
    abilities: ['Drought'],
    moves: ['Heat Wave', 'Protect'],
    sprite: 'base.png',
    shinySprite: 'shiny.png',
    genders: ['M', 'F'],
  };
  const m = createMember(data);
  m.moves = ['Heat Wave', 'Protect', '', ''];
  m.hpPercent = 43;
  m.shiny = true;
  m.gender = 'F';
  m.evs.hp = 32;
  m.nature = 'Quiet';
  return m;
}
function seed() {
  const team = emptyTeams();
  team[0].name = 'Sol';
  team[0].slots[2] = member();
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({ version: 1, gen: 9, teams: team }));
  localStorage.setItem(
    LIBRARY_KEY,
    JSON.stringify({
      version: 1,
      entries: addConfiguration([], member(), 0, 'Sol defensivo').entries,
    }),
  );
  localStorage.setItem(
    TEAM_LIBRARY_KEY,
    JSON.stringify({
      version: 1,
      entries: addTeamConfiguration([], team[0], 9, 'Guardado').entries,
    }),
  );
  localStorage.setItem(THEME_STORAGE_KEY, 'dark');
  localStorage.setItem(
    'ptl-api:pokemon/torkoal',
    JSON.stringify({ time: Date.now(), data: { name: 'torkoal' } }),
  );
  localStorage.setItem('pokemon-team-lab:future-setting', 'raw setting');
  localStorage.setItem('unrelated-app', 'keep');
}
beforeEach(() => {
  localStorage.clear();
  resetApiMemory();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('Copia completa de datos locales', () => {
  it('exporta todas las claves de la app y excluye datos ajenos', () => {
    seed();
    const backup = createStorageBackup();
    expect(backup.entries).toHaveLength(6);
    expect(backup.entries.some(([key]) => key === 'unrelated-app')).toBe(false);
    expect(backupSummary(backup)).toMatchObject({
      constructorTeams: 2,
      constructorPokemon: 1,
      pokemon: 1,
      teams: 1,
      caches: 1,
      theme: 'Oscuro',
    });
    expect(parseStorageBackup(JSON.stringify(backup)).backup.entries).toEqual(backup.entries);
  });
  it('restaura datos exactos, posiciones, PS, perfiles y caché en un navegador vacío', () => {
    seed();
    const backup = createStorageBackup();
    localStorage.clear();
    localStorage.setItem('unrelated-app', 'keep');
    const data = restoreStorageBackup(parseStorageBackup(JSON.stringify(backup)).backup);
    expect(createStorageBackup().entries).toEqual(backup.entries);
    expect(localStorage.getItem('unrelated-app')).toBe('keep');
    expect(data.teams[0].slots[0]).toBeNull();
    expect(data.teams[0].slots[2]?.hpPercent).toBe(43);
    expect(data.configurations[0].gen).toBe(0);
    expect(data.savedTeams[0].gen).toBe(9);
    expect(data.theme).toBe('dark');
  });
  it('reemplaza los datos anteriores y permite una copia con registros ausentes', () => {
    seed();
    const backup = createStorageBackup();
    backup.entries = backup.entries.filter(([key]) => key === LIBRARY_KEY);
    const data = restoreStorageBackup(backup);
    expect(localStorage.getItem(APP_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(TEAM_LIBRARY_KEY)).toBeNull();
    expect(localStorage.getItem('unrelated-app')).toBe('keep');
    expect(data.configurations).toHaveLength(1);
    expect(data.constructorSaved).toBe(false);
    expect(data.gen).toBe(0);
    expect(data.teams).toEqual(emptyTeams());
  });
  it.each([
    'foreign',
    'duplicate',
    'invalid-value',
    'version',
    'invalid-library',
    'invalid-theme',
    'invalid-data',
  ])('rechaza %s antes de modificar ningún dato', (kind) => {
    seed();
    const before = createStorageBackup().entries,
      backup = createStorageBackup();
    if (kind === 'foreign') backup.entries.push(['unrelated-app', 'override']);
    if (kind === 'duplicate') backup.entries.push(backup.entries[0]);
    if (kind === 'invalid-value') (backup.entries as unknown[]).push(['pokemon-team-lab:bad', 23]);
    if (kind === 'version') (backup as unknown as { version: number }).version = 2;
    if (kind === 'invalid-library')
      backup.entries = backup.entries.map(([key, value]) => [
        key,
        key === TEAM_LIBRARY_KEY ? '{"version":1,"entries":[{}]}' : value,
      ]);
    if (kind === 'invalid-theme')
      backup.entries = backup.entries.map(([key, value]) => [
        key,
        key === THEME_STORAGE_KEY ? 'purple' : value,
      ]);
    if (kind === 'invalid-data')
      backup.entries = backup.entries.map(([key, value]) => {
        if (key !== LIBRARY_KEY) return [key, value];
        const library = JSON.parse(value);
        library.entries[0].member.data.sprite = 23;
        return [key, JSON.stringify(library)];
      });
    expect(() => restoreStorageBackup(backup)).toThrow();
    expect(createStorageBackup().entries).toEqual(before);
  });
  it('permite exportar datos corruptos para recuperarlos, pero los rechaza al importar', () => {
    localStorage.setItem(TEAM_LIBRARY_KEY, 'raw corrupt value');
    const backup = createStorageBackup();
    expect(backup.entries).toEqual([[TEAM_LIBRARY_KEY, 'raw corrupt value']]);
    expect(() => parseStorageBackup(JSON.stringify(backup))).toThrow('biblioteca de equipos');
  });
  it('conserva todos los datos anteriores si la copia supera la cuota real del navegador', () => {
    seed();
    const previous = createStorageBackup(),
      backup = createStorageBackup();
    backup.entries.push(['ptl-api:too-big', 'x'.repeat(5_000_000)]);
    expect(() => restoreStorageBackup(backup)).toThrow('Se han conservado los datos anteriores');
    expect(createStorageBackup().entries).toEqual(previous.entries);
    expect(localStorage.getItem('unrelated-app')).toBe('keep');
  });
  it('conserva los datos sin pedir recuperación si el navegador impide la primera modificación', () => {
    seed();
    const backup = createStorageBackup();
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    let error: unknown;
    try {
      restoreStorageBackup(backup);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(BackupRestoreError);
    expect((error as BackupRestoreError).recovery).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(createStorageBackup().entries).toEqual(backup.entries);
  });
  it('proporciona una copia de recuperación si el navegador impide también deshacer la importación', () => {
    seed();
    const previous = createStorageBackup(),
      backup = createStorageBackup();
    let calls = 0;
    const actual = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (++calls >= 2) throw new DOMException('Blocked', 'SecurityError');
      return actual.call(this, key, value);
    });
    let failure: unknown;
    try {
      restoreStorageBackup(backup);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(BackupRestoreError);
    expect((failure as BackupRestoreError).recovery?.entries).toEqual(previous.entries);
    expect(localStorage.getItem('unrelated-app')).toBe('keep');
  });
  it('rechaza archivos que no son JSON o no tienen el formato de copia', () => {
    expect(() => parseStorageBackup('not JSON')).toThrow('JSON válido');
    expect(() => parseStorageBackup('{}')).toThrow('Formato');
    expect(() => parseStorageBackup('null')).toThrow('copia');
  });
  it('no permite que una petición anterior sobrescriba la caché importada', async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      ),
    );
    const pending = request<{ name: string }>('backup-pending-test');
    resetApiMemory();
    localStorage.setItem(
      'ptl-api:backup-pending-test',
      JSON.stringify({ time: Date.now(), data: { name: 'imported' } }),
    );
    resolve({ ok: true, json: async () => ({ name: 'old' }) });
    await pending;
    expect(await request('backup-pending-test')).toEqual({ name: 'imported' });
    expect(JSON.parse(localStorage.getItem('ptl-api:backup-pending-test')!).data.name).toBe(
      'imported',
    );
  });
});
