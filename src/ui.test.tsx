// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within, act } from '@testing-library/react';
import { Pokemon } from '@smogon/calc';
import App from './App';
import { createMember, emptyTeams, type PokemonData, type Member, type Gen } from './model';
import Calculator from './Calculator';
import { activeLab, restoreWorkspace, serializeWorkspace, emptyWorkspace, addLab } from './labs';
import { loadPokemon, loadItemSprite } from './api';
import { Sprite } from './components';
import { LIBRARY_KEY, TEAM_LIBRARY_KEY, addConfiguration, addTeamConfiguration } from './library';
import {
  createStorageBackup,
  parseStorageBackup,
  APP_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type StorageBackup,
} from './backup';
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
    sprite: `https://example.com/${name}.png`,
    shinySprite: `https://example.com/${name}-shiny.png`,
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
function readConstructor() {
  const workspace = restoreWorkspace(localStorage.getItem(KEY));
  if (!workspace) throw new Error('Constructor guardado inválido');
  return { version: 1, ...activeLab(workspace) };
}
function member(name: string): Member {
  const m = createMember(fixture(name));
  m.moves = [...m.data.moves];
  return m;
}
function charizard(stone: string): Member {
  const m = member('Charizard');
  m.item = stone;
  m.moves = ['Flamethrower', 'Dragon Claw', 'Protect', 'Air Slash'];
  m.data.moves = [...m.moves];
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
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:configuration'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
describe('Calculadora de tipos y perfil Locke', () => {
  it('abre la calculadora desde el lateral sin modificar los equipos', async () => {
    saved();
    render(<App />);
    const before = localStorage.getItem(KEY);
    fireEvent.click(screen.getByRole('button', { name: 'Calculadora de tipos' }));
    await screen.findByRole('heading', { name: 'Calculadora de tipos' });
    fireEvent.click(screen.getByRole('button', { name: 'Cobertura defensiva' }));
    const choices = within(screen.getByRole('group', { name: 'Tipos disponibles' }));
    fireEvent.click(choices.getByRole('button', { name: 'Fuego' }));
    fireEvent.click(choices.getByRole('button', { name: 'Volador' }));
    expect(screen.getByRole('heading', { name: /Sufre 4× por/ })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Constructor de equipos' }));
    expect(localStorage.getItem(KEY)).toBe(before);
    expect(screen.getByRole('button', { name: 'Garchomp' })).toBeDefined();
  });
  it('edita combinaciones libres, guarda y restaura Locke, y rechaza el cambio a IX si son incompatibles', async () => {
    saved();
    const view = render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Generación' }), {
      target: { value: '10' },
    });
    await waitFor(() => expect(readConstructor().gen).toBe(10));
    fireEvent.click(screen.getByRole('button', { name: 'Pikachu' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Habilidad' }), {
      target: { value: 'Huge Power' },
    });
    const input = screen.getByRole('combobox', { name: 'Movimiento 1' });
    fireEvent.change(input, { target: { value: 'Earthquake' } });
    fireEvent.click(screen.getByRole('option', { name: 'Earthquake' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Pokémon' }));
    await waitFor(() => expect(readConstructor().teams[0].slots[1]!.ability).toBe('Huge Power'));
    expect(readConstructor().teams[0].slots[1]!.moves[0]).toBe('Earthquake');
    view.unmount();
    render(<App />);
    expect((screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).value).toBe(
      '10',
    );
    const before = localStorage.getItem(KEY);
    fireEvent.change(screen.getByRole('combobox', { name: 'Generación' }), {
      target: { value: '9' },
    });
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Habilidad no válida'),
    );
    expect((screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).value).toBe(
      '10',
    );
    expect(localStorage.getItem(KEY)).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'MiniWiki' }));
    await screen.findByRole('heading', { name: 'MiniWiki' });
    expect(
      (screen.getByRole('combobox', { name: 'Generación de MiniWiki' }) as HTMLSelectElement).value,
    ).toBe('9');
  }, 20000);
});
describe('LABs independientes', () => {
  function confirmLabClosure() {
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con el cierre' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Escribe CERRAR para confirmar' }), {
      target: { value: 'CERRAR' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y cerrar LAB' }));
  }
  it('permite cancelar ambos pasos y exige la segunda confirmación antes de cerrar el LAB inactivo', () => {
    saved();
    const libraryTeam = emptyTeams()[0];
    libraryTeam.slots[0] = member('Pikachu');
    localStorage.setItem(
      LIBRARY_KEY,
      JSON.stringify({
        version: 1,
        entries: addConfiguration([], member('Pikachu'), 9, 'Ratón').entries,
      }),
    );
    localStorage.setItem(
      TEAM_LIBRARY_KEY,
      JSON.stringify({
        version: 1,
        entries: addTeamConfiguration([], libraryTeam, 9, 'Ratón guardado').entries,
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir LAB' }));
    const before = localStorage.getItem(KEY),
      pokemon = localStorage.getItem(LIBRARY_KEY),
      teams = localStorage.getItem(TEAM_LIBRARY_KEY);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar LAB 1' }));
    expect(screen.getByRole('tab', { name: /LAB 2/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('dialog').textContent).toContain('Garchomp');
    expect(localStorage.getItem(KEY)).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(localStorage.getItem(KEY)).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar LAB 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con el cierre' }));
    expect(
      (screen.getByRole('button', { name: 'Confirmar y cerrar LAB' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(localStorage.getItem(KEY)).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar LAB 1' }));
    confirmLabClosure();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('tab', { name: /LAB 1/ })).toBeNull();
    expect(screen.getByRole('tab', { name: /LAB 2/ }).getAttribute('aria-selected')).toBe('true');
    expect(restoreWorkspace(localStorage.getItem(KEY))!.labs).toHaveLength(1);
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(pokemon);
    expect(localStorage.getItem(TEAM_LIBRARY_KEY)).toBe(teams);
  }, 15000);
  it('cierra el activo, abre su vecino y conserva los LABs restantes al recargar', () => {
    saved();
    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir LAB' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar LAB 2' }));
    confirmLabClosure();
    expect(screen.getByRole('tab', { name: /LAB 1/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Garchomp' })).toBeDefined();
    view.unmount();
    render(<App />);
    expect(screen.queryByRole('tab', { name: /LAB 2/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Garchomp' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir LAB' }));
    expect(screen.getByRole('tab', { name: /LAB 2/ }).getAttribute('aria-selected')).toBe('true');
  }, 15000);
  it('al cerrar el último LAB deja uno vacío, persistido y utilizable', () => {
    saved();
    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar LAB 1' }));
    expect(screen.getByRole('dialog').textContent).toContain('último LAB');
    confirmLabClosure();
    expect(screen.queryByRole('button', { name: 'Garchomp' })).toBeNull();
    expect(restoreWorkspace(localStorage.getItem(KEY))).toEqual(emptyWorkspace());
    view.unmount();
    render(<App />);
    expect(screen.getByRole('tab', { name: /LAB 1/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('button', { name: /^Añadir Pokémon/ })).toHaveLength(12);
  }, 15000);
  it('si falla el guardado conserva el LAB y permite reintentar el cierre', () => {
    saved();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir LAB' }));
    const before = localStorage.getItem(KEY),
      original = Storage.prototype.setItem;
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === KEY) throw new DOMException('Blocked', 'SecurityError');
      return original.call(this, key, value);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar LAB 2' }));
    confirmLabClosure();
    expect(screen.getByRole('alert').textContent).toContain('No se pudo cerrar el LAB');
    expect(localStorage.getItem(KEY)).toBe(before);
    expect(screen.getByRole('tab', { name: /LAB 2/ }).getAttribute('aria-selected')).toBe('true');
    failure.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y cerrar LAB' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(restoreWorkspace(localStorage.getItem(KEY))!.labs).toHaveLength(1);
  }, 15000);
  it('migra LAB 1, crea hasta cinco, conserva equipos y mecánicas y restaura el LAB activo', async () => {
    saved();
    const original = localStorage.getItem(KEY);
    const view = render(<App />);
    expect(screen.getByRole('tab', { name: /LAB 1/ }).getAttribute('aria-selected')).toBe('true');
    expect(localStorage.getItem(KEY)).toBe(original);
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 1:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Añadir LAB' }));
    expect(screen.getByRole('tab', { name: /LAB 2/ }).getAttribute('aria-selected')).toBe('true');
    expect((screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).value).toBe(
      '0',
    );
    expect(screen.queryByRole('button', { name: 'Garchomp' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Añadir Pokémon/ })).toHaveLength(12);
    expect(
      (screen.getByRole('button', { name: 'Enfrentar Pokémon' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre del LAB' }), {
      target: { value: 'Random Locke' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Generación' }), {
      target: { value: '10' },
    });
    await waitFor(() => expect(readConstructor().gen).toBe(10));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre equipo 1' }), {
      target: { value: 'Aleatorio' },
    });
    fireEvent.click(screen.getByRole('tab', { name: /LAB 1/ }));
    expect((screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).value).toBe(
      '9',
    );
    expect(screen.getByRole('button', { name: 'Garchomp' })).toBeDefined();
    expect(
      screen
        .getByRole('button', { name: /Seleccionar plaza 1 de equipo 1:/ })
        .getAttribute('aria-pressed'),
    ).toBe('false');
    fireEvent.click(screen.getByRole('tab', { name: /Random Locke/ }));
    expect(
      (screen.getByRole('textbox', { name: 'Nombre equipo 1' }) as HTMLInputElement).value,
    ).toBe('Aleatorio');
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Añadir LAB' }));
    expect(
      within(screen.getByRole('tablist', { name: 'LABs del constructor' })).getAllByRole('tab'),
    ).toHaveLength(5);
    expect((screen.getByRole('button', { name: 'Añadir LAB' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    const raw = JSON.parse(localStorage.getItem(KEY)!);
    expect(raw.version).toBe(2);
    expect(raw.labs).toHaveLength(5);
    expect(raw.labs[0].teams).toEqual(JSON.parse(original!).teams);
    expect(raw.labs[1].gen).toBe(10);
    view.unmount();
    render(<App />);
    expect(screen.getByRole('tab', { name: /LAB 5/ }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: /Random Locke/ }));
    expect((screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).value).toBe(
      '10',
    );
  }, 15000);
  it('dirige Pokémon y equipos guardados al LAB elegido y conserva los demás LABs', async () => {
    saved();
    localStorage.setItem(
      LIBRARY_KEY,
      JSON.stringify({
        version: 1,
        entries: addConfiguration([], member('Pikachu'), 9, 'Ratón').entries,
      }),
    );
    const team = emptyTeams()[0];
    team.slots[2] = member('Torkoal');
    localStorage.setItem(
      TEAM_LIBRARY_KEY,
      JSON.stringify({ version: 1, entries: addTeamConfiguration([], team, 9, 'Sol').entries }),
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir LAB' }));
    fireEvent.click(screen.getByRole('tab', { name: /LAB 1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    expect(
      screen.getByRole('heading', { name: 'Mis configuraciones' }).querySelector('.pill'),
    ).toBeNull();
    expect(screen.getByRole('tab', { name: /Mis Pokémon/ }).textContent).toContain('1');
    expect(screen.getByRole('tab', { name: /Mis equipos/ }).textContent).toContain('1');
    const workspace = restoreWorkspace(localStorage.getItem(KEY))!;
    const original = structuredClone(workspace.labs[0]);
    fireEvent.change(screen.getByRole('combobox', { name: 'LAB de implementación' }), {
      target: { value: workspace.labs[1].id },
    });
    expect(
      (screen.getByRole('combobox', { name: 'Mecánicas de la biblioteca' }) as HTMLSelectElement)
        .value,
    ).toBe('0');
    expect(screen.queryByRole('button', { name: /Añadir Ratón/ })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Mecánicas de la biblioteca' }), {
      target: { value: '9' },
    });
    await screen.findByRole('button', { name: /Añadir Ratón/ });
    fireEvent.click(screen.getByRole('button', { name: /Añadir Ratón/ }));
    await waitFor(() => expect(readConstructor().teams[0].slots[0]?.data.name).toBe('Pikachu'));
    expect(restoreWorkspace(localStorage.getItem(KEY))!.labs[0]).toEqual(original);
    fireEvent.click(screen.getByRole('tab', { name: /Mis equipos/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Equipo de destino' }), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Cargar Sol/ }));
    await waitFor(() => expect(readConstructor().teams[1].slots[2]?.data.name).toBe('Torkoal'));
    expect(readConstructor().gen).toBe(9);
    expect(restoreWorkspace(localStorage.getItem(KEY))!.labs[0]).toEqual(original);
    fireEvent.click(screen.getByRole('button', { name: 'Constructor de equipos' }));
    expect(screen.getByRole('tab', { name: /LAB 2/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Pikachu' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Torkoal' })).toBeDefined();
  }, 15000);
  it('restaura desde una copia todos los LABs, incluidos sus perfiles y el activo', async () => {
    let workspace = addLab(emptyWorkspace());
    workspace.labs[0].gen = 9;
    workspace.labs[0].teams[0].slots[0] = member('Pikachu');
    workspace.labs[1].gen = 10;
    workspace.labs[1].name = 'Libre';
    workspace.labs[1].teams[1].slots[3] = member('Garchomp');
    localStorage.setItem(KEY, serializeWorkspace(workspace));
    const backup = createStorageBackup();
    localStorage.clear();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Copia de seguridad' }));
    const file = new File([''], 'labs.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(backup) });
    fireEvent.change(screen.getByLabelText('Importar copia de seguridad JSON'), {
      target: { files: [file] },
    });
    await screen.findByRole('dialog', { name: 'Restaurar copia de seguridad' });
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar datos y restaurar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Constructor de equipos' }));
    expect(screen.getByRole('tab', { name: /Libre/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Garchomp' })).toBeDefined();
    expect((screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).value).toBe(
      '10',
    );
    expect(restoreWorkspace(localStorage.getItem(KEY))).toEqual(workspace);
    fireEvent.click(screen.getByRole('tab', { name: /LAB 1/ }));
    expect(screen.getByRole('button', { name: 'Pikachu' })).toBeDefined();
    expect((screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).value).toBe(
      '9',
    );
  }, 15000);
});
describe('Críticos propios del movimiento', () => {
  it.each([9, 10] as const)(
    'marca los ataques de crítico fijo y permite críticos manuales en los demás, perfil %s',
    (gen) => {
      const a = member('Garchomp'),
        b = member('Torkoal');
      a.moves = ['Frost Breath', 'Storm Throw', 'Flower Trick', 'Wicked Blow'];
      b.moves = ['Surging Strikes', 'Slash', 'Thunderbolt', 'Protect'];
      render(<Calculator members={[a, b]} gen={gen} onClose={() => {}} />);
      for (const move of a.moves) {
        const input = screen.getByRole('checkbox', {
          name: `Crítico ${move} de Garchomp`,
        }) as HTMLInputElement;
        expect(input.checked).toBe(true);
        expect(input.disabled).toBe(true);
      }
      expect(
        (
          screen.getByRole('checkbox', {
            name: 'Crítico Surging Strikes de Torkoal',
          }) as HTMLInputElement
        ).checked,
      ).toBe(true);
      const slash = screen.getByRole('checkbox', {
        name: 'Crítico Slash de Torkoal',
      }) as HTMLInputElement;
      expect(slash.checked).toBe(false);
      expect(slash.disabled).toBe(false);
      fireEvent.click(slash);
      expect(slash.checked).toBe(true);
      expect(
        (screen.getByRole('checkbox', { name: 'Crítico Protect de Torkoal' }) as HTMLInputElement)
          .disabled,
      ).toBe(true);
    },
  );
});
describe('MiniWiki desde el menú', () => {
  it('consulta una generación independiente sin cambiar el constructor ni su guardado', async () => {
    saved();
    render(<App />);
    const before = localStorage.getItem(KEY);
    fireEvent.click(screen.getByRole('button', { name: 'MiniWiki' }));
    await screen.findByRole('heading', { name: 'MiniWiki' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Generación de MiniWiki' }), {
      target: { value: '7' },
    });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en MiniWiki' }), {
      target: { value: 'heat' },
    });
    expect(screen.getByRole('button', { name: 'Roca Calor' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Constructor de equipos' }));
    expect((screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).value).toBe(
      '9',
    );
    expect(localStorage.getItem(KEY)).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'MiniWiki' }));
    await screen.findByRole('heading', { name: 'MiniWiki' });
    expect(
      (screen.getByRole('combobox', { name: 'Generación de MiniWiki' }) as HTMLSelectElement).value,
    ).toBe('7');
  });
});
describe('Copia completa desde el menú lateral', () => {
  function incoming() {
    localStorage.clear();
    const teams = emptyTeams();
    teams[0].name = 'Importado Champions';
    const m = member('Torkoal');
    m.hpPercent = 37;
    m.evs = { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 };
    teams[0].slots[4] = m;
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({ version: 1, gen: 0, teams }));
    localStorage.setItem(
      LIBRARY_KEY,
      JSON.stringify({
        version: 1,
        entries: addConfiguration([], member('Pikachu'), 9, 'Ratón guardado').entries,
      }),
    );
    localStorage.setItem(
      TEAM_LIBRARY_KEY,
      JSON.stringify({
        version: 1,
        entries: addTeamConfiguration([], teams[0], 0, 'Sol guardado').entries,
      }),
    );
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    localStorage.setItem(
      'ptl-api:backup-ui',
      JSON.stringify({ time: Date.now(), data: { name: 'cached' } }),
    );
    const backup = createStorageBackup();
    localStorage.clear();
    return backup;
  }
  async function selectBackup(backup: StorageBackup | string) {
    const file = new File([''], 'team-lab.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', {
      value: async () => (typeof backup === 'string' ? backup : JSON.stringify(backup)),
    });
    fireEvent.change(screen.getByLabelText('Importar copia de seguridad JSON'), {
      target: { files: [file] },
    });
  }
  it('exporta todos los datos de la app desde el menú sin incluir datos ajenos', async () => {
    saved();
    localStorage.setItem('unrelated-app', 'other');
    localStorage.setItem('ptl-api:backup-export', JSON.stringify({ time: 1, data: { ok: 1 } }));
    render(<App />);
    const original = createStorageBackup().entries;
    fireEvent.click(screen.getByRole('button', { name: 'Copia de seguridad' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar copia completa' }));
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json;charset=utf-8');
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    expect(parseStorageBackup(text).backup.entries).toEqual(original);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(
      (vi.mocked(HTMLAnchorElement.prototype.click).mock.contexts[0] as HTMLAnchorElement).download,
    ).toMatch(/^pokemon-team-lab-backup-.*\.json$/);
    expect(screen.getByRole('status').textContent).toContain('exportada correctamente');
    expect(localStorage.getItem('unrelated-app')).toBe('other');
  });
  it('revisa la copia, permite cancelar y restaura equipos, bibliotecas y tema sin recargar', async () => {
    const backup = incoming();
    saved();
    localStorage.setItem('unrelated-app', 'other');
    localStorage.setItem('pokemon-team-lab:old-setting', 'old');
    render(<App />);
    const original = createStorageBackup().entries;
    fireEvent.click(screen.getByRole('button', { name: 'Copia de seguridad' }));
    await selectBackup(backup);
    await screen.findByRole('dialog', { name: 'Restaurar copia de seguridad' });
    expect(createStorageBackup().entries).toEqual(original);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(createStorageBackup().entries).toEqual(original);
    await selectBackup(backup);
    await screen.findByRole('dialog', { name: 'Restaurar copia de seguridad' });
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar datos y restaurar' }));
    expect(screen.getByRole('status').textContent).toContain('restaurada correctamente');
    expect(createStorageBackup().entries).toEqual(backup.entries);
    expect(localStorage.getItem('unrelated-app')).toBe('other');
    expect(localStorage.getItem('pokemon-team-lab:old-setting')).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Constructor de equipos' }));
    expect(
      (screen.getByRole('textbox', { name: 'Nombre equipo 1' }) as HTMLInputElement).value,
    ).toBe('Importado Champions');
    expect((screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).value).toBe(
      '0',
    );
    expect(screen.getByRole('button', { name: 'Torkoal' })).toBeDefined();
    expect(readConstructor().teams[0].slots[4]!.hpPercent).toBe(37);
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    expect(screen.queryByText('Ratón guardado')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Mis equipos/ }));
    expect(screen.getByText('Sol guardado')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Constructor de equipos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Añadir LAB' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Generación' }), {
      target: { value: '9' },
    });
    await waitFor(() => expect(readConstructor().gen).toBe(9));
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    expect(screen.getByText('Ratón guardado')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: /Mis equipos/ }));
    expect(screen.queryByText('Sol guardado')).toBeNull();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  }, 10000);
  it('rechaza un archivo inválido sin abrir confirmación ni modificar los datos', async () => {
    saved();
    render(<App />);
    const before = createStorageBackup().entries;
    fireEvent.click(screen.getByRole('button', { name: 'Copia de seguridad' }));
    await selectBackup('{}');
    await screen.findByRole('alert');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(createStorageBackup().entries).toEqual(before);
  });
  it('conserva los datos y la interfaz si falla una escritura durante la restauración', async () => {
    const backup = incoming();
    saved();
    render(<App />);
    const previous = createStorageBackup().entries;
    fireEvent.click(screen.getByRole('button', { name: 'Copia de seguridad' }));
    await selectBackup(backup);
    await screen.findByRole('dialog');
    const actual = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === THEME_STORAGE_KEY && value === 'dark')
        throw new DOMException('Quota', 'QuotaExceededError');
      return actual.call(this, key, value);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar datos y restaurar' }));
    expect(screen.getByRole('alert').textContent).toContain(
      'Se han conservado los datos anteriores',
    );
    expect(createStorageBackup().entries).toEqual(previous);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Constructor de equipos' }));
    expect((screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).value).toBe(
      '9',
    );
    expect(screen.getByRole('button', { name: 'Garchomp' })).toBeDefined();
  });
  it('mantiene una copia de recuperación disponible al cambiar de sección si el navegador bloquea deshacer', async () => {
    const backup = incoming();
    saved();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Copia de seguridad' }));
    await selectBackup(backup);
    await screen.findByRole('dialog');
    let calls = 0;
    const actual = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (++calls >= 2) throw new DOMException('Blocked', 'SecurityError');
      return actual.call(this, key, value);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar datos y restaurar' }));
    expect(screen.getByRole('button', { name: 'Descargar copia de recuperación' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copia de seguridad' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar copia de recuperación' }));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });
});
describe('Biblioteca de equipos, limpieza y cobertura', () => {
  function teamEntry(name = 'Arena') {
    const team = emptyTeams()[0];
    team.slots[0] = member('Garchomp');
    team.slots[2] = member('Pikachu');
    return addTeamConfiguration([], team, 9, name).entry;
  }
  function storeTeams(entries: ReturnType<typeof teamEntry>[]) {
    localStorage.setItem(TEAM_LIBRARY_KEY, JSON.stringify({ version: 1, entries }));
  }
  function openTeams() {
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    fireEvent.click(screen.getByRole('tab', { name: /Mis equipos/ }));
  }
  it('importa un .txt como equipo en Mis equipos sin modificar el constructor ni descargar', async () => {
    render(<App />);
    openTeams();
    const file = new File([''], 'Sol.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'text', {
      value: async () =>
        'Torkoal\nAbility: Drought\nEVs: 32 HP / 32 SpA / 2 SpD\nQuiet Nature\n- Heat Wave\n- Protect',
    });
    fireEvent.change(screen.getByLabelText('Importar archivo de configuración'), {
      target: { files: [file] },
    });
    await waitFor(() => expect(localStorage.getItem(TEAM_LIBRARY_KEY)).not.toBeNull());
    const entries = JSON.parse(localStorage.getItem(TEAM_LIBRARY_KEY)!).entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Sol');
    expect(entries[0].gen).toBe(0);
    expect(entries[0].team.slots).toHaveLength(6);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
  it('conserva el guardado anterior si el almacenamiento falla al guardar un equipo', () => {
    saved();
    storeTeams([teamEntry()]);
    const original = localStorage.getItem(TEAM_LIBRARY_KEY);
    render(<App />);
    const actual = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === TEAM_LIBRARY_KEY) throw new DOMException('Quota', 'QuotaExceededError');
      return actual.call(this, key, value);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar equipo 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    expect(screen.getByRole('alert').textContent).toContain('No se pudo guardar');
    expect(localStorage.getItem(TEAM_LIBRARY_KEY)).toBe(original);
    expect(screen.getByRole('dialog')).toBeDefined();
  });
  it('guarda el sexto equipo liberando caché si el navegador está casi lleno', () => {
    saved();
    const previous = Array.from({ length: 5 }, (_, i) => teamEntry(`Equipo guardado ${i + 1}`));
    storeTeams(previous);
    localStorage.setItem(
      'ptl-api:pokemon/old',
      JSON.stringify({ time: 1, data: 'x'.repeat(12000) }),
    );
    render(<App />);
    const usage = () => {
      let size = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        size += (key.length + localStorage.getItem(key)!.length) * 2;
      }
      return size;
    };
    const limit = usage() + 100,
      actual = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      const old = this.getItem(key);
      const next =
        usage() -
        (old === null ? 0 : (key.length + old.length) * 2) +
        (key.length + value.length) * 2;
      if (next > limit) throw new DOMException('Quota', 'QuotaExceededError');
      return actual.call(this, key, value);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar equipo 1' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre del equipo guardado' }), {
      target: { value: 'Sexto equipo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    const entries = JSON.parse(localStorage.getItem(TEAM_LIBRARY_KEY)!).entries;
    expect(entries).toHaveLength(6);
    expect(entries[0].name).toBe('Sexto equipo');
    expect(entries.slice(1)).toEqual(previous);
    expect(localStorage.getItem('ptl-api:pokemon/old')).toBeNull();
    expect(readConstructor().teams[0].slots[0]!.data.name).toBe('Garchomp');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('no sobrescribe una biblioteca de equipos corrupta al abrir o cambiar de pestaña', () => {
    localStorage.setItem(TEAM_LIBRARY_KEY, 'corrupt');
    render(<App />);
    openTeams();
    expect(screen.getByRole('alert').textContent).toContain('No se pudo restaurar la biblioteca');
    expect(localStorage.getItem(TEAM_LIBRARY_KEY)).toBe('corrupt');
  });
  it('guarda una copia con nombre y seis plazas sin descargar archivos', () => {
    saved();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar equipo 1' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre del equipo guardado' }), {
      target: { value: 'Mi arena' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    const entry = JSON.parse(localStorage.getItem(TEAM_LIBRARY_KEY)!).entries[0];
    expect(entry.name).toBe('Mi arena');
    expect(entry.gen).toBe(9);
    expect(entry.team.slots).toHaveLength(6);
    expect(entry.team.slots[0]!.data.name).toBe('Garchomp');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre equipo 1' }), {
      target: { value: 'Nombre nuevo' },
    });
    expect(JSON.parse(localStorage.getItem(TEAM_LIBRARY_KEY)!).entries[0].name).toBe('Mi arena');
    openTeams();
    expect(
      screen.getByRole('table', { name: 'Equipos guardados por nombre' }).textContent,
    ).toContain('Mi arena');
    expect(screen.getByRole('tab', { name: /Mis equipos/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });
  it('exige dos confirmaciones y conserva el otro equipo, su selección y la biblioteca', () => {
    saved();
    storeTeams([teamEntry()]);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 2/ }));
    const original = localStorage.getItem(KEY),
      library = localStorage.getItem(TEAM_LIBRARY_KEY);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar equipo 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(localStorage.getItem(KEY)).toBe(original);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar equipo 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con la limpieza' }));
    expect(
      (screen.getByRole('button', { name: 'Confirmar y limpiar equipo' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(localStorage.getItem(KEY)).toBe(original);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar equipo 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con la limpieza' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Escribe LIMPIAR para confirmar' }), {
      target: { value: 'LIMPIAR' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y limpiar equipo' }));
    const stored = readConstructor();
    expect(stored.teams[0].slots).toEqual(Array(6).fill(null));
    expect(stored.teams[1].slots[0]!.data.name).toBe('Torkoal');
    expect(stored.teams[0].name).toBe(JSON.parse(original!).teams[0].name);
    expect(
      screen
        .getByRole('button', { name: /Seleccionar plaza 1 de equipo 2/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(localStorage.getItem(TEAM_LIBRARY_KEY)).toBe(library);
  });
  it('ordena Pokémon por especie y equipos por su nombre, incluso tras renombrar', () => {
    saved();
    const p = addConfiguration([], member('Pikachu'), 9, 'AAA');
    const g = addConfiguration(p.entries, member('Garchomp'), 9, 'ZZZ');
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, entries: [p.entry, g.entry] }));
    storeTeams([teamEntry('Zeta'), teamEntry('Ámbar')]);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    expect(screen.getAllByRole('row')[1].textContent).toContain('Garchomp');
    fireEvent.click(screen.getByRole('tab', { name: /Mis equipos/ }));
    expect(screen.getAllByRole('row')[1].textContent).toContain('Ámbar');
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar equipo Zeta' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre del equipo guardado' }), {
      target: { value: 'Alba' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    expect(screen.getAllByRole('row')[1].textContent).toContain('Alba');
    const entries = JSON.parse(localStorage.getItem(TEAM_LIBRARY_KEY)!).entries;
    expect(entries.find((e: { name: string }) => e.name === 'Alba').team.name).toBe('Alba');
  });
  it('exporta equipos con copia o descarga voluntaria y permite eliminarlos', async () => {
    saved();
    storeTeams([teamEntry()]);
    render(<App />);
    openTeams();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar equipo Arena' }));
    expect(
      (screen.getByRole('textbox', { name: 'Texto de Showdown' }) as HTMLTextAreaElement).value,
    ).toContain('Garchomp');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar equipo' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar .txt' }));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ventana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar equipo Arena' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(JSON.parse(localStorage.getItem(TEAM_LIBRARY_KEY)!).entries).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar equipo Arena' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar equipo guardado' }));
    expect(JSON.parse(localStorage.getItem(TEAM_LIBRARY_KEY)!).entries).toHaveLength(0);
    expect(readConstructor().teams[0].slots[0]!.data.name).toBe('Garchomp');
  });
  it('carga el equipo completo en el destino elegido después de confirmar el reemplazo', async () => {
    saved();
    storeTeams([teamEntry()]);
    render(<App />);
    openTeams();
    fireEvent.change(screen.getByRole('combobox', { name: 'Equipo de destino' }), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Cargar Arena en/ }));
    expect(readConstructor().teams[1].slots[0]!.data.name).toBe('Torkoal');
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar equipo' }));
    await waitFor(() => expect(readConstructor().teams[1].name).toBe('Arena'));
    const team = readConstructor().teams[1];
    expect(team.slots[0]!.data.name).toBe('Garchomp');
    expect(team.slots[1]).toBeNull();
    expect(team.slots[2]!.data.name).toBe('Pikachu');
    expect(readConstructor().teams[0].name).not.toBe('Arena');
  });
  it('valida todos los miembros antes de reemplazar y conserva los equipos ante un error', async () => {
    saved();
    storeTeams([teamEntry()]);
    render(<App />);
    openTeams();
    const original = localStorage.getItem(KEY);
    vi.mocked(loadPokemon).mockImplementation(async (name) => {
      if (name === 'Pikachu') throw new Error('Sin conexión');
      return fixture(name);
    });
    fireEvent.click(screen.getByRole('button', { name: /Cargar Arena en/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar equipo' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Sin conexión'));
    expect(localStorage.getItem(KEY)).toBe(original);
    expect(JSON.parse(localStorage.getItem(TEAM_LIBRARY_KEY)!).entries).toHaveLength(1);
  });
  it('muestra y carga un equipo cuando se selecciona su perfil de guardado', async () => {
    const team = emptyTeams()[0];
    team.slots[3] = member('Torkoal');
    team.slots[3]!.evs = { hp: 252, atk: 0, def: 0, spa: 252, spd: 4, spe: 0 };
    storeTeams(addTeamConfiguration([], team, 9, 'Sol').entries);
    render(<App />);
    openTeams();
    expect(screen.queryByRole('button', { name: /Cargar Sol en/ })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Mecánicas de la biblioteca' }), {
      target: { value: '9' },
    });
    await screen.findByRole('button', { name: /Cargar Sol en/ });
    fireEvent.click(screen.getByRole('button', { name: /Cargar Sol en/ }));
    await waitFor(() => expect(readConstructor().teams[0].slots[3]).not.toBeNull());
    const stored = readConstructor();
    expect(stored.gen).toBe(9);
    expect(stored.teams[0].slots[3]!.evs).toEqual({
      hp: 252,
      atk: 0,
      def: 0,
      spa: 252,
      spd: 4,
      spe: 0,
    });
    expect(JSON.parse(localStorage.getItem(TEAM_LIBRARY_KEY)!).entries[0].gen).toBe(9);
  });
  it('muestra multiplicadores y totales bajo cada equipo', () => {
    saved();
    render(<App />);
    const table = screen.getAllByRole('table')[0];
    const row = within(table)
      .getAllByRole('row')
      .find((r) => within(r).queryByRole('rowheader', { name: 'Hielo' }))!;
    expect(within(row).getAllByRole('cell')[0].textContent).toBe('4×');
    expect(
      within(row)
        .getAllByRole('cell')
        .slice(-2)
        .map((cell) => cell.textContent),
    ).toEqual(['1', '0']);
    expect(screen.getAllByRole('table')).toHaveLength(2);
  });
  it('agrupa efectos por equipo lado a lado, aplica Velo y Refuerzo, y desactiva Refuerzo en singles', () => {
    render(
      <Calculator members={[member('Garchomp'), member('Torkoal')]} gen={9} onClose={() => {}} />,
    );
    const left = screen.getByRole('group', { name: 'Equipo 1' }),
      right = screen.getByRole('group', { name: 'Equipo 2' });
    expect(left.parentElement?.className).toBe('team-effects-grid');
    expect(left.parentElement).toBe(right.parentElement);
    expect(within(left).getAllByRole('checkbox')).toHaveLength(5);
    const move = screen.getByRole('button', { name: /^Earthquake/ });
    const base = move.querySelector('.move-damage-value')!.textContent;
    fireEvent.click(within(right).getByRole('checkbox', { name: 'Velo Aurora' }));
    expect(move.querySelector('.move-damage-value')!.textContent).not.toBe(base);
    fireEvent.click(within(right).getByRole('checkbox', { name: 'Velo Aurora' }));
    fireEvent.click(within(left).getByRole('checkbox', { name: 'Refuerzo' }));
    expect(move.querySelector('.move-damage-value')!.textContent).not.toBe(base);
    fireEvent.click(screen.getByRole('button', { name: 'Singles' }));
    expect(
      (within(left).getByRole('checkbox', { name: 'Refuerzo' }) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (within(left).getByRole('checkbox', { name: 'Refuerzo' }) as HTMLInputElement).checked,
    ).toBe(false);
  });
});
describe('Champions, naturalezas, tema y configuraciones', () => {
  it('confirma el guardado desde la barra inferior, permite cerrarlo y renueva el aviso al repetir', () => {
    saved();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 1:/ }));
    vi.useFakeTimers();
    try {
      const save = screen.getByRole('button', { name: 'Guardar configuración' });
      fireEvent.click(save);
      expect(screen.getByRole('status').textContent).toContain(
        'se ha guardado correctamente en Mis Pokémon',
      );
      expect(screen.getByRole('status').textContent).toContain('Garchomp');
      expect(screen.getByRole('status').className).toContain('save-toast success');
      expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).entries).toHaveLength(1);
      expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      fireEvent.click(save);
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByRole('status')).toBeDefined();
      expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).entries).toHaveLength(1);
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.queryByRole('status')).toBeNull();
      fireEvent.click(save);
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso de guardado' }));
      expect(screen.queryByRole('status')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
  it('muestra un error visible en vez de confirmar el guardado cuando falla la biblioteca', () => {
    saved();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 1:/ }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota', 'QuotaExceededError');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(screen.getByRole('alert').textContent).toContain('No se ha podido guardar');
    expect(screen.getByRole('alert').className).toContain('save-toast failure');
    expect(screen.queryByText('Configuración guardada')).toBeNull();
    expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
  });
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
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Movimiento 1' }), { key: 'Enter' });
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
    expect(readConstructor().teams[0].slots[0]!.evs.def).toBe(2);
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
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 1:/ }));
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 2:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar plaza 6 de equipo 2' }));
    const button = screen.getByRole('button', { name: 'Borrar' });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/borrar los 2 Pokémon/)).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Borrar Pokémon' }));
    expect(screen.queryByRole('button', { name: 'Garchomp' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Torkoal' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pikachu' })).toBeDefined();
    const teams = readConstructor().teams;
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
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Tiburón ofensivo' }));
    const exportDialog = screen.getByRole('dialog', { name: 'Exportar a Showdown' });
    const text = (
      within(exportDialog).getByRole('textbox', {
        name: 'Texto de Showdown',
      }) as HTMLTextAreaElement
    ).value;
    expect(text).toContain('Garchomp');
    expect(text).toContain('Level: 50');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    fireEvent.click(within(exportDialog).getByRole('button', { name: 'Copiar configuración' }));
    await within(exportDialog).findByRole('button', { name: 'Copiado' });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text);
    fireEvent.click(within(exportDialog).getByRole('button', { name: 'Descargar .txt' }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    fireEvent.click(within(exportDialog).getByRole('button', { name: 'Cerrar ventana' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Equipo de destino' }), {
      target: { value: '1' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Añadir Tiburón ofensivo a Equipo Eclipse' }),
    );
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('añadida'));
    const teams = readConstructor().teams;
    expect(teams[1].slots[0]!.data.name).toBe('Torkoal');
    expect(teams[1].slots[1]!.data.name).toBe('Garchomp');
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
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 1/ }));
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
    saved();
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
describe('Tarjetas, exportación general y megaevolución', () => {
  it('selecciona y deselecciona al pulsar la tarjeta, pero el nombre solo edita', () => {
    saved();
    render(<App />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/Tu estrategia empieza/)).toBeNull();
    expect(screen.queryByText('Cada detalle cuenta.')).toBeNull();
    const selection = screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 1:/ });
    const card = selection.closest('article')!;
    fireEvent.click(within(card).getByRole('img', { name: 'Garchomp' }));
    expect(selection.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Garchomp' }));
    expect(screen.getByRole('dialog', { name: 'Editar Pokémon' })).toBeDefined();
    expect(selection.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ventana' }));
    fireEvent.click(within(card).getByText('Earthquake'));
    expect(selection.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Garchomp' }));
    expect(selection.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ventana' }));
    fireEvent.click(selection);
    expect(selection.getAttribute('aria-pressed')).toBe('true');
  });
  it('exporta una configuración Champions y mantiene el texto disponible si falla copiar', async () => {
    const m = member('Torkoal');
    m.evs.hp = 32;
    m.evs.spa = 32;
    m.evs.spd = 2;
    const library = addConfiguration([], m, 0, 'Sol');
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, entries: library.entries }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mis configuraciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Sol' }));
    const dialog = screen.getByRole('dialog', { name: 'Exportar a Showdown' });
    const text = within(dialog).getByRole('textbox', {
      name: 'Texto de Showdown',
    }) as HTMLTextAreaElement;
    expect(text.value).toContain('EVs: 32 HP / 32 SpA / 2 SpD');
    expect(text.readOnly).toBe(true);
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copiar configuración' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('manualmente');
    expect(text.value).toContain('Torkoal');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it.each([
    {
      gen: 0 as Gen,
      stone: 'Charizardite X',
      form: 'Charizard-Mega-X',
      ability: 'Tough Claws',
      stat: 150,
    },
    {
      gen: 9 as Gen,
      stone: 'Charizardite Y',
      form: 'Charizard-Mega-Y',
      ability: 'Drought',
      stat: 179,
    },
  ])(
    'activa $form en perfil $gen, actualiza sprite, estadísticas y daño y conserva el equipo',
    async ({ gen, stone, form, ability, stat }) => {
      const teams = emptyTeams();
      teams[0].slots[0] = charizard(stone);
      teams[1].slots[0] = member('Garchomp');
      localStorage.setItem(KEY, JSON.stringify({ version: 1, gen, teams }));
      const before = localStorage.getItem(KEY);
      render(<App />);
      expect(
        (screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).value,
      ).toBe(String(gen));
      fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 1:/ }));
      fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 2:/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Enfrentar Pokémon' }));
      const region = screen.getByRole('region', { name: 'Pokémon de equipo 1' });
      const beforeDamage = within(region).getByRole('button', {
        name: /^Flamethrower/,
      }).textContent;
      const toggle = within(region).getByRole('checkbox', {
        name: 'Megaevolucionar Charizard (equipo 1)',
      });
      fireEvent.click(toggle);
      const image = await within(region).findByRole('img', { name: form });
      expect(image.getAttribute('src')).toBe(`https://example.com/${form}.png`);
      expect(within(region).getByText(ability)).toBeDefined();
      const statInput = within(region).getByRole('combobox', { name: `At. Esp. ${form}` });
      expect(statInput.closest('label')?.querySelector('strong')?.textContent).toBe(String(stat));
      expect(within(region).getByRole('button', { name: /^Flamethrower/ }).textContent).not.toBe(
        beforeDamage,
      );
      fireEvent.click(toggle);
      expect(within(region).getByRole('img', { name: 'Charizard' })).toBeDefined();
      expect(within(region).getByRole('button', { name: /^Flamethrower/ }).textContent).toBe(
        beforeDamage,
      );
      expect(localStorage.getItem(KEY)).toBe(before);
    },
  );
  it('no ofrece megaevolución con una piedra incompatible o en generaciones anteriores', () => {
    const m = charizard('Garchompite');
    const view = render(<Calculator members={[m, member('Pikachu')]} gen={9} onClose={() => {}} />);
    expect(screen.queryByRole('checkbox', { name: /Megaevolucionar/ })).toBeNull();
    view.unmount();
    render(
      <Calculator
        members={[charizard('Charizardite X'), member('Pikachu')]}
        gen={5}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole('checkbox', { name: /Megaevolucionar/ })).toBeNull();
  });
  it('mantiene las estadísticas mega ante un error de imagen y permite reintentar', async () => {
    vi.mocked(loadPokemon).mockRejectedValueOnce(new Error('network'));
    render(
      <Calculator
        members={[charizard('Charizardite X'), member('Pikachu')]}
        gen={9}
        onClose={() => {}}
      />,
    );
    const toggle = screen.getByRole('checkbox', { name: 'Megaevolucionar Charizard (equipo 1)' });
    fireEvent.click(toggle);
    await screen.findByText(/No se pudo cargar la imagen mega/);
    expect(screen.getByRole('combobox', { name: 'Ataque Charizard-Mega-X' })).toBeDefined();
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await screen.findByRole('img', { name: 'Charizard-Mega-X' });
    expect(screen.queryByText(/No se pudo cargar la imagen mega/)).toBeNull();
  });
});
describe('Champions inicial, selector de movimientos y repartos del cálculo', () => {
  it('usa Champions al iniciar y conserva la elección guardada al recargar', async () => {
    const view = render(<App />);
    const profile = screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement;
    expect(profile.value).toBe('0');
    fireEvent.change(profile, { target: { value: '9' } });
    await waitFor(() => expect(profile.disabled).toBe(false));
    view.unmount();
    render(<App />);
    expect((screen.getByRole('combobox', { name: 'Generación' }) as HTMLSelectElement).value).toBe(
      '9',
    );
  });
  it('muestra filas con tipo, icono, potencia, acierto, PP y descripción y busca en español', () => {
    saved();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Garchomp' }));
    const input = screen.getByRole('combobox', { name: 'Movimiento 1' });
    fireEvent.focus(input);
    const option = within(
      screen.getByRole('listbox', { name: 'Opciones de Movimiento 1' }),
    ).getByRole('option', { name: 'Earthquake' });
    expect(within(option).getByText('Terremoto')).toBeDefined();
    expect(within(option).getByText('Tierra').classList.contains('type-ground')).toBe(true);
    expect(within(option).getByRole('img', { name: 'Categoría Físico' })).toBeDefined();
    expect(within(option).getByText('100')).toBeDefined();
    expect(within(option).getByText('100%')).toBeDefined();
    expect(within(option).getByText('16')).toBeDefined();
    expect(option.querySelector('.move-option-description')?.textContent?.length).toBeGreaterThan(
      10,
    );
    fireEvent.change(input, { target: { value: 'roca' } });
    const list = screen.getByRole('listbox', { name: 'Opciones de Movimiento 1' });
    expect(within(list).getAllByRole('option')).toHaveLength(1);
    expect(within(list).getByRole('option', { name: 'Rock Slide' })).toBeDefined();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect((input as HTMLInputElement).value).toBe('Rock Slide');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    fireEvent.change(input, { target: { value: 'Heat Wave' } });
    expect(
      within(screen.getByRole('listbox', { name: 'Opciones de Movimiento 1' })).queryByRole(
        'option',
        { name: 'Heat Wave' },
      ),
    ).toBeNull();
    expect(screen.getByText('No hay movimientos aprendibles que coincidan.')).toBeDefined();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect((input as HTMLInputElement).value).toBe('Rock Slide');
    expect(screen.getByRole('dialog', { name: 'Editar Pokémon' })).toBeDefined();
  }, 10000);
  it('muestra los datos del movimiento elegido y permite limpiar o elegir con teclado', () => {
    saved();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Torkoal' }));
    const input = screen.getByRole('combobox', { name: 'Movimiento 2' });
    const field = input.closest('.move-picker')!;
    expect(
      within(field as HTMLElement).getByRole('img', { name: 'Categoría Especial' }),
    ).toBeDefined();
    expect(within(field as HTMLElement).getByText('Fuego')).toBeDefined();
    expect(within(field as HTMLElement).getByText('95')).toBeDefined();
    expect(within(field as HTMLElement).getByText('90%')).toBeDefined();
    expect(within(field as HTMLElement).getByText('16')).toBeDefined();
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole('option', { name: 'Sin movimiento' }));
    expect((input as HTMLInputElement).value).toBe('');
    expect(field.querySelector('.selected-move-details')).toBeNull();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect((input as HTMLInputElement).value).toBe('Protect');
  });
  it('muestra el tipo de cada movimiento en las tarjetas del constructor', () => {
    saved();
    render(<App />);
    const card = screen
      .getByRole('button', { name: /Seleccionar plaza 1 de equipo 1:/ })
      .closest('article')!;
    const move = within(card).getByText('Earthquake').parentElement!;
    expect(within(move).getByText('Tierra').classList.contains('type-ground')).toBe(true);
  });
  it.each([
    { gen: 0 as Gen, max: 32, total: 66, label: 'SP' },
    { gen: 9 as Gen, max: 252, total: 510, label: 'EVs' },
  ])(
    'edita $label respetando sus límites, conserva PS y restablece sin modificar el equipo',
    ({ gen, max, total, label }) => {
      saved();
      const savedTeams = readConstructor();
      savedTeams.gen = gen;
      savedTeams.teams[0].slots[0]!.hpPercent = 40;
      localStorage.setItem(KEY, JSON.stringify(savedTeams));
      const before = localStorage.getItem(KEY);
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 1:/ }));
      fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 2:/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Enfrentar Pokémon' }));
      const region = screen.getByRole('region', { name: 'Pokémon de equipo 1' });
      const oldDamage = within(region).getByRole('button', { name: /^Earthquake/ }).textContent;
      const attack = within(region).getByRole('spinbutton', {
        name: `${label} Ataque de equipo 1`,
      });
      fireEvent.change(attack, { target: { value: String(max) } });
      expect(within(region).getByRole('button', { name: /^Earthquake/ }).textContent).not.toBe(
        oldDamage,
      );
      fireEvent.change(attack, { target: { value: String(max + 1) } });
      expect(within(region).getByRole('alert').textContent).toContain('entero');
      expect((attack as HTMLInputElement).value).toBe(String(max));
      fireEvent.change(
        within(region).getByRole('spinbutton', { name: `${label} PS de equipo 1` }),
        { target: { value: String(max) } },
      );
      fireEvent.change(
        within(region).getByRole('spinbutton', { name: `${label} Velocidad de equipo 1` }),
        { target: { value: String(total - 2 * max) } },
      );
      fireEvent.change(
        within(region).getByRole('spinbutton', { name: `${label} Defensa de equipo 1` }),
        { target: { value: '1' } },
      );
      expect(within(region).getByRole('alert').textContent).toContain(String(total));
      const hp = within(region)
        .getByText('PS actuales')
        .parentElement!.querySelector('dd')!.textContent!;
      expect(hp).toContain('40.0 %');
      expect(hp).toContain('86 / 215');
      fireEvent.click(within(region).getByRole('button', { name: 'Restablecer reparto' }));
      expect((attack as HTMLInputElement).value).toBe('0');
      expect(within(region).queryByRole('alert')).toBeNull();
      expect(within(region).getByRole('button', { name: /^Earthquake/ }).textContent).toBe(
        oldDamage,
      );
      expect(localStorage.getItem(KEY)).toBe(before);
    },
  );
  it('conserva los SP editados al activar/desactivar la megaevolución', async () => {
    render(
      <Calculator
        members={[charizard('Charizardite X'), member('Pikachu')]}
        gen={0}
        onClose={() => {}}
      />,
    );
    const region = screen.getByRole('region', { name: 'Pokémon de equipo 1' });
    fireEvent.change(within(region).getByRole('spinbutton', { name: 'SP Ataque de equipo 1' }), {
      target: { value: '32' },
    });
    fireEvent.click(within(region).getByRole('checkbox', { name: /Megaevolucionar/ }));
    await within(region).findByRole('img', { name: 'Charizard-Mega-X' });
    const attack = within(region).getByRole('combobox', { name: 'Ataque Charizard-Mega-X' });
    expect(attack.closest('label')?.querySelector('strong')?.textContent).toBe('182');
    fireEvent.click(within(region).getByRole('checkbox', { name: /Megaevolucionar/ }));
    expect(
      within(region)
        .getByRole('combobox', { name: 'Ataque Charizard' })
        .closest('label')
        ?.querySelector('strong')?.textContent,
    ).toBe('136');
    expect(
      (
        within(region).getByRole('spinbutton', {
          name: 'SP Ataque de equipo 1',
        }) as HTMLInputElement
      ).value,
    ).toBe('32');
  });
  it('muestra tipo coloreado, iconos, potencia, acierto y prioridad positiva/negativa en la calculadora', () => {
    const m = member('Torkoal');
    m.moves = ['Roar', 'Protect', 'Heat Wave', 'Eruption'];
    render(<Calculator members={[m, member('Pikachu')]} gen={9} onClose={() => {}} />);
    const region = screen.getByRole('region', { name: 'Pokémon de equipo 1' });
    const roar = within(region).getByRole('button', { name: /^Roar/ });
    expect(within(roar).getByText('Normal').classList.contains('type-normal')).toBe(true);
    expect(within(roar).getByText('Prioridad -6').classList.contains('negative')).toBe(true);
    expect(within(roar).getByRole('img', { name: 'Categoría Estado' })).toBeDefined();
    const protect = within(region).getByRole('button', { name: /^Protect/ });
    expect(within(protect).getByText('Prioridad +4').classList.contains('positive')).toBe(true);
    const heat = within(region).getByRole('button', { name: /^Heat Wave/ });
    expect(within(heat).getByText('Fuego').classList.contains('type-fire')).toBe(true);
    expect(within(heat).getByText('95')).toBeDefined();
    expect(within(heat).getByText('90%')).toBeDefined();
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
    expect(screen.getAllByRole('button', { name: /Seleccionar plaza/ })).toHaveLength(12);
    expect(
      (screen.getByRole('button', { name: 'Añadir / editar' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Enfrentar Pokémon' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar plaza 1 de equipo 1' }));
    expect(
      (screen.getByRole('button', { name: 'Añadir / editar' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
  it('añade una especie, valida movimientos y conserva PS al cambiar IVs', async () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Generación' }), {
      target: { value: '9' },
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
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Pokémon' }));
    expect(screen.getByRole('alert').textContent).toContain('al menos un movimiento');
    fireEvent.change(screen.getByRole('combobox', { name: 'Movimiento 1' }), {
      target: { value: 'Heat Wave' },
    });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Movimiento 1' }), { key: 'Enter' });
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
    const saved = readConstructor();
    expect(saved.teams[0].slots[0]!.hpPercent).toBe(50);
    expect(saved.teams[0].slots[0]!.ivs.hp).toBe(0);
    expect(saved.teams[0].slots[0]!.level).toBe(50);
  }, 10000);
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
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 1:/ }));
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 2 de equipo 1:/ }));
    expect(
      (screen.getByRole('button', { name: 'Enfrentar Pokémon' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 2 de equipo 1:/ }));
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 2:/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar plaza 1 de equipo 1:/ }));
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
    expect(readConstructor().gen).toBe(9);
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
