// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { Pokemon } from '@smogon/calc';
import App from './App';
import { createMember, emptyTeams, type PokemonData, type Member } from './model';
import { loadPokemon, loadItemSprite } from './api';
import { Sprite } from './components';
import { LIBRARY_KEY, addConfiguration } from './library';
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
  return {
    ...actual,
    loadPokemon: vi.fn(async (name: string) => fixture(name)),
    loadItemSprite: vi.fn(async (item: string) => `https://example.com/${item}.png`),
  };
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
  vi.mocked(loadItemSprite).mockImplementation(async (item) => `https://example.com/${item}.png`);
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
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:configuration'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
describe('Champions, naturalezas, tema y configuraciones', () => {
  it('activa Champions y limita el editor a 32 SP / 66 con nivel e IVs fijos', async () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Generación' }), {
      target: { value: '0' },
    });
    await waitFor(() =>
      expect(
        (screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Añadir Pokémon/ })[0]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Especie Pokémon' }), {
      target: { value: 'Torkoal' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar especie' }));
    await screen.findByRole('button', { name: 'Guardar Pokémon' });
    expect((screen.getByRole('spinbutton', { name: 'Nivel' }) as HTMLInputElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('spinbutton', { name: 'IV PS' }) as HTMLInputElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('spinbutton', { name: 'EV PS' }) as HTMLInputElement).max).toBe('32');
    expect((screen.getByRole('spinbutton', { name: 'EV PS' }) as HTMLInputElement).disabled).toBe(
      false,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Movimiento 1' }), {
      target: { value: 'Heat Wave' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'EV PS' }), {
      target: { value: '32' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'EV At. Esp.' }), {
      target: { value: '32' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'EV Defensa' }), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Pokémon' }));
    expect(screen.getByRole('alert').textContent).toContain('66');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'EV Defensa' }), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Pokémon' }));
    expect(JSON.parse(localStorage.getItem(KEY)!).teams[0].slots[0].evs.def).toBe(2);
  });
  it('muestra las estadísticas de cada naturaleza y sus flechas de color', () => {
    saved();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Garchomp' }));
    expect(screen.getByRole('option', { name: 'Adamant (↑ Ataque / ↓ At. Esp.)' })).toBeDefined();
    fireEvent.change(screen.getByRole('combobox', { name: 'Naturaleza' }), {
      target: { value: 'Adamant' },
    });
    expect(
      screen
        .getByRole('img', { name: 'Sube Ataque por naturaleza' })
        .classList.contains('nature-up'),
    ).toBe(true);
    expect(
      screen
        .getByRole('img', { name: 'Baja At. Esp. por naturaleza' })
        .classList.contains('nature-down'),
    ).toBe(true);
    fireEvent.change(screen.getByRole('combobox', { name: 'Naturaleza' }), {
      target: { value: 'Hardy' },
    });
    expect(screen.queryByRole('img', { name: /por naturaleza/ })).toBeNull();
  });
  it('borra todos los Pokémon seleccionados de ambos equipos e ignora las plazas vacías', () => {
    saved();
    render(<App />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar plaza 1 de equipo 1:/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar plaza 1 de equipo 2:/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar plaza 6 de equipo 2' }));
    const button = screen.getByRole('button', { name: 'Borrar' });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/borrar los 2 Pokémon/)).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Borrar Pokémon' }));
    expect(screen.queryByRole('button', { name: 'Garchomp' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Torkoal' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pikachu' })).toBeDefined();
    const teams = JSON.parse(localStorage.getItem(KEY)!).teams;
    expect(teams[0].slots[0]).toBeNull();
    expect(teams[1].slots[0]).toBeNull();
  });
  it('persiste el modo oscuro y permite volver al claro', () => {
    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a modo oscuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('pokemon-team-lab:theme')).toBe('dark');
    view.unmount();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a modo claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
  it('guarda sin descargar, permite descargar desde la tabla y añade al equipo destino con un clic', async () => {
    saved();
    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Garchomp' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de configuración' }), {
      target: { value: 'Tiburón ofensivo' },
    });
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Editar Pokémon' })).getByRole('button', {
        name: 'Guardar configuración',
      }),
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ventana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    expect(screen.getByRole('table')).toBeDefined();
    expect(screen.getByRole('columnheader', { name: /Reparto EVs/ })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'Naturaleza' })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'Movimientos' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar Tiburón ofensivo .txt' }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('combobox', { name: 'Equipo de destino' }), {
      target: { value: '1' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Añadir Tiburón ofensivo a Equipo Eclipse' }),
    );
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('añadida'));
    const teams = JSON.parse(localStorage.getItem(KEY)!).teams;
    expect(teams[1].slots[0].data.name).toBe('Torkoal');
    expect(teams[1].slots[1].data.name).toBe('Garchomp');
    expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).entries[0].name).toBe('Tiburón ofensivo');
    view.unmount();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    expect(screen.getByText('Tiburón ofensivo')).toBeDefined();
  });
  it('desactiva añadir si el equipo está lleno y mantiene la biblioteca', () => {
    const teams = emptyTeams();
    teams[0].slots = Array.from({ length: 6 }, () => member('Garchomp'));
    localStorage.setItem(KEY, JSON.stringify({ version: 1, gen: 9, teams }));
    const library = addConfiguration([], member('Garchomp'), 9, 'Ataque');
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, entries: library.entries }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    expect(
      (screen.getByRole('button', { name: 'Añadir Ataque a Equipo Aurora' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).entries).toHaveLength(1);
  });
  it('importa un archivo .txt en la biblioteca sin modificar los equipos', async () => {
    saved();
    const before = localStorage.getItem(KEY);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    const text = 'Torkoal @ Charcoal\nAbility: Drought\nQuiet Nature\n- Heat Wave';
    const file = new File([text], 'Sol.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: async () => text });
    fireEvent.change(screen.getByLabelText('Importar archivo de configuración'), {
      target: { files: [file] },
    });
    await screen.findByText('Sol');
    expect(localStorage.getItem(KEY)).toBe(before);
    expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).entries[0].member.nature).toBe('Quiet');
  });
  it('guarda el Pokémon seleccionado sin descargar archivos', () => {
    saved();
    render(<App />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar plaza 1 de equipo 1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).entries).toHaveLength(1);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
  it('permite cancelar y elimina solo la configuración confirmada, conservando los equipos', () => {
    saved();
    const before = localStorage.getItem(KEY);
    let entries = addConfiguration([], member('Garchomp'), 9, 'Ataque').entries;
    entries = addConfiguration(entries, member('Pikachu'), 9, 'Velocidad').entries;
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, entries }));
    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Ataque' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).entries).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Ataque' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar configuración' }));
    expect(screen.queryByRole('button', { name: 'Eliminar Ataque' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Eliminar Velocidad' })).toBeDefined();
    expect(localStorage.getItem(KEY)).toBe(before);
    view.unmount();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    expect(screen.queryByRole('button', { name: 'Eliminar Ataque' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Velocidad' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar configuración' }));
    expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).entries).toHaveLength(0);
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('conserva la configuración si falla el almacenamiento al eliminarla', () => {
    const library = addConfiguration([], member('Garchomp'), 9, 'Ataque');
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, entries: library.entries }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Ataque' }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar configuración' }));
    const dialog = screen.getByRole('dialog', { name: 'Eliminar configuración' });
    expect(within(dialog).getByRole('alert').textContent).toContain('No se pudo eliminar');
    expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).entries).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Eliminar Ataque' })).toBeDefined();
  });
  it('muestra el objeto equipado, actualiza su imagen y admite imagen fallida o sin objeto', async () => {
    const m = member('Garchomp');
    m.item = 'Choice Scarf';
    const view = render(<Sprite member={m} />);
    const scarf = await screen.findByRole('img', { name: 'Objeto equipado: Choice Scarf' });
    expect(scarf.getAttribute('src')).toBe('https://example.com/Choice Scarf.png');
    view.rerender(<Sprite member={{ ...m, item: 'Sitrus Berry' }} />);
    const berry = await screen.findByRole('img', { name: 'Objeto equipado: Sitrus Berry' });
    expect(screen.queryByRole('img', { name: 'Objeto equipado: Choice Scarf' })).toBeNull();
    fireEvent.error(berry);
    expect(
      screen.getByRole('img', { name: /Sitrus Berry \(imagen no disponible\)/ }),
    ).toBeDefined();
    view.rerender(<Sprite member={{ ...m, item: '' }} />);
    expect(screen.queryByRole('img', { name: /Objeto equipado/ })).toBeNull();
  });
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
