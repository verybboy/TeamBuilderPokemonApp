import type { TypeName } from '@smogon/calc/dist/data/interface';
import { generations, id } from './model';

export const calculatorTypes = [
  'normal',
  'fighting',
  'flying',
  'poison',
  'ground',
  'rock',
  'bug',
  'ghost',
  'steel',
  'fire',
  'water',
  'grass',
  'electric',
  'psychic',
  'ice',
  'dragon',
  'dark',
  'fairy',
] as const;
export type CalculatorType = (typeof calculatorTypes)[number];
export type SpecialAttack = 'freezeDry' | 'thousandArrows' | 'flyingPress';
export interface AttackOptions {
  specialMoves: SpecialAttack[];
  scrappy: boolean;
  tintedLens: boolean;
}
export const specialAttacks: { key: SpecialAttack; name: string; description: string }[] = [
  {
    key: 'freezeDry',
    name: 'Liofilización',
    description: 'Movimiento de Hielo que es supereficaz contra Agua.',
  },
  {
    key: 'thousandArrows',
    name: 'Mil Flechas',
    description:
      'Movimiento de Tierra que también alcanza a los tipos Volador (1× en el primer golpe).',
  },
  {
    key: 'flyingPress',
    name: 'Plancha Voladora',
    description: 'Multiplica las efectividades de Lucha y Volador.',
  },
];
export const defenseAbilities = [
  { key: '', name: 'Ninguna', description: '' },
  { key: 'Levitate', name: 'Levitación', description: 'Inmunidad a Tierra.' },
  { key: 'Earth Eater', name: 'Geofagia', description: 'Inmunidad a Tierra.' },
  { key: 'Flash Fire', name: 'Absorbe Fuego', description: 'Inmunidad a Fuego.' },
  { key: 'Well-Baked Body', name: 'Cuerpo Horneado', description: 'Inmunidad a Fuego.' },
  { key: 'Water Absorb', name: 'Absorbe Agua', description: 'Inmunidad a Agua.' },
  { key: 'Storm Drain', name: 'Colector', description: 'Inmunidad a Agua.' },
  { key: 'Dry Skin', name: 'Piel Seca', description: 'Inmunidad a Agua; recibe 1,25× de Fuego.' },
  { key: 'Volt Absorb', name: 'Absorbe Electricidad', description: 'Inmunidad a Eléctrico.' },
  { key: 'Lightning Rod', name: 'Pararrayos', description: 'Inmunidad a Eléctrico.' },
  { key: 'Motor Drive', name: 'Electromotor', description: 'Inmunidad a Eléctrico.' },
  { key: 'Sap Sipper', name: 'Herbívoro', description: 'Inmunidad a Planta.' },
  { key: 'Thick Fat', name: 'Sebo', description: 'Reduce a la mitad el daño de Fuego y Hielo.' },
  { key: 'Heatproof', name: 'Ignífugo', description: 'Reduce a la mitad el daño de Fuego.' },
  { key: 'Water Bubble', name: 'Pompa', description: 'Reduce a la mitad el daño de Fuego.' },
  {
    key: 'Purifying Salt',
    name: 'Sal Purificadora',
    description: 'Reduce a la mitad el daño de Fantasma.',
  },
  { key: 'Filter', name: 'Filtro', description: 'Reduce un 25 % el daño supereficaz.' },
  { key: 'Solid Rock', name: 'Roca Sólida', description: 'Reduce un 25 % el daño supereficaz.' },
  {
    key: 'Prism Armor',
    name: 'Armadura Prisma',
    description: 'Reduce un 25 % el daño supereficaz.',
  },
  {
    key: 'Wonder Guard',
    name: 'Superguarda',
    description: 'Solo recibe daño directo de ataques supereficaces.',
  },
  {
    key: 'Delta Stream',
    name: 'Ráfaga Delta',
    description:
      'Con su clima activo, anula las debilidades del tipo Volador; conserva las del segundo tipo.',
  },
  {
    key: 'Tera Shell',
    name: 'Teraparazón',
    description: 'Con los PS al máximo, todos los ataques que no sean inmunes pasan a ½×.',
  },
] as const;
export type DefenseAbility = (typeof defenseAbilities)[number]['key'];
export interface TypeMatchup {
  type: CalculatorType;
  multiplier: number;
}
function chartMultiplier(attack: CalculatorType, defense: CalculatorType) {
  const defendingName = generations.get(9).types.get(id(defense) as never)!.name;
  return (
    generations.get(9).types.get(id(attack) as never)!.effectiveness[defendingName as TypeName] ?? 1
  );
}

