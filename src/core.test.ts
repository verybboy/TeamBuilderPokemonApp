import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculate, Field, Move, Pokemon, toID } from '@smogon/calc';
import {
  createMember,
  calcPokemon,
  emptyTeams,
  generations,
  restoreTeams,
  spread,
  validateMember,
  type Gen,
  type PokemonData,
} from './model';
import { importShowdown, exportShowdown } from './showdown';
import { attackOrder, damageFor, type BattleSettings } from './battle';
import { loadPokemon, request } from './api';
function data(name: string): PokemonData {
  const p = new Pokemon(9, name);
  return {
    apiName: name.toLowerCase(),
    name,
    number: 1,
    types: p.types.map((t) => t.toLowerCase()),
    baseStats: p.species.baseStats,
    abilities: [p.ability || ''],
    moves: [
      'Tackle',
      'Protect',
      'Earthquake',
      'Heat Wave',
      'Eruption',
      'Weather Ball',
      'Dragon Claw',
      'Thunderbolt',
      'Quick Attack',
      'Tailwind',
      'Roost',
    ],
    sprite: 'sprite.png',
    shinySprite: 'shiny.png',
    genders: ['M', 'F'],
  };
}
const loader = async (name: string, _gen: Gen) => {
  const canonical = Array.from(generations.get(9).species).find((s) => s.id === toID(name));
  if (!canonical) throw new Error('Especie desconocida.');
  const d = data(canonical.name);
  if (name === 'Torkoal') d.abilities = ['Drought', 'White Smoke', 'Shell Armor'];
  return d;
};
const settings = (): BattleSettings => ({
  weather: '',
  terrain: '',
  doubles: false,
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
describe('Showdown y validación', () => {
  it('importa el ejemplo del documento con los valores por defecto', async () => {
    const [m] = await importShowdown(
      'Torkoal @ Charcoal\nAbility: Drought\nEVs: 32 HP / 1 Def / 32 SpA / 1 SpD\nQuiet Nature\n- Protect\n- Heat Wave\n- Eruption\n- Weather Ball',
      9,
      loader,
    );
    expect(m.level).toBe(50);
    expect(m.ivs).toEqual(spread(31));
    expect(m.evs.hp).toBe(32);
    expect(m.evs.atk).toBe(0);
    expect(m.moves).toHaveLength(4);
  });
  it('conserva apodo, sexo, variocolor, objeto, IVs, EVs y cuatro movimientos en ida y vuelta', async () => {
    const [m] = await importShowdown(
      'Sol (Torkoal) (F) @ Charcoal\nAbility: Drought\nLevel: 76\nShiny: Yes\nEVs: 252 HP / 252 SpA / 4 SpD\nIVs: 0 Atk / 0 Spe\nQuiet Nature\n- Protect\n- Heat Wave\n- Eruption\n- Weather Ball',
      9,
      loader,
    );
    const [roundtrip] = await importShowdown(exportShowdown([m, null], 9), 9, loader);
    expect(roundtrip).toEqual(m);
  });
  it.each([
    'Torkoal\nAbility: Drought\n- Missing Move',
    'Torkoal\nAbility: Levitate\n- Protect',
    'Torkoal\nLevel: 101\n- Protect',
    'Torkoal\nEVs: 252 HP / 252 Atk / 252 Spe\n- Protect',
    'Torkoal\n- Protect\n- Protect',
    'Torkoal\nEVs: 8 HP / 8 HP\n- Protect',
    'Torkoal\nIVs: 32 Spe\n- Protect',
    'Torkoal\nLevel: nope\n- Protect',
    'Torkoal\nShiny: maybe\n- Protect',
    'Torkoal\nTera Type: Fire\n- Protect',
    'Torkoal\n- Protect\n- Tackle\n- Earthquake\n- Heat Wave\n- Eruption',
  ])('rechaza entradas inválidas sin devolver un equipo parcial: %s', async (text) => {
    await expect(importShowdown(text, 9, loader)).rejects.toThrow();
  });
  it('rechaza texto vacío y más de seis Pokémon', async () => {
    await expect(importShowdown('', 9, loader)).rejects.toThrow();
    await expect(
      importShowdown(Array(7).fill('Torkoal\n- Protect').join('\n\n'), 9, loader),
    ).rejects.toThrow('seis');
  });
  it('rechaza movimientos de otra especie aunque el motor los conozca', () => {
    const m = createMember(data('Pikachu'));
    m.data.moves = ['Thunderbolt'];
    m.moves = ['Earthquake', '', '', ''];
    expect(() => validateMember(m, 9)).toThrow('Earthquake');
  });
  it('conserva el porcentaje al cambiar IVs de PS', () => {
    const m = createMember(data('Torkoal'));
    m.hpPercent = 42.5;
    const before = calcPokemon(m, 9);
    m.ivs.hp = 0;
    const after = calcPokemon(m, 9);
    expect(after.maxHP()).toBeLessThan(before.maxHP());
    expect(after.curHP()).toBe(Math.round(after.maxHP() * 0.425));
    expect(m.hpPercent).toBe(42.5);
  });
  it('restaura equipos válidos y descarta datos dañados', () => {
    const teams = emptyTeams();
    const m = createMember(data('Torkoal'));
    m.moves = ['Protect', '', '', ''];
    teams[0].slots[0] = m;
    const saved = JSON.stringify({ version: 1, gen: 9, teams });
    expect(restoreTeams(saved)?.teams).toEqual(teams);
    expect(restoreTeams('bad json')).toBeNull();
    teams[0].slots[0]!.ivs.hp = 500;
    expect(restoreTeams(JSON.stringify({ version: 1, gen: 9, teams }))).toBeNull();
  });
});
describe('Integración real del motor de Smogon', () => {
  const a = createMember(data('Garchomp')),
    b = createMember(data('Torkoal'));
  a.moves = ['Earthquake', 'Dragon Claw', 'Protect', ''];
  b.moves = ['Heat Wave', 'Eruption', 'Protect', ''];
  it('coincide con el motor original en ambas direcciones', () => {
    const s = settings();
    s.weather = 'Rain';
    s.sides[1].reflect = true;
    const actual = damageFor(a, b, 9, s, 'Earthquake')!;
    const expected = calculate(
      9,
      calcPokemon(a, 9),
      calcPokemon(b, 9),
      new Move(9, 'Earthquake'),
      new Field({ weather: 'Rain', defenderSide: { isReflect: true } }),
    ).range();
    expect([actual.min, actual.max]).toEqual(expected);
    const reverse = damageFor(a, b, 9, s, 'Heat Wave', false, true)!;
    const expectedReverse = calculate(
      9,
      calcPokemon(b, 9),
      calcPokemon(a, 9),
      new Move(9, 'Heat Wave'),
      new Field({ weather: 'Rain', attackerSide: { isReflect: true } }),
    ).range();
    expect([reverse.min, reverse.max]).toEqual(expectedReverse);
  });
  it('aplica pantallas, quemadura, boosts, crítico y ataque de área en dobles', () => {
    const s = settings();
    const base = damageFor(a, b, 9, s, 'Earthquake')!.max;
    s.sides[1].reflect = true;
    expect(damageFor(a, b, 9, s, 'Earthquake')!.max).toBeLessThan(base);
    s.sides[1].reflect = false;
    s.sides[0].status = 'brn';
    expect(damageFor(a, b, 9, s, 'Earthquake')!.max).toBeLessThan(base);
    s.sides[0].status = '';
    s.sides[0].boosts.atk = 2;
    expect(damageFor(a, b, 9, s, 'Earthquake')!.max).toBeGreaterThan(base);
    s.sides[0].boosts.atk = 0;
    expect(damageFor(a, b, 9, s, 'Earthquake', true)!.max).toBeGreaterThan(base);
    s.doubles = true;
    expect(damageFor(a, b, 9, s, 'Earthquake')!.max).toBeLessThan(base);
  });
  it('aplica clima, terreno, habilidades y objetos', () => {
    const s = settings();
    const normal = damageFor(a, b, 9, s, 'Heat Wave', false, true)!.max;
    s.weather = 'Sun';
    expect(damageFor(a, b, 9, s, 'Heat Wave', false, true)!.max).toBeGreaterThan(normal);
    s.weather = 'Rain';
    expect(damageFor(a, b, 9, s, 'Heat Wave', false, true)!.max).toBeLessThan(normal);
    const p = createMember(data('Pikachu'));
    const neutral = damageFor(p, b, 9, settings(), 'Thunderbolt')!.max;
    s.weather = '';
    s.terrain = 'Electric';
    expect(damageFor(p, b, 9, s, 'Thunderbolt')!.max).toBeGreaterThan(neutral);
    const levitate = createMember(data('Rotom'));
    expect(damageFor(a, levitate, 9, settings(), 'Earthquake')!.max).toBe(0);
    const item = { ...a, item: 'Choice Band' };
    expect(damageFor(item, b, 9, settings(), 'Earthquake')!.max).toBeGreaterThan(
      damageFor(a, b, 9, settings(), 'Earthquake')!.max,
    );
  });
  it('muestra los movimientos de estado sin daño', () => {
    const r = damageFor(a, b, 9, settings(), 'Protect')!;
    expect(r.statusMove).toBe(true);
    expect(r.max).toBe(0);
  });
  it('mantiene PS cero y no resuelve ataques de Pokémon debilitados', () => {
    const fainted = { ...a, hpPercent: 0 };
    expect(calcPokemon(fainted, 9).curHP()).toBe(0);
    expect(damageFor(fainted, b, 9, settings(), 'Earthquake')!.description).toContain('debilitado');
  });
  it('permite activar Intimidate para reducir el daño físico', () => {
    const intimidator = createMember(data('Incineroar')),
      s = settings();
    intimidator.ability = 'Intimidate';
    const off = damageFor(a, intimidator, 9, s, 'Earthquake')!.max;
    s.sides[1].abilityOn = true;
    expect(damageFor(a, intimidator, 9, s, 'Earthquake')!.max).toBeLessThan(off);
  });
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9] as Gen[])('puede calcular en generación %i', (gen) => {
    const x = createMember(data('Pikachu')),
      y = createMember(data('Snorlax'));
    expect(damageFor(x, y, gen, settings(), 'Thunderbolt')!.max).toBeGreaterThan(0);
  });
});
describe('Orden de ataque', () => {
  const a = createMember(data('Garchomp')),
    b = createMember(data('Torkoal'));
  it('respeta velocidad, Espacio Raro y prioridad', () => {
    const s = settings();
    expect(attackOrder(a, b, 9, s, ['Earthquake', 'Heat Wave']).text).toContain('Garchomp');
    s.trickRoom = true;
    expect(attackOrder(a, b, 9, s, ['Earthquake', 'Heat Wave']).text).toContain('Torkoal');
    expect(attackOrder(a, b, 9, s, ['Protect', 'Heat Wave']).text).toContain('Garchomp');
  });
  it('detecta Speed Tie', () => {
    expect(attackOrder(a, a, 9, settings(), ['Earthquake', 'Earthquake']).text).toContain(
      'Speed Tie',
    );
  });
  it('aplica parálisis, Choice Scarf y Viento Afín', () => {
    const fast = createMember(data('Gengar')),
      slow = createMember(data('Garchomp')),
      s = settings();
    expect(attackOrder(fast, slow, 9, s, ['Shadow Ball', 'Earthquake']).text).toContain('Gengar');
    s.sides[0].status = 'par';
    expect(attackOrder(fast, slow, 9, s, ['Shadow Ball', 'Earthquake']).text).toContain('Garchomp');
    s.sides[0].status = '';
    slow.item = 'Choice Scarf';
    expect(attackOrder(fast, slow, 9, s, ['Shadow Ball', 'Earthquake']).text).toContain('Garchomp');
    slow.item = '';
    s.sides[1].tailwind = true;
    expect(attackOrder(fast, slow, 9, s, ['Shadow Ball', 'Earthquake']).text).toContain('Garchomp');
  });
  it('aplica Prankster, Gale Wings y Lagging Tail', () => {
    const prankster = createMember(data('Whimsicott'));
    prankster.ability = 'Prankster';
    expect(attackOrder(prankster, a, 9, settings(), ['Tailwind', 'Earthquake']).priorities[0]).toBe(
      1,
    );
    const bird = createMember(data('Talonflame'));
    bird.ability = 'Gale Wings';
    expect(attackOrder(bird, a, 9, settings(), ['Brave Bird', 'Earthquake']).priorities[0]).toBe(1);
    bird.hpPercent = 50;
    expect(attackOrder(bird, a, 9, settings(), ['Brave Bird', 'Earthquake']).priorities[0]).toBe(0);
    const late = { ...a, item: 'Lagging Tail' };
    expect(attackOrder(late, b, 9, settings(), ['Earthquake', 'Heat Wave']).text).toContain(
      'Torkoal',
    );
  });
  it('aplica Chlorophyll en sol y advierte sobre Quick Claw', () => {
    const plant = createMember(data('Venusaur'));
    plant.ability = 'Chlorophyll';
    const s = settings();
    const normal = attackOrder(plant, a, 9, s, ['Solar Beam', 'Earthquake']);
    s.weather = 'Sun';
    const sunny = attackOrder(plant, a, 9, s, ['Solar Beam', 'Earthquake']);
    expect(sunny.speeds[0]).toBe(normal.speeds[0] * 2);
    plant.item = 'Quick Claw';
    expect(attackOrder(plant, a, 9, s, ['Solar Beam', 'Earthquake']).detail).toContain(
      'puede alterar',
    );
  });
});
describe('PokéAPI', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('obtiene la especie, limita movimientos por generación y respeta sexo', async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('pokemon-species/')
          ? { gender_rate: 8, generation: { url: 'https://pokeapi.co/api/v2/generation/1/' } }
          : url.includes('version-group?')
            ? { results: [{ name: 'scarlet-violet' }, { name: 'red-blue' }] }
            : url.includes('version-group/')
              ? {
                  name: url.split('/').pop(),
                  generation: {
                    url: `https://pokeapi.co/api/v2/generation/${url.endsWith('red-blue') ? 1 : 9}/`,
                  },
                }
              : {
                  id: 25,
                  name: 'pikachu',
                  species: { name: 'pikachu' },
                  types: [{ slot: 1, type: { name: 'electric' } }],
                  stats: [{ base_stat: 35, stat: { name: 'hp' } }],
                  abilities: [{ ability: { name: 'static' } }],
                  moves: [
                    {
                      move: { name: 'thunderbolt' },
                      version_group_details: [{ version_group: { name: 'scarlet-violet' } }],
                    },
                    {
                      move: { name: 'tackle' },
                      version_group_details: [{ version_group: { name: 'red-blue' } }],
                    },
                  ],
                  sprites: {
                    front_default: 'normal',
                    front_shiny: 'shiny',
                    other: {
                      'official-artwork': { front_default: 'art', front_shiny: 'shiny-art' },
                    },
                  },
                },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const p = await loadPokemon('Pikachu', 9);
    expect(p.moves).toEqual(['Thunderbolt']);
    expect(p.abilities).toEqual(['Static']);
    expect(p.genders).toEqual(['F']);
    expect(p.shinySprite).toBe('shiny-art');
    await loadPokemon('Pikachu', 9);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
  it('informa de errores de red y permite reintentar', async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: 1 }) });
    vi.stubGlobal('fetch', mock);
    await expect(request('test-retry')).rejects.toThrow('network');
    await expect(request('test-retry')).resolves.toEqual({ ok: 1 });
  });
});
