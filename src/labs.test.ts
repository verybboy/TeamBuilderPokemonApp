import { describe, expect, it } from 'vitest';
import { Pokemon } from '@smogon/calc';
import { createMember, emptyTeams } from './model';
import {
  activeLab,
  addLab,
  removeLab,
  emptyWorkspace,
  restoreWorkspace,
  serializeWorkspace,
} from './labs';
import { APP_STORAGE_KEY, backupSummary, validateStorageBackup } from './backup';
function member() {
  const p = new Pokemon(9, 'Pikachu');
  const m = createMember({
    name: 'Pikachu',
    apiName: 'pikachu',
    number: 25,
    types: ['electric'],
    baseStats: p.species.baseStats,
    abilities: ['Static'],
    moves: ['Thunderbolt'],
    genders: ['M', 'F'],
    sprite: 'pikachu.png',
    shinySprite: 'shiny.png',
  });
  m.moves = ['Thunderbolt', '', '', ''];
  m.hpPercent = 37;
  return m;
}
describe('LABs del constructor', () => {
  it('cierra un LAB inactivo sin alterar los demás ni el activo y libera su plaza', () => {
    let workspace = emptyWorkspace();
    for (let i = 1; i < 5; i++) workspace = addLab(workspace);
    const id = workspace.labs[1].id,
      before = structuredClone(workspace);
    const closed = removeLab(workspace, id);
    expect(closed.activeLabId).toBe(workspace.activeLabId);
    expect(closed.labs).toEqual(workspace.labs.filter((lab) => lab.id !== id));
    const renewed = addLab(closed);
    expect(renewed.labs).toHaveLength(5);
    expect(activeLab(renewed).name).toBe('LAB 2');
    expect(activeLab(renewed).id).not.toBe(id);
    expect(workspace).toEqual(before);
  });
  it('al cerrar el activo elige el vecino y al cerrar el último crea un LAB vacío', () => {
    const workspace = addLab(addLab(emptyWorkspace()));
    const closed = removeLab(workspace, workspace.activeLabId);
    expect(closed.activeLabId).toBe(workspace.labs[1].id);
    const last = removeLab(closed, closed.activeLabId);
    last.labs[0].gen = 9;
    last.labs[0].teams[0].slots[0] = member();
    const reset = removeLab(last, last.activeLabId);
    expect(reset).toEqual(emptyWorkspace());
    expect(restoreWorkspace(serializeWorkspace(reset))).toEqual(reset);
    expect(() => removeLab(workspace, 'desconocido')).toThrow(/disponible/);
  });
  it('migra el guardado anterior a LAB 1 conservando equipos, mecánica, posiciones y PS', () => {
    const teams = emptyTeams();
    teams[1].slots[4] = member();
    teams[0].name = 'Sol';
    const raw = JSON.stringify({ version: 1, gen: 9, teams });
    const result = restoreWorkspace(raw)!;
    expect(result.labs).toHaveLength(1);
    expect(activeLab(result)).toEqual({ id: 'lab-1', name: 'LAB 1', gen: 9, teams });
    expect(JSON.parse(raw).version).toBe(1);
    expect(restoreWorkspace(serializeWorkspace(result))).toEqual(result);
  });
  it('crea hasta cinco LABs vacíos e independientes y conserva el activo al restaurar', () => {
    const first = emptyWorkspace();
    first.labs[0].gen = 10;
    first.labs[0].teams[0].slots[3] = member();
    let workspace = first;
    for (let i = 1; i < 5; i++) workspace = addLab(workspace);
    expect(workspace.labs).toHaveLength(5);
    expect(activeLab(workspace).name).toBe('LAB 5');
    expect(workspace.labs[0]).toEqual(first.labs[0]);
    expect(workspace.labs[4].gen).toBe(0);
    expect(workspace.labs[4].teams).toHaveLength(2);
    expect(
      workspace.labs[4].teams.every(
        (team) => team.slots.length === 6 && team.slots.every((m) => m === null),
      ),
    ).toBe(true);
    workspace.labs[4].teams[0].name = 'Último';
    expect(first.labs[0].teams[0].name).not.toBe('Último');
    expect(() => addLab(workspace)).toThrow(/cinco/);
    expect(restoreWorkspace(serializeWorkspace(workspace))).toEqual(workspace);
    expect(JSON.parse(serializeWorkspace(workspace)).version).toBe(2);
  });
  it.each(['empty', 'six', 'duplicate', 'active', 'gen', 'teams', 'member', 'version'])(
    'rechaza %s sin aceptar LABs parcialmente válidos',
    (kind) => {
      const value = JSON.parse(serializeWorkspace(addLab(emptyWorkspace())));
      if (kind === 'empty') value.labs = [];
      if (kind === 'six') value.labs = Array(6).fill(value.labs[0]);
      if (kind === 'duplicate') value.labs[1].id = value.labs[0].id;
      if (kind === 'active') value.activeLabId = 'inexistente';
      if (kind === 'gen') value.labs[0].gen = 11;
      if (kind === 'teams') value.labs[0].teams.pop();
      if (kind === 'member') {
        value.labs[0].teams[0].slots[0] = member();
        value.labs[0].teams[0].slots[0].level = 200;
      }
      if (kind === 'version') value.version = 3;
      expect(restoreWorkspace(JSON.stringify(value))).toBeNull();
    },
  );
  it('la copia incluye todos los LABs y comprueba también los Pokémon del LAB inactivo', () => {
    const workspace = addLab(emptyWorkspace());
    workspace.labs[0].gen = 9;
    workspace.labs[0].teams[0].slots[2] = member();
    workspace.labs[1].gen = 10;
    const backup = {
      format: 'pokemon-team-lab-backup' as const,
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      entries: [[APP_STORAGE_KEY, serializeWorkspace(workspace)]] as [string, string][],
    };
    const restored = validateStorageBackup(backup).data;
    expect(restored.workspace).toEqual(workspace);
    expect(restored.gen).toBe(10);
    expect(backupSummary(backup)).toMatchObject({
      constructorLabs: 2,
      constructorTeams: 4,
      constructorPokemon: 1,
    });
    workspace.labs[0].teams[0].slots[2]!.data.shinySprite = 23 as unknown as string;
    backup.entries[0][1] = serializeWorkspace(workspace);
    expect(() => validateStorageBackup(backup)).toThrow(/incompletos/);
  });
});
