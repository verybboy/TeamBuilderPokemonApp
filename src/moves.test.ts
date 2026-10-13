import { describe, it, expect } from 'vitest';
import { Pokemon } from '@smogon/calc';
import { moveInfo, accuracyLabel, powerLabel } from './moves';
import { createMember, withTraining, calcPokemon, spread, type Gen } from './model';
import { damageFor, attackOrder, type BattleSettings } from './battle';
function member(name: string) {
  const p = new Pokemon(9, name);
  const m = createMember({
    name,
    apiName: name.toLowerCase(),
    number: 1,
    types: p.types.map((type) => type.toLowerCase()),
    baseStats: p.species.baseStats,
    abilities: [p.ability!],
    moves: ['Earthquake', 'Protect', 'Heat Wave', 'Eruption'],
    sprite: '',
    shinySprite: '',
    genders: ['M', 'F'],
  });
  m.moves = [...m.data.moves];
  return m;
}
describe('Datos de movimientos por perfil', () => {
  it('detecta los críticos propios del movimiento según el perfil', () => {
    for (const gen of [0, 9, 10] as const) {
      for (const name of ['Frost Breath', 'Storm Throw', 'Flower Trick']) {
        if (moveInfo(name, gen)) expect(moveInfo(name, gen)?.alwaysCrit).toBe(true);
      }
      expect(moveInfo('Slash', gen)?.alwaysCrit).toBe(false);
      expect(moveInfo('Thunderbolt', gen)?.alwaysCrit).toBe(false);
    }
    expect(moveInfo('Wicked Blow', 9)?.alwaysCrit).toBe(true);
    expect(moveInfo('Surging Strikes', 9)?.alwaysCrit).toBe(true);
    expect(moveInfo('Frost Breath', 4)).toBeNull();
  });
  it('muestra datos completos, nombre español y descripción de Heat Wave', () => {
    expect(moveInfo('Heat Wave', 9)).toMatchObject({
      name: 'Heat Wave',
      localizedName: 'Onda Ígnea',
      type: 'fire',
      category: 'Special',
      power: 95,
      accuracy: 90,
      basePP: 10,
      pp: 16,
      priority: 0,
    });
    expect(moveInfo('Heat Wave', 9)?.description).toContain('quemar');
  });
  it('usa los PP y precisión propios de Champions', () => {
    expect(moveInfo('Heat Wave', 0)?.pp).toBe(12);
    expect(moveInfo('Protect', 0)).toMatchObject({
      basePP: 5,
      pp: 8,
      accuracy: null,
      category: 'Status',
      priority: 4,
    });
    expect(moveInfo('Crabhammer', 0)?.accuracy).toBe(95);
    expect(moveInfo('Quick Attack', 0)?.pp).toBe(20);
  });
  it('conserva cambios históricos de PP, precisión, potencia y categoría', () => {
    expect(moveInfo('Recover', 3)?.pp).toBe(32);
    expect(moveInfo('Recover', 8)?.pp).toBe(16);
    expect(moveInfo('Recover', 9)?.pp).toBe(8);
    expect(moveInfo('Toxic', 4)?.accuracy).toBe(85);
    expect(moveInfo('Toxic', 9)?.accuracy).toBe(90);
    expect(moveInfo('Shadow Ball', 3)?.category).toBe('Physical');
    expect(moveInfo('Shadow Ball', 9)?.category).toBe('Special');
    expect(moveInfo('Thunderbolt', 3)?.power).toBe(95);
    expect(moveInfo('Thunderbolt', 9)?.power).toBe(90);
    expect(moveInfo('Growl', 2)?.pp).toBe(61);
  });
  it('distingue prioridad positiva/negativa, movimientos de estado y acierto sin tirada', () => {
    expect(moveInfo('Quick Attack', 9)?.priority).toBe(1);
    expect(moveInfo('Roar', 9)?.priority).toBe(-6);
    expect(accuracyLabel(moveInfo('Protect', 9)?.accuracy)).toBe('Siempre');
    expect(powerLabel(0, 'Status')).toBe('—');
    expect(powerLabel(0, 'Physical')).toBe('Variable');
    expect(moveInfo('Gyro Ball', 9)?.power).toBe(0);
    expect(moveInfo('Struggle', 9)?.pp).toBe(1);
    expect(moveInfo('', 9)).toBeNull();
    expect(moveInfo('Heat Wave', 1)).toBeNull();
  });
});
describe('Repartos editables de la calculadora', () => {
  it.each([0, 9] as Gen[])(
    'recalcula daño y PS sin cambiar el original ni su porcentaje en perfil %s',
    (gen) => {
      const a = member('Garchomp'),
        b = member('Torkoal');
      a.hpPercent = 40;
      const before = structuredClone(a);
      const updated = withTraining(a, gen, 'atk', gen === 0 ? 32 : 252);
      const hp = withTraining(updated, gen, 'hp', gen === 0 ? 32 : 252);
      expect(a).toEqual(before);
      expect(hp.hpPercent).toBe(40);
      expect(calcPokemon(hp, gen).curHP()).toBe(Math.round(calcPokemon(hp, gen).maxHP() * 0.4));
      expect(calcPokemon(hp, gen).maxHP()).toBeGreaterThan(calcPokemon(a, gen).maxHP());
      const settings: BattleSettings = {
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
      };
      expect(damageFor(updated, b, gen, settings, 'Earthquake')!.min).toBeGreaterThan(
        damageFor(a, b, gen, settings, 'Earthquake')!.min,
      );
      expect(attackOrder(a, b, gen, settings, ['Roar', 'Earthquake']).text).toContain(
        'Torkoal atacaría primero',
      );
    },
  );
  it.each([0, 9] as Gen[])(
    'rechaza repartos que superen el límite individual o total en perfil %s',
    (gen) => {
      const max = gen === 0 ? 32 : 252,
        total = gen === 0 ? 66 : 510;
      const m = member('Garchomp');
      expect(() => withTraining(m, gen, 'atk', max + 1)).toThrow('entero');
      expect(() => withTraining(m, gen, 'atk', -1)).toThrow('entero');
      expect(() => withTraining(m, gen, 'atk', 0.5)).toThrow('entero');
      const spread = withTraining(withTraining(m, gen, 'hp', max), gen, 'atk', max);
      const full = withTraining(spread, gen, 'spe', total - 2 * max);
      expect(() => withTraining(full, gen, 'def', 1)).toThrow(String(total));
      expect(full.evs.def).toBe(0);
      expect(m.evs.atk).toBe(0);
    },
  );
  it('mantiene el entrenamiento máximo de los perfiles I–II', () => {
    expect(() => withTraining(member('Pikachu'), 2, 'atk', 100)).toThrow('sin EVs editables');
  });
});
