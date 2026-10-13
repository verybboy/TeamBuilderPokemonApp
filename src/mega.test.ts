import { describe, it, expect } from 'vitest';
import { Pokemon, calculate, Move } from '@smogon/calc';
import {
  createMember,
  calcPokemon,
  megaForm,
  megaEvolve,
  spread,
  type Gen,
  type Member,
} from './model';
import { damageFor, attackOrder, fieldFor, type BattleSettings } from './battle';
function member(name: string, item = ''): Member {
  const p = new Pokemon(9, name);
  const m = createMember({
    name,
    apiName: name.toLowerCase(),
    number: 1,
    types: p.types.map((type) => type.toLowerCase()),
    baseStats: p.species.baseStats,
    abilities: [p.ability!],
    moves: ['Dragon Claw', 'Flamethrower', 'Earthquake', 'Tackle'],
    sprite: 'base.png',
    shinySprite: 'base-shiny.png',
    genders: ['M', 'F'],
  });
  m.item = item;
  m.moves = [...m.data.moves];
  return m;
}
const settings = (): BattleSettings => ({
  weather: '',
  terrain: '',
  doubles: false,
  trickRoom: false,
  sides: [0, 1].map(() => ({
    reflect: false,
    lightScreen: false,
    tailwind: false,
    abilityOn: false,
    status: '',
    boosts: spread(0),
  })) as BattleSettings['sides'],
});
describe('Megaevolución por piedra equipada', () => {
  it.each([0, 6, 7, 8, 9] as Gen[])('distingue Charizard X e Y en el perfil %s', (gen) => {
    const x = megaEvolve(member('Charizard', 'Charizardite X'), gen, {
      sprite: 'x.png',
      shinySprite: 'x-shiny.png',
    });
    const y = megaEvolve(member('Charizard', 'Charizardite Y'), gen, {
      sprite: 'y.png',
      shinySprite: 'y-shiny.png',
    });
    expect(x.data.name).toBe('Charizard-Mega-X');
    expect(x.data.types).toEqual(['fire', 'dragon']);
    expect(x.ability).toBe('Tough Claws');
    expect(calcPokemon(x, gen).rawStats.atk).toBe(150);
    expect(calcPokemon(x, gen).rawStats.def).toBe(131);
    expect(y.data.name).toBe('Charizard-Mega-Y');
    expect(y.data.types).toEqual(['fire', 'flying']);
    expect(y.ability).toBe('Drought');
    expect(calcPokemon(y, gen).rawStats.spa).toBe(179);
    expect(calcPokemon(y, gen).rawStats.spd).toBe(135);
    expect(x.data.sprite).toBe('x.png');
    expect(y.data.shinySprite).toBe('y-shiny.png');
  });
  it('requiere una piedra compatible y una forma disponible en el perfil', () => {
    expect(megaForm(member('Charizard'), 9)).toBeNull();
    expect(megaForm(member('Charizard', 'Garchompite'), 9)).toBeNull();
    expect(megaForm(member('Charizard', 'Charizardite X'), 5)).toBeNull();
    expect(megaForm(member('Charizard-Mega-X', 'Charizardite X'), 9)).toBeNull();
    expect(() => megaEvolve(member('Charizard', 'Garchompite'), 9)).toThrow('compatible');
  });
  it('conserva configuración, porcentaje de PS y movimientos sin mutar el original', () => {
    const original = member('Charizard', 'Charizardite Y');
    original.hpPercent = 43;
    original.nickname = 'Sol';
    original.shiny = true;
    original.nature = 'Quiet';
    original.evs.spa = 252;
    original.ivs.spe = 0;
    const before = structuredClone(original);
    const mega = megaEvolve(original, 9, { sprite: 'y.png', shinySprite: 'y-shiny.png' });
    expect(mega).toMatchObject({
      hpPercent: 43,
      nickname: 'Sol',
      shiny: true,
      nature: 'Quiet',
      evs: original.evs,
      ivs: original.ivs,
      moves: original.moves,
    });
    expect(calcPokemon(mega, 9).curHP()).toBe(Math.round(calcPokemon(mega, 9).maxHP() * 0.43));
    mega.moves[0] = 'Protect';
    mega.evs.spa = 0;
    expect(original).toEqual(before);
  });
  it.each([0, 9] as const)('aplica tipos y habilidad mega al daño real en perfil %s', (gen) => {
    const base = member('Charizard', 'Charizardite X'),
      target = member('Garchomp');
    const mega = megaEvolve(base, gen),
      field = settings();
    const damage = damageFor(mega, target, gen, field, 'Dragon Claw')!;
    const direct = calculate(
      gen,
      new Pokemon(gen, 'Charizard-Mega-X', { level: 50, nature: 'Hardy', item: 'Charizardite X' }),
      new Pokemon(gen, 'Garchomp', { level: 50, nature: 'Hardy' }),
      new Move(gen, 'Dragon Claw'),
      fieldFor(field),
    ).range();
    expect([damage.min, damage.max]).toEqual(direct);
    expect(damage.min).toBeGreaterThan(damageFor(base, target, gen, field, 'Dragon Claw')!.min);
  });
  it('recalcula velocidad y orden usando las estadísticas mega y los boosts existentes', () => {
    const base = member('Garchomp', 'Garchompite'),
      target = member('Mew'),
      field = settings();
    const mega = megaEvolve(base, 9);
    expect(attackOrder(base, target, 9, field, ['Tackle', 'Tackle']).speeds).toEqual([122, 120]);
    expect(attackOrder(mega, target, 9, field, ['Tackle', 'Tackle']).speeds).toEqual([112, 120]);
    expect(attackOrder(mega, target, 9, field, ['Tackle', 'Tackle']).text).toContain(
      'Mew atacaría primero',
    );
    field.sides[0].boosts.spe = 1;
    expect(attackOrder(mega, target, 9, field, ['Tackle', 'Tackle']).speeds[0]).toBe(168);
  });
});
