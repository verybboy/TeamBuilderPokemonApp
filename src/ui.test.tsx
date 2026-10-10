// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { Pokemon } from '@smogon/calc';
import App from './App';
import { createMember, emptyTeams, type PokemonData, type Member } from './model';
import { loadPokemon } from './api';
function fixture(name: string): PokemonData {
  const p = new Pokemon(9, name);
  return {
    name,
    apiName: name.toLowerCase(),
    number: 1,
    types: p.types.map((t) => t.toLowerCase()),
    baseStats: p.species.baseStats,
    abilities:
      name === 'Torkoal'
        ? ['Drought', 'White Smoke']
        : name === 'Pikachu'
          ? ['Static', 'Lightning Rod']
          : [p.ability!],
    moves:
      name === 'Torkoal'
        ? ['Protect', 'Heat Wave', 'Eruption', 'Weather Ball']
        : name === 'Garchomp'
          ? ['Earthquake', 'Dragon Claw', 'Rock Slide', 'Protect']
          : ['Thunderbolt', 'Quick Attack', 'Protect', 'Thunder'],
    sprite: 'https://example.com/sprite.png',
    shinySprite: 'https://example.com/shiny.png',
    genders: ['M', 'F'],
  };
}
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, loadPokemon: vi.fn(async (name: string) => fixture(name)) };
});
const KEY = 'pokemon-team-lab:v1';
function member(name: string): Member {
  const m = createMember(fixture(name));
  m.moves = [...m.data.moves];
  return m;
}
function saved() {
  const teams = emptyTeams();
  teams[0].slots[0] = member('Garchomp');
  teams[0].slots[1] = member('Pikachu');
  teams[1].slots[0] = member('Torkoal');
  localStorage.setItem(KEY, JSON.stringify({ version: 1, gen: 9, teams }));
}
beforeEach(() => {
  localStorage.clear();
  vi.mocked(loadPokemon).mockImplementation(async (name) => fixture(name));
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
  vi.stubGlobal('scrollTo', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('Flujos completos de interfaz', () => {
  it('muestra doce plazas y exige una selección para las acciones', () => {
    render(<App />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(12);
    expect(
      (screen.getByRole('button', { name: 'Añadir / editar' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Enfrentar Pokémon' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar plaza 1 de equipo 1' }));
    expect(
      (screen.getByRole('button', { name: 'Añadir / editar' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
  it('añade una especie, valida movimientos y conserva PS al cambiar IVs', async () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /Añadir Pokémon/ })[0]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Especie Pokémon' }), {
      target: { value: 'Torkoal' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar especie' }));
    await screen.findByRole('button', { name: 'Guardar Pokémon' });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Pokémon' }));
    expect(screen.getByRole('alert').textContent).toContain('al menos un movimiento');
    fireEvent.change(screen.getByRole('combobox', { name: 'Movimiento 1' }), {
      target: { value: 'Heat Wave' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Porcentaje de PS' }), {
      target: { value: '50' },
    });
    const oldHP = Number(
      (screen.getByRole('spinbutton', { name: 'PS actuales' }) as HTMLInputElement).value,
    );
    fireEvent.change(screen.getByRole('spinbutton', { name: 'IV PS' }), { target: { value: '0' } });
    expect(
      Number((screen.getByRole('spinbutton', { name: 'PS actuales' }) as HTMLInputElement).value),
    ).toBeLessThan(oldHP);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Pokémon' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const saved = JSON.parse(localStorage.getItem(KEY)!);
    expect(saved.teams[0].slots[0].hpPercent).toBe(50);
    expect(saved.teams[0].slots[0].ivs.hp).toBe(0);
    expect(saved.teams[0].slots[0].level).toBe(50);
  });
  it('importa, exporta y restaura un Pokémon con datos reales del formulario', async () => {
    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto de Showdown' }), {
      target: { value: 'Torkoal @ Charcoal\nAbility: Drought\nQuiet Nature\n- Heat Wave' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Importar Pokémon' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Torkoal' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(
      (screen.getByRole('textbox', { name: 'Texto de Showdown' }) as HTMLTextAreaElement).value,
    ).toContain('Torkoal (M) @ Charcoal');
    expect(
      (screen.getByRole('textbox', { name: 'Texto de Showdown' }) as HTMLTextAreaElement).value,
    ).toContain('Level: 50');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ventana' }));
    view.unmount();
    render(<App />);
    expect(screen.getByRole('button', { name: 'Torkoal' })).toBeDefined();
  });
  it('rechaza importaciones inválidas sin alterar los equipos', async () => {
    saved();
    const before = localStorage.getItem(KEY);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto de Showdown' }), {
      target: { value: 'Torkoal\nAbility: Levitate\n- Heat Wave' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Importar Pokémon' }));
    await screen.findByRole('alert');
    expect(localStorage.getItem(KEY)).toBe(before);
    expect(screen.getByRole('alert').textContent).toContain('Habilidad no válida');
  });
  it('exige equipos distintos y abre un cálculo bidireccional con cuatro movimientos', async () => {
    saved();
    render(<App />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar plaza 1 de equipo 1:/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar plaza 2 de equipo 1:/ }));
    expect(
      (screen.getByRole('button', { name: 'Enfrentar Pokémon' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar plaza 2 de equipo 1:/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar plaza 1 de equipo 2:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enfrentar Pokémon' }));
    const dialog = screen.getByRole('dialog', { name: 'Calculadora de daño' });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Heat Wave/ }));
    expect(within(dialog).getByText('Garchomp → Torkoal')).toBeDefined();
    expect(within(dialog).getByText('Torkoal → Garchomp')).toBeDefined();
    expect(within(dialog).getAllByRole('checkbox', { name: /Crítico/ })).toHaveLength(8);
    expect(within(dialog).getByText('Garchomp atacaría primero')).toBeDefined();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Espacio Raro' }));
    expect(within(dialog).getByText('Torkoal atacaría primero')).toBeDefined();
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });
  it('permite cancelar el borrado y liberar únicamente la plaza elegida', () => {
    saved();
    render(<App />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar plaza 1 de equipo 1:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Garchomp' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Borrar Pokémon' }));
    expect(screen.queryByRole('button', { name: 'Garchomp' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pikachu' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Torkoal' })).toBeDefined();
  });
  it('conserva generación y equipos ante un cambio incompatible', async () => {
    saved();
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Generación' }), {
      target: { value: '1' },
    });
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('No se ha cambiado la generación'),
    );
    expect((screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).value).toBe(
      '9',
    );
    expect(JSON.parse(localStorage.getItem(KEY)!).gen).toBe(9);
  });
  it('avisa si el almacenamiento falla', async () => {
    render(<App />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota', 'QuotaExceededError');
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre equipo 1' }), {
      target: { value: 'Sol' },
    });
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('No se pudo guardar'),
    );
  });
  it('no sobrescribe un guardado corrupto al abrir la aplicación', () => {
    localStorage.setItem(KEY, 'corrupt');
    render(<App />);
    expect(screen.getByRole('status').textContent).toContain('No se pudo restaurar');
    expect(localStorage.getItem(KEY)).toBe('corrupt');
  });
});
