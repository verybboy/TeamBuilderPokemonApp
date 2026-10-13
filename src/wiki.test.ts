import { describe, it, expect } from 'vitest';
import {
  searchWiki,
  wikiEntry,
  wikiCatalog,
  wikiStatKeys,
  type WikiMove,
  type WikiPokemon,
  type WikiNamed,
} from './wiki';
const pokemon = (name: string, gen: Parameters<typeof wikiEntry>[2]) =>
  wikiEntry('pokemon', name, gen) as WikiPokemon;
const move = (name: string, gen: Parameters<typeof wikiEntry>[2]) =>
  wikiEntry('moves', name, gen) as WikiMove;
describe('MiniWiki histórica y Champions', () => {
  it('encuentra las cuatro categorías de la referencia en una sola búsqueda', () => {
    const entries = searchWiki(7, 'heat');
    for (const name of [
      'Heatmor',
      'Heatran',
      'Rotom-Heat',
      'Heatproof',
      'Heat Wave',
      'Heat Crash',
      'Heat Rock',
      'Overheat',
    ])
      expect(entries.some((entry) => entry.name === name)).toBe(true);
    expect(new Set(entries.map((entry) => entry.kind)).size).toBe(4);
  });
  it('respeta tipos, estadísticas e introducción de Pokémon por generación', () => {
    expect(pokemon('clefairy', 5).types).toEqual(['normal']);
    expect(pokemon('clefairy', 6).types).toEqual(['fairy']);
    expect(pokemon('rotomheat', 4).types).toEqual(['electric', 'ghost']);
    expect(pokemon('rotomheat', 5).types).toEqual(['electric', 'fire']);
    expect(pokemon('heatran', 7).baseStats).toEqual({
      hp: 91,
      atk: 90,
      def: 106,
      spa: 130,
      spd: 106,
      spe: 77,
    });
    expect(wikiEntry('pokemon', 'heatran', 3)).toBeNull();
    expect(wikiEntry('moves', 'bodypress', 1)).toBeNull();
    expect(wikiEntry('abilities', 'sturdy', 4)?.kind).toBe('abilities');
    expect((wikiEntry('abilities', 'sturdy', 4) as WikiNamed).description).not.toBe(
      (wikiEntry('abilities', 'sturdy', 5) as WikiNamed).description,
    );
    expect(wikiStatKeys(1)).toEqual(['hp', 'atk', 'def', 'spa', 'spe']);
  });
  it('distingue habilidades normales y ocultas y respeta los cambios históricos', () => {
    expect(pokemon('gengar', 6).abilities).toEqual(['Levitate']);
    expect(pokemon('gengar', 7).abilities).toEqual(['Cursed Body']);
    expect(pokemon('heatran', 4).hiddenAbility).toBeNull();
    expect(pokemon('heatran', 7).abilities).toEqual(['Flash Fire']);
    expect(pokemon('heatran', 7).hiddenAbility).toBe('Flame Body');
    expect(pokemon('bulbasaur', 2).abilities).toEqual([]);
    expect(wikiCatalog(2).filter((entry) => entry.kind === 'abilities')).toHaveLength(0);
    expect(wikiCatalog(1).filter((entry) => entry.kind === 'items')).toHaveLength(0);
  });
  it('busca nombres en español e inglés sin distinguir acentos y permite filtrar', () => {
    expect(searchWiki(7, 'ignifugo', 'abilities')[0].name).toBe('Heatproof');
    expect(searchWiki(7, 'onda ignea', 'moves')[0].name).toBe('Heat Wave');
    expect(searchWiki(7, 'roca calor', 'items')[0].name).toBe('Heat Rock');
    expect(searchWiki(7, 'Heat Rock')[0].name).toBe('Heat Rock');
    expect(searchWiki(7, 'heat', 'pokemon').every((entry) => entry.kind === 'pokemon')).toBe(true);
  });
  it('muestra datos de movimiento y PP base clásicos, y PP propios de Champions', () => {
    expect(move('heatwave', 7)).toMatchObject({
      type: 'fire',
      category: 'Special',
      power: 95,
      accuracy: 90,
      pp: 10,
      maxPP: 16,
    });
    expect(move('heatwave', 5).power).toBe(100);
    expect(move('heatwave', 0).pp).toBe(12);
    expect(move('protect', 0).pp).toBe(8);
    expect(move('thunderwave', 6).accuracy).toBe(100);
    expect(move('thunderwave', 7).accuracy).toBe(90);
    expect(move('shadowball', 3).category).toBe('Physical');
    expect(move('shadowball', 4).category).toBe('Special');
    expect(move('heatwave', 7).effects).toEqual(['10% de quemar al objetivo.']);
  });
  it('aplica efectos secundarios y descripciones modificadas de Champions', () => {
    expect(move('moonblast', 9).effects.join(' ')).toContain('30%');
    expect(move('moonblast', 0).effects.join(' ')).toContain('10%');
    expect(move('ironhead', 9).effects.join(' ')).toContain('30%');
    expect(move('ironhead', 0).effects.join(' ')).toContain('20%');
    expect(move('freezedry', 9).effects.join(' ')).toContain('congelar');
    expect(move('freezedry', 0).effects).toEqual([]);
    expect((wikiEntry('abilities', 'healer', 9) as WikiNamed).description).toContain('30%');
    expect((wikiEntry('abilities', 'healer', 0) as WikiNamed).description).toContain('50%');
    expect((wikiEntry('abilities', 'unseenfist', 0) as WikiNamed).description).toContain('1/4');
    expect((wikiEntry('abilities', 'runaway', 0) as WikiNamed).description).toContain(
      'cannot be trapped',
    );
  });
  it('no incluye contenido de fans o futuro y permite las novedades habilitadas por Champions', () => {
    expect(wikiEntry('abilities', 'mountaineer', 9)).toBeNull();
    expect(wikiEntry('abilities', 'dragonize', 9)).toBeNull();
    expect(wikiEntry('abilities', 'dragonize', 0)).not.toBeNull();
    expect(wikiEntry('moves', 'hiddenpower', 7)?.nonstandard).not.toBe('Past');
  });
  it('usa la descripción de objetos del perfil y agrupa aumentos bajo su probabilidad común', () => {
    expect((wikiEntry('items', 'sitrusberry', 3) as WikiNamed).description).toContain('30 HP');
    expect((wikiEntry('items', 'sitrusberry', 4) as WikiNamed).description).toContain('1/4');
    const effect = move('ancientpower', 7).effects;
    expect(effect).toHaveLength(1);
    expect(effect[0].match(/10%/g)).toHaveLength(1);
    expect(effect[0]).toContain('al usuario');
  });
  it('cada resultado de cada perfil contiene los datos requeridos y no necesita una consulta de API', () => {
    for (const gen of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
      const entries = wikiCatalog(gen);
      expect(entries.length).toBeGreaterThan(150);
      for (const entry of entries) {
        expect(entry.name).toBeTruthy();
        if (entry.kind === 'pokemon') {
          expect(entry.types.length).toBeGreaterThan(0);
          expect(Number.isFinite(entry.baseStats.hp)).toBe(true);
        } else {
          expect(entry.description).toBeTruthy();
          if (entry.kind === 'moves') {
            expect(entry.pp).toBeTypeOf('number');
            expect(entry.accuracy === null || typeof entry.accuracy === 'number').toBe(true);
          }
        }
      }
    }
  });
});
