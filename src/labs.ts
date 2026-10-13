import { emptyTeams, restoreTeams, type Gen, type Team } from './model';

export const MAX_LABS = 5;
export interface Lab {
  id: string;
  name: string;
  gen: Gen;
  teams: Team[];
}
export interface Workspace {
  labs: Lab[];
  activeLabId: string;
}
export function emptyWorkspace(): Workspace {
  return {
    labs: [{ id: 'lab-1', name: 'LAB 1', gen: 0, teams: emptyTeams() }],
    activeLabId: 'lab-1',
  };
}
export function activeLab(workspace: Workspace): Lab {
  return workspace.labs.find((lab) => lab.id === workspace.activeLabId)!;
}
export function addLab(workspace: Workspace): Workspace {
  if (workspace.labs.length >= MAX_LABS) throw new Error('Puedes tener como máximo cinco LABs.');
  const lab: Lab = {
    id: crypto.randomUUID(),
    name: [
      `LAB ${workspace.labs.length + 1}`,
      ...Array.from({ length: MAX_LABS }, (_, index) => `LAB ${index + 1}`),
    ].find((name) => !workspace.labs.some((lab) => lab.name.trim() === name))!,
    gen: 0,
    teams: emptyTeams(),
  };
  return { labs: [...workspace.labs, lab], activeLabId: lab.id };
}
export function removeLab(workspace: Workspace, id: string): Workspace {
  const index = workspace.labs.findIndex((lab) => lab.id === id);
  if (index < 0) throw new Error('El LAB ya no está disponible.');
  const labs = workspace.labs.filter((lab) => lab.id !== id);
  if (!labs.length) return emptyWorkspace();
  return {
    labs,
    activeLabId:
      workspace.activeLabId === id
        ? labs[Math.min(index, labs.length - 1)].id
        : workspace.activeLabId,
  };
}
export function serializeWorkspace(workspace: Workspace) {
  return JSON.stringify({ version: 2, ...workspace });
}
/** Migrates the former two-team constructor without writing over the original storage. */
export function restoreWorkspace(raw: string | null): Workspace | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value.version === 1) {
      const legacy = restoreTeams(raw);
      return legacy
        ? { labs: [{ id: 'lab-1', name: 'LAB 1', ...legacy }], activeLabId: 'lab-1' }
        : null;
    }
    if (
      value.version !== 2 ||
      !Array.isArray(value.labs) ||
      value.labs.length < 1 ||
      value.labs.length > MAX_LABS ||
      typeof value.activeLabId !== 'string'
    )
      return null;
    const ids = new Set<string>();
    for (const lab of value.labs) {
      if (
        !lab ||
        typeof lab.id !== 'string' ||
        !lab.id ||
        ids.has(lab.id) ||
        typeof lab.name !== 'string' ||
        lab.name.length > 60 ||
        !restoreTeams(JSON.stringify({ version: 1, teams: lab.teams, gen: lab.gen }))
      )
        return null;
      ids.add(lab.id);
    }
    return ids.has(value.activeLabId) ? { labs: value.labs, activeLabId: value.activeLabId } : null;
  } catch {
    return null;
  }
}
