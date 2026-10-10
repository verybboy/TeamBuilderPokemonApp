import { test, expect } from 'vitest';
import { loadPokemon, loadItemSprite } from './api';
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
    const championsData = await loadPokemon('Torkoal', 0);
    const champions = createMember(championsData);
    champions.moves = ['Protect', 'Heat Wave', 'Eruption', 'Weather Ball'];
    champions.evs = { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 };
    validateMember(champions, 0);
    for (const [name, ability, moves] of [
      ['Venusaur', 'Chlorophyll', ['Sleep Powder', 'Sludge Bomb', 'Giga Drain', 'Protect']],
      ['Sylveon', 'Pixilate', ['Moonblast', 'Hyper Voice', 'Quick Attack', 'Protect']],
    ] as const) {
      const data = await loadPokemon(name, 0);
      const m = createMember(data);
      m.ability = ability;
      m.moves = [...moves];
      m.evs = { hp: 32, atk: 0, def: 20, spa: 0, spd: 13, spe: 0 };
      validateMember(m, 0);
    }
    for (const form of ['Charizard-Mega-X', 'Charizard-Mega-Y']) {
      const data = await loadPokemon(form, 9);
      expect(data.name).toBe(form);
      expect(data.sprite).toMatch(/^https:\/\//);
      const response = await fetch(data.sprite);
      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toContain('image/');
    }
    for (const item of [
      'Choice Scarf',
      'Charcoal',
      'Booster Energy',
      'DeepSeaTooth',
      'Electrium Z',
    ]) {
      const sprite = await loadItemSprite(item);
      expect(sprite).toMatch(/^https:\/\//);
      const response = await fetch(sprite!);
      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toContain('image/');
    }
  },
  120000,
);
