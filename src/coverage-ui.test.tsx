// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { Pokemon } from '@smogon/calc';
import { createMember, emptyTeams, type Gen, type PokemonData } from './model';
import DefensiveCoverage from './DefensiveCoverage';
import { loadPokemon } from './api';

vi.mock('./api', () => ({ loadPokemon: vi.fn() }));
function team(stone = 'Charizardite X') {
  const p = new Pokemon(9, 'Charizard');
  const data: PokemonData = {
    name: 'Charizard',
    apiName: 'charizard',
    number: 6,
    types: ['fire', 'flying'],
    baseStats: p.species.baseStats,
    abilities: [p.ability!],
    moves: ['Flamethrower', 'Protect'],
    sprite: 'base.png',
    shinySprite: 'base-shiny.png',
    genders: ['M', 'F'],
  };
  const team = emptyTeams()[0];
  team.name = 'Sol';
  team.slots[0] = createMember(data);
  team.slots[0].item = stone;
  team.slots[0].moves = ['Flamethrower', 'Protect', '', ''];
  return team;
}
function row(type: string, table = screen.getByRole('table')) {
  return within(table).getByRole('rowheader', { name: type }).closest('tr')!;
}
function values(type: string, table = screen.getByRole('table')) {
  return within(row(type, table))
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
}
beforeEach(() => {
  vi.mocked(loadPokemon).mockImplementation(
    async (name) => ({ sprite: `${name}.png`, shinySprite: `${name}-shiny.png` }) as PokemonData,
  );
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe('Megaevolución en la cobertura defensiva', () => {
  it.each([0, 9] as Gen[])(
    'cambia tipos, imagen y totales de Charizard X y permite volver, perfil %s',
    async (gen) => {
      const original = team(),
        before = structuredClone(original);
      render(<DefensiveCoverage team={original} gen={gen} />);
      const toggle = screen.getByRole('checkbox', {
        name: 'Megaevolucionar Charizard para cobertura de Sol, plaza 1',
      });
      expect(values('Tierra').slice(-2)).toEqual(['0', '1']);
      fireEvent.click(toggle);
      expect(values('Tierra')[0]).toBe('2×');
      expect(values('Tierra').slice(-2)).toEqual(['1', '0']);
      expect(values('Eléctrico')[0]).toBe('½');
      expect(values('Eléctrico').slice(-2)).toEqual(['0', '1']);
      expect(screen.getByRole('columnheader', { name: /Charizard-Mega-X/ }).textContent).toContain(
        'Dragón',
      );
      expect(
        (await screen.findByRole('img', { name: 'Charizard-Mega-X' })).getAttribute('src'),
      ).toBe('Charizard-Mega-X.png');
      expect(original).toEqual(before);
      fireEvent.click(toggle);
      expect(values('Tierra')[0]).toBe('Inmune');
      expect(screen.getByRole('img', { name: 'Charizard' }).getAttribute('src')).toBe('base.png');
    },
  );
  it('Charizard Y mantiene la cobertura de tipos y muestra su forma variocolor', async () => {
    const original = team('Charizardite Y');
    original.slots[0]!.shiny = true;
    render(<DefensiveCoverage team={original} gen={9} />);
    const before = screen.getByRole('table').querySelector('tbody')!.textContent;
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('table').querySelector('tbody')!.textContent).toBe(before);
    expect(
      (await screen.findByRole('img', { name: 'Charizard-Mega-Y variocolor' })).getAttribute('src'),
    ).toBe('Charizard-Mega-Y-shiny.png');
  });
  it('solo ofrece el control con una megapiedra compatible y un perfil que admite su forma', () => {
    const original = team('Garchompite'),
      view = render(<DefensiveCoverage team={original} gen={9} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    view.rerender(<DefensiveCoverage team={team('Charizardite X')} gen={5} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    view.rerender(<DefensiveCoverage team={team('Leftovers')} gen={9} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('reinicia la selección al cambiar la piedra, vaciar la plaza o cambiar de perfil', async () => {
    const original = team(),
      view = render(<DefensiveCoverage team={original} gen={9} />);
    fireEvent.click(screen.getByRole('checkbox'));
    await screen.findByRole('img', { name: 'Charizard-Mega-X' });
    view.rerender(<DefensiveCoverage team={team('Charizardite Y')} gen={9} />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    view.rerender(<DefensiveCoverage team={original} gen={9} />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('checkbox'));
    view.rerender(<DefensiveCoverage team={{ ...original, slots: Array(6).fill(null) }} gen={9} />);
    view.rerender(<DefensiveCoverage team={original} gen={9} />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('checkbox'));
    view.rerender(<DefensiveCoverage team={original} gen={5} />);
    view.rerender(<DefensiveCoverage team={original} gen={9} />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });
  it('mantiene el cálculo sin red y permite reintentar la imagen desactivando y activando Mega', async () => {
    vi.mocked(loadPokemon).mockRejectedValueOnce(new Error('Sin conexión'));
    render(<DefensiveCoverage team={team()} gen={9} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(values('Tierra')[0]).toBe('2×');
    await waitFor(() => expect(screen.getByTitle(/Imagen no disponible/)).toBeDefined());
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('checkbox'));
    await screen.findByRole('img', { name: 'Charizard-Mega-X' });
    expect(values('Tierra')[0]).toBe('2×');
  });
  it('las selecciones de los dos equipos son independientes', async () => {
    const a = team(),
      b = team();
    b.name = 'Luna';
    render(
      <>
        <DefensiveCoverage team={a} gen={9} />
        <DefensiveCoverage team={b} gen={9} />
      </>,
    );
    const tables = screen.getAllByRole('table');
    fireEvent.click(within(tables[0]).getByRole('checkbox'));
    await within(tables[0]).findByRole('img', { name: 'Charizard-Mega-X' });
    expect(values('Tierra', tables[0])[0]).toBe('2×');
    expect(values('Tierra', tables[1])[0]).toBe('Inmune');
    expect((within(tables[1]).getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });
});
