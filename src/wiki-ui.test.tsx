// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { useState } from 'react';
import MiniWiki from './MiniWiki';
import type { Gen } from './model';
function Wiki({ initial = 7 }: { initial?: Gen }) {
  const [gen, setGen] = useState<Gen>(initial);
  return <MiniWiki gen={gen} onChangeGen={setGen} />;
}
beforeEach(() => {
  localStorage.clear();
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
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('No API should be called to search');
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const search = (value: string) =>
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en MiniWiki' }), {
    target: { value },
  });
describe('Buscador conjunto MiniWiki', () => {
  it('reproduce la búsqueda heat con tipos, habilidades, habilidad oculta, stats y efectos', () => {
    render(<Wiki />);
    search('heat');
    const pokemon = screen.getByRole('button', { name: 'Heatran' }).closest('tr')!;
    expect(within(pokemon).getByText('Fuego')).toBeDefined();
    expect(within(pokemon).getByText('Acero')).toBeDefined();
    expect(within(pokemon).getByRole('button', { name: /Absorbe Fuego/ })).toBeDefined();
    expect(within(pokemon).getByRole('button', { name: /Cuerpo Llama/ })).toBeDefined();
    expect(within(pokemon).getByText('130')).toBeDefined();
    const move = screen.getByRole('button', { name: 'Onda Ígnea' }).closest('tr')!;
    expect(within(move).getByRole('img', { name: 'Categoría Especial' })).toBeDefined();
    expect(within(move).getByText('95')).toBeDefined();
    expect(within(move).getByText('90%')).toBeDefined();
    expect(within(move).getByText('10')).toBeDefined();
    expect(within(move).getByText('10% de quemar al objetivo.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Ignífugo' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Roca Calor' })).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('filtra categorías y busca nombres en español con acentos omitidos', () => {
    render(<Wiki />);
    search('ignifugo');
    fireEvent.click(screen.getByRole('button', { name: 'Habilidades' }));
    expect(screen.getByRole('status').textContent).toContain('1 resultado');
    fireEvent.click(screen.getByRole('button', { name: 'Ignífugo' }));
    expect(screen.getByRole('dialog').textContent).toContain('Fire');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ventana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Objetos' }));
    search('roca calor');
    fireEvent.click(screen.getByRole('button', { name: 'Roca Calor' }));
    expect(screen.getByRole('dialog').textContent).toContain('8 turns');
  });
  it('cambia generación, habilidades ocultas y datos históricos con la búsqueda conservada', () => {
    render(<Wiki />);
    search('Heatran');
    fireEvent.click(screen.getByRole('button', { name: 'Pokémon' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Generación de MiniWiki' }), {
      target: { value: '4' },
    });
    expect(screen.queryByRole('button', { name: /Cuerpo Llama/ })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Generación de MiniWiki' }), {
      target: { value: '3' },
    });
    expect(screen.getByText('No hay coincidencias en este perfil')).toBeDefined();
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('Heatran');
  });
  it('muestra cinco stats y ninguna habilidad en la generación I', () => {
    render(<Wiki initial={1} />);
    search('Bulbasaur');
    fireEvent.click(screen.getByRole('button', { name: 'Pokémon' }));
    expect(screen.getByText('Sin habilidades')).toBeDefined();
    expect(screen.getByText('Esp.')).toBeDefined();
    expect(screen.queryByText('SpD')).toBeNull();
  });
  it('aplica el perfil Champions a las descripciones y al PP que se muestra', () => {
    render(<Wiki initial={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Habilidades' }));
    search('Alma Cura');
    expect(screen.getByText(/50% chance/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Movimientos' }));
    search('Protection');
    search('Protect');
    const row = screen.getByRole('button', { name: 'Protección' }).closest('tr')!;
    expect(within(row).getByText('8')).toBeDefined();
  });
  it('permite consultar una habilidad desde la fila de un Pokémon y usar la ficha detallada', () => {
    render(<Wiki />);
    search('Heatran');
    fireEvent.click(screen.getByRole('button', { name: 'Pokémon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Heatran' }));
    expect(screen.getByRole('dialog').textContent).toContain('Estadísticas base');
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /Cuerpo Llama/ }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Habilidades' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('Flame Body');
    expect(screen.getByRole('button', { name: 'Cuerpo Llama' })).toBeDefined();
  });
  it('pagina todos los resultados y puede limpiar la búsqueda', () => {
    render(<Wiki />);
    expect(screen.getAllByRole('row')).toHaveLength(40);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar más resultados' }));
    expect(screen.getAllByRole('row')).toHaveLength(80);
    search('not-a-pokemon-at-all');
    expect(screen.getByText('No hay coincidencias en este perfil')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda de MiniWiki' }));
    expect(screen.getAllByRole('row')).toHaveLength(40);
    expect(localStorage.length).toBe(0);
  });
});
