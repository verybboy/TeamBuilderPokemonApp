// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import TypeCalculator from './TypeCalculator';
afterEach(cleanup);
const choices = () => within(screen.getByRole('group', { name: 'Tipos disponibles' }));
const results = () => within(screen.getByRole('region', { name: 'Resultados de cobertura' }));
describe('Selección de cobertura', () => {
  it('permite todos los ataques, limita defensa a dos y conserva cada selección al cambiar modo', () => {
    render(<TypeCalculator />);
    const buttons = choices().getAllByRole('button');
    for (const button of buttons) fireEvent.click(button);
    expect(buttons.every((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cobertura defensiva' }));
    fireEvent.click(choices().getByRole('button', { name: 'Fuego' }));
    fireEvent.click(choices().getByRole('button', { name: 'Volador' }));
    expect((choices().getByRole('button', { name: 'Agua' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(results().getByRole('heading', { name: /Sufre 4× por/ })).toBeDefined();
    fireEvent.click(choices().getByRole('button', { name: 'Fuego' }));
    expect((choices().getByRole('button', { name: 'Agua' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    fireEvent.click(choices().getByRole('button', { name: 'Agua' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cobertura de ataque' }));
    expect(
      choices()
        .getAllByRole('button')
        .every((b) => b.getAttribute('aria-pressed') === 'true'),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar selección' }));
    expect(
      choices()
        .getAllByRole('button')
        .every((b) => b.getAttribute('aria-pressed') === 'false'),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cobertura defensiva' }));
    expect(choices().getByRole('button', { name: 'Agua' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(choices().getByRole('button', { name: 'Volador' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
  it('calcula al elegir efectos, permite limpiar y omite Pokédex y teratipo', () => {
    render(<TypeCalculator />);
    fireEvent.click(screen.getByRole('button', { name: 'Liofilización' }));
    const effective = results()
      .getByRole('heading', { name: /Inflige 2× a/ })
      .closest('section')!;
    expect(within(effective).getByText('Agua')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cromolente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar selección' }));
    expect(screen.getByRole('button', { name: 'Liofilización' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: 'Cromolente' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cobertura defensiva' }));
    fireEvent.click(choices().getByRole('button', { name: 'Eléctrico' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Elige habilidad' }), {
      target: { value: 'Levitate' },
    });
    expect(
      results()
        .getByRole('heading', { name: /Sufre 0× por/ })
        .closest('section')!.textContent,
    ).toContain('Tierra');
    expect(screen.queryByText(/Cobertura Pokédex|Elige teratipo/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar selección' }));
    expect(
      (screen.getByRole('combobox', { name: 'Elige habilidad' }) as HTMLSelectElement).value,
    ).toBe('');
    expect(results().getAllByRole('heading', { level: 3 })).toHaveLength(1);
  });
});
