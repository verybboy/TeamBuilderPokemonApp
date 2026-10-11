import type { TypeName } from '@smogon/calc/dist/data/interface';
import { toID } from '@smogon/calc';
import { calcPokemon, generations, megaForm, megaEvolve, type Gen, type Team } from './model';
import { typeLabels } from './moves';

/** Local coverage preview; the original team and its saved configurations stay intact. */
export function coverageTeam(team: Team, gen: Gen, megaSlots: readonly boolean[]): Team {
  return {
    ...team,
    slots: team.slots.map((member, i) =>
      member && megaSlots[i] && megaForm(member, gen) ? megaEvolve(member, gen) : member,
    ),
  };
}

/** Type-chart coverage only: abilities, items and field effects are deliberately excluded. */
export function defensiveCoverage(team: Team, gen: Gen) {
  const chart = generations.get(gen).types;
  const defenders = team.slots.map((member) => (member ? calcPokemon(member, gen).types : null));
  return Object.keys(typeLabels).flatMap((name) => {
    const attack = chart.get(toID(name));
    if (!attack) return [];
    const multipliers = defenders.map((types) =>
      types
        ? types.reduce((value, type) => value * (attack.effectiveness[type as TypeName] ?? 1), 1)
        : null,
    );
    return [
      {
        type: attack.name.toLowerCase(),
        multipliers,
        weak: multipliers.filter((value) => value !== null && value > 1).length,
        resist: multipliers.filter((value) => value !== null && value < 1).length,
      },
    ];
  });
}
export function multiplierLabel(value: number) {
  return value === 0 ? 'Inmune' : value === 0.25 ? '¼' : value === 0.5 ? '½' : `${value}×`;
}
