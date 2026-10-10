import { describe, it, expect } from 'vitest';
import { Pokemon, calculate, Move, Field } from '@smogon/calc';
import {
  createMember,
  calcPokemon,
  validateMember,
  convertMemberProfile,
  natureEffect,
  natureLabel,
  spread,
  trainingLimits,
  type PokemonData,
} from './model';
import { importShowdown, exportShowdown } from './showdown';
import { damageFor, attackOrder, type BattleSettings } from './battle';
import { addConfiguration, restoreLibrary } from './library';
function data(name = 'Torkoal'): PokemonData {
  const p = new Pokemon(0, name);
  return {
    name,
    apiName: name.toLowerCase(),
    number: 324,
    baseStats: p.species.baseStats,
    types: p.types.map((t) => t.toLowerCase()),
    abilities: name === 'Torkoal' ? ['Drought', 'White Smoke'] : [p.ability!],
    moves: ['Protect', 'Heat Wave', 'Eruption', 'Weather Ball', 'Earthquake'],
    genders: ['M', 'F'],
    sprite: 'normal.png',
    shinySprite: 'shiny.png',
  };
}
function member() {
  const m = createMember(data());
  m.moves = ['Protect', 'Heat Wave', 'Eruption', 'Weather Ball'];
  m.evs = { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 };
  m.nature = 'Quiet';
  return m;
}
const field = (): BattleSettings => ({
  weather: '',
  terrain: '',
  doubles: true,
  trickRoom: false,
  sides: [
    {
      reflect: false,
      lightScreen: false,
      tailwind: false,
      abilityOn: false,
      status: '',
      boosts: spread(0),
    },
    {
      reflect: false,
      lightScreen: false,
      tailwind: false,
      abilityOn: false,
      status: '',
      boosts: spread(0),
    },
  ],
});
describe('Champions nativo', () => {
  it('admite 32 por estadística y exactamente 66 en total', () => {
    expect(trainingLimits(0)).toEqual({ perStat: 32, total: 66, label: 'SP' });
    expect(() => validateMember(member(), 0)).not.toThrow();
    const bad = member();
    bad.evs.hp = 33;
    expect(() => validateMember(bad, 0)).toThrow('32');
    bad.evs.hp = 32;
    bad.evs.spd = 3;
    expect(() => validateMember(bad, 0)).toThrow('66');
  });
  it('usa la fórmula de Champions con la naturaleza dentro del reparto', () => {
    const p = calcPokemon(member(), 0);
    expect(p.level).toBe(50);
    expect(p.rawStats.hp).toBe(177);
    expect(p.rawStats.spa).toBe(150);
    expect(p.rawStats.spe).toBe(36);
    expect(p.rawStats).toEqual(
      new Pokemon(0, 'Torkoal', { nature: 'Quiet', evs: member().evs, ability: 'Drought' })
        .rawStats,
    );
  });
  it('exige nivel 50 e IVs perfectos', () => {
    const m = member();
    m.level = 100;
    expect(() => validateMember(m, 0)).toThrow('nivel 50');
    m.level = 50;
    m.ivs.atk = 0;
    expect(() => validateMember(m, 0)).toThrow('IVs perfectos');
  });
  it('conserva el porcentaje de PS y copia el miembro al convertir perfiles', () => {
    const m = member();
    m.evs = { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 };
    m.ivs.spe = 0;
    m.level = 76;
    m.hpPercent = 42;
    const converted = convertMemberProfile(m, 9, 0);
    expect(converted.evs).toEqual({ hp: 32, atk: 0, def: 1, spa: 32, spd: 0, spe: 0 });
    expect(converted.hpPercent).toBe(42);
    expect(converted.ivs).toEqual(spread(31));
    expect(converted.level).toBe(50);
    expect(m.evs.hp).toBe(252);
    expect(m.ivs.spe).toBe(0);
    expect(convertMemberProfile(converted, 0, 9).evs).toEqual({
      hp: 252,
      atk: 0,
      def: 4,
      spa: 252,
      spd: 0,
      spe: 0,
    });
  });
  it('no recorta silenciosamente distribuciones Champions incompatibles con 510 EVs', () => {
    const classic = convertMemberProfile(member(), 0, 9);
    expect(() => validateMember(classic, 9)).toThrow('510');
  });
  it('importa y exporta los SP pequeños como EVs de Showdown sin multiplicarlos', async () => {
    const m = member();
    m.item = 'Charcoal';
    const text = exportShowdown([m], 0);
    expect(text).toContain('EVs: 32 HP / 32 SpA / 2 SpD');
    expect(text).toContain('Ability: Drought');
    expect(text).toContain('Quiet Nature');
    const parsed = await importShowdown(text, 0, async () => data());
    expect(parsed[0]).toEqual(m);
    await expect(
      importShowdown(text.replace('32 HP', '33 HP'), 0, async () => data()),
    ).rejects.toThrow();
  });
  it('calcula el daño con el motor Champions y aplica parálisis moderna', () => {
    const a = member(),
      b = createMember(data('Garchomp')),
      s = field();
    b.moves = ['Earthquake', '', '', ''];
    const actual = damageFor(a, b, 0, s, 'Heat Wave')!;
    const expected = calculate(
      0,
      calcPokemon(a, 0),
      calcPokemon(b, 0),
      new Move(0, 'Heat Wave'),
      new Field({ gameType: 'Doubles' }),
    ).range();
    expect([actual.min, actual.max]).toEqual(expected);
    const normal = attackOrder(a, b, 0, s, ['Heat Wave', 'Earthquake']);
    s.sides[1].status = 'par';
    const paralyzed = attackOrder(a, b, 0, s, ['Heat Wave', 'Earthquake']);
    expect(paralyzed.speeds[1]).toBe(Math.floor(normal.speeds[1] / 2));
  });
});
describe('Naturalezas', () => {
  it('indica aumento, descenso y naturalezas neutras', () => {
    expect(natureEffect('Adamant')).toEqual({ plus: 'atk', minus: 'spa' });
    expect(natureLabel('Adamant')).toBe('Adamant (↑ Ataque / ↓ At. Esp.)');
    expect(natureEffect('Hardy')).toEqual({ plus: undefined, minus: undefined });
    expect(natureLabel('Hardy')).toBe('Hardy (neutra)');
  });
});
describe('Biblioteca persistente', () => {
  it('guarda una copia independiente con perfil y restaura los SP', () => {
    const original = member();
    const result = addConfiguration([], original, 0, 'Sol');
    original.evs.hp = 0;
    expect(result.entry.member.evs.hp).toBe(32);
    const restored = restoreLibrary(JSON.stringify({ version: 1, entries: result.entries }));
    expect(restored.invalid).toBe(false);
    expect(restored.entries[0].gen).toBe(0);
    expect(restored.entries[0].member.evs.hp).toBe(32);
  });
  it('evita duplicar builds idénticos pero permite repartos distintos', () => {
    const result = addConfiguration([], member(), 0, 'Sol');
    expect(addConfiguration(result.entries, member(), 0, 'Sol').entries).toHaveLength(1);
    const alternative = member();
    alternative.evs.hp = 31;
    expect(addConfiguration(result.entries, alternative, 0, 'Sol').entries).toHaveLength(2);
  });
  it('rechaza una biblioteca corrupta o un reparto inválido', () => {
    expect(restoreLibrary('bad')).toEqual({ entries: [], invalid: true });
    const result = addConfiguration([], member(), 0, 'Sol');
    result.entry.member.evs.hp = 33;
    expect(restoreLibrary(JSON.stringify({ version: 1, entries: result.entries })).invalid).toBe(
      true,
    );
  });
});
