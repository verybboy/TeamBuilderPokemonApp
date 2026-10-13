import { describe, it, expect } from 'vitest';
import { Pokemon } from '@smogon/calc';
import {
  createMember,
  emptyTeams,
  spread,
  engineGeneration,
  type Gen,
  type PokemonData,
} from './model';
import { addTeamConfiguration, restoreTeamLibrary, alphabetical } from './library';
import { coverageTeam, defensiveCoverage } from './coverage';
import { damageFor, fieldFor, type BattleSettings } from './battle';

function member(name: string, gen: Gen = 9) {
  const p = new Pokemon(engineGeneration(gen), name);
  const data: PokemonData = {
    name,
    apiName: name.toLowerCase(),
    number: 1,
    types: p.types.map((t) => t.toLowerCase()),
    baseStats: p.species.baseStats,
    abilities: [p.ability || ''],
    moves: ['Tackle', 'Protect', 'Flamethrower', 'Earthquake'],
    sprite: 'sprite.png',
    shinySprite: 'shiny.png',
    genders: ['M', 'F'],
  };
  const m = createMember(data);
  m.moves = ['Protect', '', '', ''];
  return m;
}
function settings(): BattleSettings {
  const side = () => ({
    reflect: false,
    lightScreen: false,
    tailwind: false,
    auroraVeil: false,
    helpingHand: false,
    abilityOn: false,
    status: '',
    boosts: spread(0),
  });
  return { weather: '', terrain: '', doubles: true, trickRoom: false, sides: [side(), side()] };
}
describe('Equipos guardados', () => {
  it('guarda una copia completa y deduplica sin perder posición ni PS', () => {
    const team = emptyTeams()[0];
    team.slots[2] = member('Garchomp');
    team.slots[2].hpPercent = 43;
    const result = addTeamConfiguration([], team, 9, '  Arena  ');
    expect(result.entry.name).toBe('Arena');
    expect(result.entry.team.name).toBe('Arena');
    expect(result.entry.team.slots[0]).toBeNull();
    expect(result.entry.team.slots[2]?.hpPercent).toBe(43);
    team.slots[2].nature = 'Jolly';
    expect(result.entry.team.slots[2]?.nature).toBe('Hardy');
    expect(
      addTeamConfiguration(result.entries, result.entry.team, 9, 'Arena').entries,
    ).toHaveLength(1);
    const moved = structuredClone(result.entry.team);
    moved.slots[0] = moved.slots[2];
    moved.slots[2] = null;
    expect(addTeamConfiguration(result.entries, moved, 9, 'Arena').entries).toHaveLength(2);
    const injured = structuredClone(result.entry.team);
    injured.slots[2]!.hpPercent = 42;
    expect(addTeamConfiguration(result.entries, injured, 9, 'Arena').entries).toHaveLength(2);
  });
  it('restaura Champions y rechaza equipos vacíos, repartos inválidos y datos corruptos', () => {
    const team = emptyTeams()[0];
    team.slots[0] = member('Torkoal', 0);
    team.slots[0].evs = { ...spread(0), hp: 32, spa: 32, spd: 2 };
    const { entries } = addTeamConfiguration([], team, 0, 'Sol');
    const raw = () => JSON.stringify({ version: 1, entries });
    expect(restoreTeamLibrary(raw()).entries).toEqual(entries);
    expect(() => addTeamConfiguration([], emptyTeams()[0], 0, 'Vacío')).toThrow();
    entries[0].team.slots[0]!.evs.hp = 33;
    expect(restoreTeamLibrary(raw()).invalid).toBe(true);
    entries[0].team.slots[0]!.evs.hp = 32;
    entries[0].team.slots.pop();
    expect(restoreTeamLibrary(raw()).invalid).toBe(true);
    expect(restoreTeamLibrary('corrupt')).toEqual({ entries: [], invalid: true });
  });
  it('ordena nombres españoles sin distinguir mayúsculas y con orden numérico', () => {
    expect(['Zeta', 'equipo 10', 'Ámbar', 'Equipo 2'].sort(alphabetical)).toEqual([
      'Ámbar',
      'Equipo 2',
      'equipo 10',
      'Zeta',
    ]);
  });
});
describe('Cobertura por tipos', () => {
  it.each([0, 9] as Gen[])(
    'usa los tipos de Charizard X/Y por piedra en el perfil %s sin modificar el equipo',
    (gen) => {
      const team = emptyTeams()[0];
      team.slots[0] = member('Charizard', gen);
      team.slots[0].item = 'Charizardite X';
      const original = structuredClone(team),
        base = defensiveCoverage(team, gen);
      const preview = coverageTeam(team, gen, [true]);
      expect(preview.slots[0]?.data.types).toEqual(['fire', 'dragon']);
      expect(defensiveCoverage(preview, gen).find((r) => r.type === 'ground')).toMatchObject({
        multipliers: [2, null, null, null, null, null],
        weak: 1,
        resist: 0,
      });
      expect(defensiveCoverage(preview, gen).find((r) => r.type === 'electric')).toMatchObject({
        multipliers: [0.5, null, null, null, null, null],
        weak: 0,
        resist: 1,
      });
      expect(team).toEqual(original);
      expect(defensiveCoverage(coverageTeam(team, gen, [false]), gen)).toEqual(base);
      team.slots[0].item = 'Charizardite Y';
      expect(coverageTeam(team, gen, [true]).slots[0]?.data.name).toBe('Charizard-Mega-Y');
      expect(defensiveCoverage(coverageTeam(team, gen, [true]), gen)).toEqual(base);
    },
  );
  it('ignora selecciones mega con piedra incompatible, plaza vacía o perfil antiguo', () => {
    const team = emptyTeams()[0];
    team.slots[0] = member('Charizard');
    team.slots[0].item = 'Garchompite';
    expect(coverageTeam(team, 9, [true, true])).toEqual(team);
    team.slots[0].item = 'Charizardite X';
    expect(coverageTeam(team, 5, [true])).toEqual(team);
  });
  it('cuenta debilidades, resistencias e inmunidades sin incluir plazas vacías', () => {
    const team = emptyTeams()[0];
    team.slots[0] = member('Charizard');
    team.slots[1] = member('Garchomp');
    team.slots[2] = member('Gengar');
    const rows = defensiveCoverage(team, 9);
    expect(rows).toHaveLength(18);
    expect(rows.find((r) => r.type === 'rock')).toMatchObject({
      multipliers: [4, 0.5, 1, null, null, null],
      weak: 1,
      resist: 1,
    });
    expect(rows.find((r) => r.type === 'electric')).toMatchObject({
      multipliers: [2, 0, 1, null, null, null],
      weak: 1,
      resist: 1,
    });
    expect(rows.find((r) => r.type === 'ground')?.multipliers).toEqual([0, 1, 2, null, null, null]);
    expect(
      defensiveCoverage(emptyTeams()[0], 0).every((row) => row.weak === 0 && row.resist === 0),
    ).toBe(true);
  });
  it('respeta tipos y tabla históricos: Magnemite y acero, y Clefairy y hada', () => {
    const team = emptyTeams()[0];
    team.slots[0] = member('Magnemite');
    team.slots[1] = member('Clefairy');
    expect(defensiveCoverage(team, 1)).toHaveLength(15);
    expect(
      defensiveCoverage(team, 1)
        .find((r) => r.type === 'poison')
        ?.multipliers.slice(0, 2),
    ).toEqual([1, 1]);
    expect(
      defensiveCoverage(team, 5)
        .find((r) => r.type === 'poison')
        ?.multipliers.slice(0, 2),
    ).toEqual([0, 1]);
    expect(
      defensiveCoverage(team, 9)
        .find((r) => r.type === 'poison')
        ?.multipliers.slice(0, 2),
    ).toEqual([0, 2]);
  });
});
describe.each([0, 9] as Gen[])('Velo Aurora y Refuerzo, perfil %s', (gen) => {
  it('Velo reduce daño físico y especial, respeta crítico y no acumula pantallas', () => {
    const a = member('Garchomp', gen),
      b = member('Torkoal', gen),
      s = settings();
    for (const move of ['Earthquake', 'Flamethrower']) {
      const base = damageFor(a, b, gen, s, move)!;
      const critical = damageFor(a, b, gen, s, move, true)!;
      s.sides[1].auroraVeil = true;
      const veil = damageFor(a, b, gen, s, move)!;
      expect(veil.max).toBeLessThan(base.max);
      expect(damageFor(a, b, gen, s, move, true)!.max).toBe(critical.max);
      s.sides[1].reflect = true;
      s.sides[1].lightScreen = true;
      expect(damageFor(a, b, gen, s, move)!.max).toBe(veil.max);
      s.sides[1] = settings().sides[1];
    }
  });
  it('Refuerzo potencia al atacante correcto en ambos sentidos y solo en dobles', () => {
    const a = member('Garchomp', gen),
      b = member('Torkoal', gen),
      s = settings();
    const forward = damageFor(a, b, gen, s, 'Earthquake')!.max,
      reverse = damageFor(a, b, gen, s, 'Flamethrower', false, true)!.max;
    s.sides[0].helpingHand = true;
    expect(damageFor(a, b, gen, s, 'Earthquake')!.max).toBeGreaterThan(forward);
    expect(damageFor(a, b, gen, s, 'Flamethrower', false, true)!.max).toBe(reverse);
    s.sides[1].helpingHand = true;
    expect(damageFor(a, b, gen, s, 'Flamethrower', false, true)!.max).toBeGreaterThan(reverse);
    s.doubles = false;
    expect(fieldFor(s).attackerSide.isHelpingHand).toBe(false);
    expect(fieldFor(s, true).attackerSide.isHelpingHand).toBe(false);
    const clean = settings();
    clean.doubles = false;
    expect(damageFor(a, b, gen, s, 'Earthquake')!.max).toBe(
      damageFor(a, b, gen, clean, 'Earthquake')!.max,
    );
  });
});