/** Best selected attack against each single defending type; does not include STAB or power. */
export function offensiveTypes(
  selected: readonly CalculatorType[],
  options: AttackOptions,
): TypeMatchup[] {
  return calculatorTypes.map((type) => {
    const hit = (attack: CalculatorType) =>
      options.scrappy && type === 'ghost' && (attack === 'normal' || attack === 'fighting')
        ? 1
        : chartMultiplier(attack, type);
    const hits: number[] = selected.map(hit);
    for (const move of options.specialMoves) {
      hits.push(
        move === 'freezeDry'
          ? type === 'water'
            ? 2
            : hit('ice')
          : move === 'thousandArrows'
            ? type === 'flying'
              ? 1
              : hit('ground')
            : hit('fighting') * hit('flying'),
      );
    }
    return {
      type,
      multiplier: hits.length
        ? Math.max(
            ...hits.map((value) =>
              options.tintedLens && value > 0 && value < 1 ? value * 2 : value,
            ),
          )
        : 1,
    };
  });
}

/** Defensive types multiply; one optional ability modifies direct damage only. */
export function defensiveTypes(
  selected: readonly CalculatorType[],
  ability: DefenseAbility = '',
  fullHP = true,
): TypeMatchup[] {
  const types = [...new Set(selected)];
  if (types.length > 2) throw new Error('Selecciona como máximo dos tipos defensivos.');
  return calculatorTypes.map((type) => {
    let multiplier = types.reduce((value, defender) => {
      const effect = chartMultiplier(type, defender);
      return (
        value * (ability === 'Delta Stream' && defender === 'flying' && effect > 1 ? 1 : effect)
      );
    }, 1);
    const immune =
      (type === 'ground' && ['Levitate', 'Earth Eater'].includes(ability)) ||
      (type === 'fire' && ['Flash Fire', 'Well-Baked Body'].includes(ability)) ||
      (type === 'water' && ['Water Absorb', 'Storm Drain', 'Dry Skin'].includes(ability)) ||
      (type === 'electric' && ['Volt Absorb', 'Lightning Rod', 'Motor Drive'].includes(ability)) ||
      (type === 'grass' && ability === 'Sap Sipper');
    if (immune) multiplier = 0;
    if (
      (ability === 'Thick Fat' && ['fire', 'ice'].includes(type)) ||
      (['Heatproof', 'Water Bubble'].includes(ability) && type === 'fire') ||
      (ability === 'Purifying Salt' && type === 'ghost')
    )
      multiplier *= 0.5;
    if (ability === 'Dry Skin' && type === 'fire') multiplier *= 1.25;
    if (['Filter', 'Solid Rock', 'Prism Armor'].includes(ability) && multiplier > 1)
      multiplier *= 0.75;
    if (ability === 'Wonder Guard' && multiplier <= 1) multiplier = 0;
    if (ability === 'Tera Shell' && fullHP && multiplier > 0) multiplier = 0.5;
    return { type, multiplier };
  });
}
export function groupTypeMatchups(matchups: TypeMatchup[]) {
  const values = [...new Set(matchups.map((row) => row.multiplier))].sort((a, b) => b - a);
  return values.map((multiplier) => ({
    multiplier,
    types: matchups.filter((row) => row.multiplier === multiplier).map((row) => row.type),
  }));
}
export const typeMultiplierLabel = (value: number) =>
  value === 0.25 ? '¼×' : value === 0.5 ? '½×' : `${String(value).replace('.', ',')}×`;
