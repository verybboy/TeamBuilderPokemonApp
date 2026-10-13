import { describe, expect, it } from 'vitest';
import {
  calculatorTypes,
  defensiveTypes,
  offensiveTypes,
  groupTypeMatchups,
  type AttackOptions,
} from './type-calculator';
const options: AttackOptions = { specialMoves: [], scrappy: false, tintedLens: false };
const value = (rows: ReturnType<typeof defensiveTypes>, type: string) =>
  rows.find((row) => row.type === type)!.multiplier;
describe('Calculadora de tipos', () => {
  it('empieza neutral y cubre exactamente los 18 tipos', () => {
    const groups = groupTypeMatchups(offensiveTypes([], options));
    expect(groups).toEqual([{ multiplier: 1, types: [...calculatorTypes] }]);
    expect(defensiveTypes([]).every((row) => row.multiplier === 1)).toBe(true);
  });
  it('elige el mejor ataque, admite todos los tipos y conserva inmunidades', () => {
    expect(value(offensiveTypes(['normal'], options), 'ghost')).toBe(0);
    const rows = offensiveTypes(['fire', 'water', 'grass'], options);
    expect(value(rows, 'grass')).toBe(2);
    expect(value(rows, 'fire')).toBe(2);
    expect(value(rows, 'dragon')).toBe(0.5);
    const all = offensiveTypes(calculatorTypes, options);
    expect(all).toHaveLength(18);
    expect(all.every((row) => row.multiplier === 2)).toBe(true);
  });
  it('aplica los tres movimientos especiales y habilidades al resultado del ataque', () => {
    expect(value(offensiveTypes([], { ...options, specialMoves: ['freezeDry'] }), 'water')).toBe(2);
    expect(
      value(offensiveTypes([], { ...options, specialMoves: ['thousandArrows'] }), 'flying'),
    ).toBe(1);
    const press = offensiveTypes([], { ...options, specialMoves: ['flyingPress'] });
    expect(value(press, 'rock')).toBe(1);
    expect(value(press, 'bug')).toBe(1);
    expect(value(press, 'poison')).toBe(0.5);
    expect(value(press, 'ghost')).toBe(0);
    const lens = offensiveTypes(['normal'], { ...options, tintedLens: true });
    expect(value(lens, 'rock')).toBe(1);
    expect(value(lens, 'ghost')).toBe(0);
    expect(value(offensiveTypes(['normal'], { ...options, scrappy: true }), 'ghost')).toBe(1);
  });
  it('multiplica tipos defensivos, no repite el mismo y rechaza un tercero', () => {
    const rows = defensiveTypes(['fire', 'flying']);
    expect(value(rows, 'rock')).toBe(4);
    expect(value(rows, 'grass')).toBe(0.25);
    expect(value(rows, 'ground')).toBe(0);
    expect(value(rows, 'ice')).toBe(1);
    expect(defensiveTypes(['fire', 'fire'])).toEqual(defensiveTypes(['fire']));
    expect(() => defensiveTypes(['fire', 'water', 'grass'])).toThrow(/dos tipos/);
  });
  it('aplica inmunidades, reducciones, Superguarda y Ráfaga Delta sin perder el segundo tipo', () => {
    expect(value(defensiveTypes(['electric'], 'Levitate'), 'ground')).toBe(0);
    expect(value(defensiveTypes(['grass'], 'Thick Fat'), 'fire')).toBe(1);
    expect(value(defensiveTypes(['grass'], 'Dry Skin'), 'fire')).toBe(2.5);
    expect(value(defensiveTypes(['grass'], 'Dry Skin'), 'water')).toBe(0);
    expect(value(defensiveTypes(['fire', 'flying'], 'Filter'), 'rock')).toBe(3);
    expect(value(defensiveTypes(['bug', 'ghost'], 'Wonder Guard'), 'water')).toBe(0);
    expect(value(defensiveTypes(['bug', 'ghost'], 'Wonder Guard'), 'fire')).toBe(2);
    const delta = defensiveTypes(['fire', 'flying'], 'Delta Stream');
    expect(value(delta, 'rock')).toBe(2);
    expect(value(delta, 'electric')).toBe(1);
    expect(value(delta, 'ground')).toBe(0);
  });
  it('Teraparazón depende de los PS y mantiene las inmunidades', () => {
    expect(value(defensiveTypes(['ground'], 'Tera Shell'), 'water')).toBe(0.5);
    expect(value(defensiveTypes(['ground'], 'Tera Shell', false), 'water')).toBe(2);
    expect(value(defensiveTypes(['ground'], 'Tera Shell'), 'electric')).toBe(0);
  });
});
