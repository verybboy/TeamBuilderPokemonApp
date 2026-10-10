import { test, expect } from 'vitest';
import { loadPokemon } from './api';
import { createMember, validateMember } from './model';
// Opt-in integration check: makes real, cached PokéAPI requests.
test.skipIf(process.env.RUN_LIVE_API !== '1')(
  'consulta real: catálogo, legalidad y sprites de las nueve generaciones',
  async () => {
    const samples = [
      'Pikachu',
      'Scizor',
      'Torkoal',
      'Garchomp',
      'Whimsicott',
      'Talonflame',
      'Incineroar',
      'Corviknight',
      'Flutter Mane',
    ];
    for (let i = 0; i < samples.length; i++) {
      const gen = (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
      const data = await loadPokemon(samples[i], gen);
      expect(data.name).toBe(samples[i]);
      expect(data.moves.length).toBeGreaterThan(0);
      expect(data.baseStats.hp).toBeGreaterThan(0);
      expect(data.sprite).toMatch(/^https:\/\//);
      const m = createMember(data);
      m.moves = [data.moves[0], '', '', ''];
      validateMember(m, gen);
    }
    const torkoal = await loadPokemon('Torkoal', 9);
    expect(torkoal.abilities).toContain('Drought');
    for (const m of ['Protect', 'Heat Wave', 'Eruption', 'Weather Ball'])
      expect(torkoal.moves).toContain(m);
    const oldGengar = await loadPokemon('Gengar', 3);
    expect(oldGengar.abilities).toContain('Levitate');
    expect(oldGengar.abilities).not.toContain('Cursed Body');
    const currentGengar = await loadPokemon('Gengar', 9);
    expect(currentGengar.abilities).toContain('Cursed Body');
    const oldClefairy = await loadPokemon('Clefairy', 3);
    expect(oldClefairy.types).toEqual(['normal']);
  },
  120000,
);
