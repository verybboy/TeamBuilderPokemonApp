// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Pokemon } from '@smogon/calc';
import Library from './ConfigurationLibrary';
import { createMember, emptyTeams, type Gen } from './model';
import { addConfiguration, addTeamConfiguration, LIBRARY_KEY, TEAM_LIBRARY_KEY } from './library';
import type { Lab } from './labs';

const profiles = [0, 1, 7, 9, 10] as const;
function fixture() {
  const p = new Pokemon(9, 'Pikachu');
  const member = createMember({
    name: 'Pikachu',
    apiName: 'pikachu',
    number: 25,
    types: ['electric'],
    baseStats: p.species.baseStats,
    abilities: ['Static'],
    moves: ['Thunderbolt'],
    genders: ['M', 'F'],
    sprite: '',
    shinySprite: '',
  });
  member.moves = ['Thunderbolt', '', '', ''];
  return member;
}
const pokemon = profiles.flatMap((gen) =>
  ['Zeta', 'Alba'].map(
    (name) => addConfiguration([], fixture(), gen, `${name} Pokémon ${gen}`).entry,
  ),
);
const teams = profiles.flatMap((gen) =>
  ['Zeta', 'Alba'].map((name) => {
    const team = emptyTeams()[0];
    team.slots[0] = fixture();
    return addTeamConfiguration([], team, gen, `${name} equipo ${gen}`).entry;
  }),
);
const onAdd = vi.fn(async () => {}),
  onLoadTeam = vi.fn(async () => {});
function Harness() {
  const [labs, setLabs] = useState<Lab[]>([
    { id: 'nine', name: 'Clásico', gen: 9, teams: emptyTeams() },
    { id: 'champions', name: 'Champions', gen: 0, teams: emptyTeams() },
  ]);
  const [labId, setLabId] = useState('nine');
  const current = labs.find((lab) => lab.id === labId)!;
  return (
    <Library
      labs={labs}
      labId={labId}
      onChangeLab={setLabId}
      entries={pokemon}
      savedTeams={teams}
      teamsInvalid={false}
      invalid={false}
      teams={current.teams}
      gen={current.gen}
      busy={false}
      onAdd={onAdd}
      onLoadTeam={onLoadTeam}
      onImport={async () => {}}
      onImportTeam={async () => {}}
      onRename={() => {}}
      onDelete={() => {}}
      onRenameTeam={() => {}}
      onDeleteTeam={() => {}}
      onChangeMechanics={async (gen: Gen) =>
        setLabs((values) => values.map((lab) => (lab.id === labId ? { ...lab, gen } : lab)))
      }
    />
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, entries: pokemon }));
  localStorage.setItem(TEAM_LIBRARY_KEY, JSON.stringify({ version: 1, entries: teams }));
});
afterEach(cleanup);
const selectProfile = (gen: Gen) =>
  fireEvent.change(screen.getByRole('combobox', { name: 'Mecánicas de la biblioteca' }), {
    target: { value: String(gen) },
  });
describe('Bibliotecas filtradas por perfil', () => {
  it('muestra solo Pokémon y equipos del perfil y actualiza los contadores conservando el orden alfabético', () => {
    render(<Harness />);
    const originalPokemon = localStorage.getItem(LIBRARY_KEY),
      originalTeams = localStorage.getItem(TEAM_LIBRARY_KEY);
    for (const gen of profiles) {
      selectProfile(gen);
      fireEvent.click(screen.getByRole('tab', { name: /Mis Pokémon/ }));
      expect(screen.getByRole('tab', { name: /Mis Pokémon/ }).textContent).toContain('2');
      expect(screen.getByRole('tab', { name: /Mis equipos/ }).textContent).toContain('2');
      expect(screen.getAllByRole('row')).toHaveLength(3);
      expect(screen.getAllByRole('row')[1].textContent).toContain(`Alba Pokémon ${gen}`);
      for (const other of profiles) {
        expect(!!screen.queryByText(`Alba Pokémon ${other}`)).toBe(other === gen);
      }
      fireEvent.click(screen.getByRole('tab', { name: /Mis equipos/ }));
      expect(screen.getAllByRole('row')).toHaveLength(3);
      expect(screen.getAllByRole('row')[1].textContent).toContain(`Alba equipo ${gen}`);
      for (const other of profiles) {
        expect(!!screen.queryByText(`Alba equipo ${other}`)).toBe(other === gen);
      }
    }
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(originalPokemon);
    expect(localStorage.getItem(TEAM_LIBRARY_KEY)).toBe(originalTeams);
  });
  it('combina perfil y búsqueda, conserva la consulta al cambiar perfil y muestra los estados vacíos', () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar configuraciones' }), {
      target: { value: 'Alba' },
    });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    selectProfile(10);
    expect(screen.getByText('Alba Pokémon 10')).toBeDefined();
    expect(screen.queryByText('Alba Pokémon 9')).toBeNull();
    expect(screen.getByRole('tab', { name: /Mis Pokémon/ }).textContent).toContain('2');
    fireEvent.click(screen.getByRole('tab', { name: /Mis equipos/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar configuraciones' }), {
      target: { value: 'Alba' },
    });
    selectProfile(0);
    expect(screen.getByText('Alba equipo 0')).toBeDefined();
    expect(screen.queryByText('Alba equipo 10')).toBeNull();
    selectProfile(8);
    expect(screen.getByText('No hay coincidencias')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar configuraciones' }), {
      target: { value: '' },
    });
    expect(screen.getByText('No tienes equipos guardados en este perfil')).toBeDefined();
    expect(screen.getByRole('tab', { name: /Mis equipos/ }).textContent).toContain('0');
    fireEvent.click(screen.getByRole('tab', { name: /Mis Pokémon/ }));
    expect(screen.getByText('No tienes Pokémon guardados en este perfil')).toBeDefined();
    expect(screen.getByRole('tab', { name: /Mis Pokémon/ }).textContent).toContain('0');
    selectProfile(9);
    expect(screen.getByText('Alba Pokémon 9')).toBeDefined();
  });
  it('al cambiar de LAB filtra por su mecánica y permite añadir o cargar solo las filas visibles', () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole('combobox', { name: 'LAB de implementación' }), {
      target: { value: 'champions' },
    });
    expect(screen.queryByText('Alba Pokémon 9')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir Alba Pokémon 0 a Equipo Aurora' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ gen: 0 }), 0);
    fireEvent.click(screen.getByRole('tab', { name: /Mis equipos/ }));
    expect(screen.queryByText('Alba equipo 9')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar Alba equipo 0 en Equipo Aurora' }));
    expect(onLoadTeam).toHaveBeenCalledWith(expect.objectContaining({ gen: 0 }), 0);
    fireEvent.change(screen.getByRole('combobox', { name: 'LAB de implementación' }), {
      target: { value: 'nine' },
    });
    expect(screen.getByText('Alba equipo 9')).toBeDefined();
    expect(screen.queryByText('Alba equipo 0')).toBeNull();
  });
});
