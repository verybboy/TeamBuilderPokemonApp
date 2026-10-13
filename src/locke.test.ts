import { describe, expect, it } from 'vitest';
import { Pokemon, Move, calculate } from '@smogon/calc';
import {
  createMember,
  validateMember,
  calcPokemon,
  generations,
  emptyTeams,
  restoreTeams,
  trainingLimits,
  spread,
  mechanicsLabel,
  isGen,
  type PokemonData,
} from './model';
import { names } from './api';
import { moveInfo } from './moves';
import { exportShowdown, importShowdown } from './showdown';
import {
  addConfiguration,
  addTeamConfiguration,
  restoreLibrary,
  restoreTeamLibrary,
  configurationFilename,
  LIBRARY_KEY,
  TEAM_LIBRARY_KEY,
} from './library';
import { validateStorageBackup, APP_STORAGE_KEY } from './backup';
import { damageFor, fieldFor, attackOrder, type BattleSettings } from './battle';
const loader = async (name: string): Promise<PokemonData> => {
  const p = new Pokemon(9, name);
  return {
    name,
    apiName: name.toLowerCase(),
    number: 25,
    types: p.types.map((type) => type.toLowerCase()),
    baseStats: p.species.baseStats,
    abilities: [p.ability!],
    moves: ['Tackle'],
    genders: ['M', 'F'],
    sprite: 'sprite.png',
    shinySprite: 'shiny.png',
  };
};
const text =
  'Pikachu\nAbility: Huge Power\nEVs: 252 Atk / 4 SpD / 252 Spe\nJolly Nature\n- Earthquake\n- Spore\n- Extreme Speed\n- Scald';
describe('Perfil Locke', () => {
  it('permite habilidades y movimientos ajenos a la especie, conservando la validación de otros perfiles', async () => {
    const [m] = await importShowdown(text, 10, loader);
    expect(m.data.moves).toEqual(['Tackle']);
    expect(m.data.abilities).not.toContain('Huge Power');
    expect(() => validateMember(m, 10)).not.toThrow();
    expect(() => validateMember(m, 9)).toThrow(/Habilidad/);
    m.ability = m.data.abilities[0];
    expect(() => validateMember(m, 9)).toThrow(/Earthquake/);
    await expect(importShowdown(text, 9, loader)).rejects.toThrow(/Habilidad/);
    expect(names(10, 'species')).toEqual(names(9, 'species'));
    expect(names(10, 'moves')).toEqual(names(9, 'moves'));
    expect(names(10, 'abilities')).toEqual(names(9, 'abilities'));
    expect(mechanicsLabel(10)).toBe('Locke');
  });
  it('mantiene límites de entrenamiento y rechaza nombres desconocidos y movimientos repetidos', async () => {
    const [m] = await importShowdown(text, 10, loader);
    expect(trainingLimits(10)).toEqual(trainingLimits(9));
    expect(() => validateMember({ ...m, ability: 'Inventada' }, 10)).toThrow(/Habilidad/);
    expect(() => validateMember({ ...m, moves: ['Inventado', '', '', ''] }, 10)).toThrow(
      /Inventado/,
    );
    expect(() => validateMember({ ...m, moves: ['Spore', 'Spore', '', ''] }, 10)).toThrow(
      /repetir/,
    );
    expect(() => validateMember({ ...m, evs: spread(252) }, 10)).toThrow(/510/);
    expect(isGen(10)).toBe(true);
    expect(isGen(11)).toBe(false);
    expect(isGen('10')).toBe(false);
  });
  it('conserva el perfil y combinaciones en Showdown, ambas bibliotecas y copia completa', async () => {
    const [m] = await importShowdown(text, 10, loader);
    const roundtrip = await importShowdown(exportShowdown([m], 10), 10, loader);
    expect(roundtrip[0]).toEqual(m);
    const teams = emptyTeams();
    teams[0].slots[0] = m;
    const raw = JSON.stringify({ version: 1, gen: 10, teams });
    expect(restoreTeams(raw)?.gen).toBe(10);
    const pokemon = addConfiguration([], m, 10, 'Pikachu Locke').entries;
    const savedTeams = addTeamConfiguration([], teams[0], 10, 'Locke eléctrico').entries;
    const pokemonRaw = JSON.stringify({ version: 1, entries: pokemon }),
      teamsRaw = JSON.stringify({ version: 1, entries: savedTeams });
    expect(restoreLibrary(pokemonRaw).invalid).toBe(false);
    expect(restoreTeamLibrary(teamsRaw).invalid).toBe(false);
    expect(configurationFilename(pokemon[0])).toBe('pikachulocke-locke.txt');
    const { data } = validateStorageBackup({
      format: 'pokemon-team-lab-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: [
        [APP_STORAGE_KEY, raw],
        [LIBRARY_KEY, pokemonRaw],
        [TEAM_LIBRARY_KEY, teamsRaw],
      ],
    });
    expect(data.gen).toBe(10);
    expect(data.teams[0].slots[0]).toEqual(m);
    expect(data.configurations[0].gen).toBe(10);
    expect(data.savedTeams[0].gen).toBe(10);
  });
  it('calcula estadísticas, daño, prioridades y movimientos con el motor IX', async () => {
    const [m] = await importShowdown(text, 10, loader);
    const target = createMember(await loader('Garchomp'));
    target.moves = ['Tackle', '', '', ''];
    const side = () => ({
      reflect: false,
      lightScreen: false,
      tailwind: false,
      abilityOn: true,
      status: '',
      boosts: spread(0),
    });
    const settings: BattleSettings = {
      weather: '',
      terrain: '',
      doubles: false,
      trickRoom: false,
      sides: [side(), side()],
    };
    expect(generations.get(10).num).toBe(9);
    expect(calcPokemon(m, 10).stats).toEqual(calcPokemon(m, 9).stats);
    const damage = damageFor(m, target, 10, settings, 'Earthquake')!;
    const direct = calculate(
      9,
      calcPokemon(m, 9),
      calcPokemon(target, 9),
      new Move(9, 'Earthquake'),
      fieldFor(settings),
    ).range();
    expect([damage.min, damage.max]).toEqual(direct);
    expect(damage.max).toBeGreaterThan(0);
    expect(attackOrder(m, target, 10, settings, ['Extreme Speed', 'Tackle']).text).toContain(
      'Pikachu',
    );
    for (const move of ['Scald', 'Recover', 'Tackle', 'Hidden Power Ice', 'Extreme Speed'])
      expect(moveInfo(move, 10)).toEqual(moveInfo(move, 9));
  });
});
