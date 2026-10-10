import {
  createMember,
  generations,
  id,
  spread,
  stats,
  validateMember,
  apiGeneration,
  trainingLimits,
  type Gen,
  type Member,
  type PokemonData,
  type Stat,
} from './model';
import { loadPokemon } from './api';
const labels: Record<Stat, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};
const statMap = new Map(stats.map((s) => [id(labels[s]), s]));
function parseSpread(text: string, max: number) {
  const result = spread(max === 31 ? 31 : 0),
    seen = new Set<string>();
  for (const part of text.split('/')) {
    const match = part.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);
    if (!match) throw new Error(`Distribución inválida: ${part.trim()}.`);
    const key = statMap.get(id(match[2]))!;
    const value = Number(match[1]);
    if (value > max || seen.has(key))
      throw new Error(`Valor inválido o duplicado para ${labels[key]}.`);
    seen.add(key);
    result[key] = value;
  }
  return result;
}
export async function importShowdown(
  text: string,
  gen: Gen,
  loader: (name: string, gen: Gen) => Promise<PokemonData> = loadPokemon,
): Promise<Member[]> {
  if (!text.trim()) throw new Error('Pega al menos un Pokémon en formato Showdown.');
  if (text.length > 30000) throw new Error('El texto es demasiado largo.');
  const blocks = text
    .trim()
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .filter(Boolean);
  if (blocks.length > 6) throw new Error('Un equipo admite como máximo seis Pokémon.');
  const imported: Member[] = [];
  for (let i = 0; i < blocks.length; i++) {
    try {
      const lines = blocks[i]
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines[0].startsWith('==='))
        throw new Error('Pega el equipo sin el encabezado de la caja de Showdown.');
      const header = lines[0].split(/\s+@\s+/);
      if (header.length > 2) throw new Error('Cabecera inválida.');
      let species = header[0],
        gender: 'M' | 'F' | undefined;
      const genderMatch = species.match(/\s+\(([MF])\)$/);
      if (genderMatch) {
        gender = genderMatch[1] as 'M' | 'F';
        species = species.slice(0, genderMatch.index).trim();
      }
      let nickname = '';
      const nicknameMatch = species.match(/^(.+)\s+\(([^()]+)\)$/);
      if (nicknameMatch) {
        nickname = nicknameMatch[1];
        species = nicknameMatch[2];
      }
      const data = await loader(species, gen);
      const member = createMember(data);
      member.nickname = nickname;
      member.item = header[1]?.trim() || '';
      if (gender) member.gender = gender;
      const seen = new Set<string>();
      let moveIndex = 0;
      for (const line of lines.slice(1)) {
        if (line.startsWith('- ')) {
          if (moveIndex === 4) throw new Error('Solo se permiten cuatro movimientos.');
          const move = line.slice(2).trim();
          const canonical = Array.from(generations.get(gen).moves).find(
            (m) => id(m.name) === id(move),
          );
          if (!canonical) throw new Error(`Movimiento desconocido: ${move}.`);
          member.moves[moveIndex++] = canonical.name;
          continue;
        }
        const nature = line.match(/^([A-Za-z]+) Nature$/);
        if (nature) {
          if (seen.has('Nature')) throw new Error('Naturaleza duplicada.');
          seen.add('Nature');
          member.nature = nature[1];
          continue;
        }
        const match = line.match(/^([A-Za-z ]+):\s*(.+)$/);
        if (!match) throw new Error(`Línea no reconocida: ${line}.`);
        const [, key, value] = match;
        if (seen.has(key)) throw new Error(`Campo duplicado: ${key}.`);
        seen.add(key);
        switch (key) {
          case 'Ability': {
            const a = Array.from(generations.get(gen).abilities).find(
              (a) => id(a.name) === id(value),
            );
            if (!a) throw new Error(`Habilidad desconocida: ${value}.`);
            member.ability = a.name;
            break;
          }
          case 'Level':
            if (!/^\d+$/.test(value)) throw new Error('Nivel inválido.');
            member.level = Number(value);
            break;
          case 'Shiny':
            if (!['Yes', 'No'].includes(value)) throw new Error('Shiny debe ser Yes o No.');
            member.shiny = value === 'Yes';
            break;
          case 'EVs':
            member.evs = parseSpread(value, trainingLimits(gen).perStat);
            break;
          case 'IVs':
            member.ivs = parseSpread(value, 31);
            break;
          case 'Gender':
            if (!['M', 'F', 'N'].includes(value)) throw new Error('Sexo inválido.');
            member.gender = value as 'M' | 'F' | 'N';
            break;
          default:
            throw new Error(`Campo no compatible: ${key}. Retíralo antes de importar.`);
        }
      }
      validateMember(member, gen);
      imported.push(member);
    } catch (e) {
      throw new Error(
        `Pokémon ${i + 1}: ${e instanceof Error ? e.message : 'Error de importación.'}`,
      );
    }
  }
  return imported;
}
export function exportShowdown(members: (Member | null)[], gen: Gen): string {
  return members
    .filter((m): m is Member => !!m)
    .map((m) => {
      const lines = [
        `${m.nickname ? `${m.nickname} (${m.data.name})` : m.data.name}${m.gender === 'N' ? '' : ` (${m.gender})`}${m.item ? ` @ ${m.item}` : ''}`,
      ];
      if (apiGeneration(gen) >= 3) lines.push(`Ability: ${m.ability}`);
      lines.push(`Level: ${m.level}`);
      if (m.shiny) lines.push('Shiny: Yes');
      const evs = stats.filter((s) => m.evs[s] !== 0).map((s) => `${m.evs[s]} ${labels[s]}`);
      if (evs.length) lines.push(`EVs: ${evs.join(' / ')}`);
      if (apiGeneration(gen) >= 3) lines.push(`${m.nature} Nature`);
      const ivs = stats.filter((s) => m.ivs[s] !== 31).map((s) => `${m.ivs[s]} ${labels[s]}`);
      if (ivs.length) lines.push(`IVs: ${ivs.join(' / ')}`);
      lines.push(...m.moves.filter(Boolean).map((move) => `- ${move}`));
      return lines.join('\n');
    })
    .join('\n\n');
}
