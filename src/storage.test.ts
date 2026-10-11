// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  API_CACHE_PREFIX,
  API_CACHE_BUDGET,
  cacheApiResponse,
  writeSavedData,
  storageFailureMessage,
} from './storage';
import { request } from './api';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function bytes() {
  let sum = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    sum += (key.length + localStorage.getItem(key)!.length) * 2;
  }
  return sum;
}
function quota(limit: number) {
  const actual = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key,
    value,
  ) {
    const previous = this.getItem(key);
    const size =
      bytes() -
      (previous === null ? 0 : (key.length + previous.length) * 2) +
      (key.length + value.length) * 2;
    if (size > limit) throw new DOMException('Quota', 'QuotaExceededError');
    actual.call(this, key, value);
  });
}
describe('Prioridad de guardados frente a caché', () => {
  it('libera primero la respuesta más antigua y reintenta sin tocar otros datos', () => {
    localStorage.setItem('pokemon-team-lab:teams:v1', 'original');
    localStorage.setItem('pokemon-team-lab:configurations:v1', 'builds');
    localStorage.setItem('other-app', 'other');
    localStorage.setItem(
      API_CACHE_PREFIX + 'older',
      JSON.stringify({ time: 1, data: 'a'.repeat(5000) }),
    );
    localStorage.setItem(
      API_CACHE_PREFIX + 'newer',
      JSON.stringify({ time: 2, data: 'b'.repeat(5000) }),
    );
    quota(bytes() + 100);
    writeSavedData('pokemon-team-lab:teams:v1', 'teams'.repeat(200));
    expect(localStorage.getItem('pokemon-team-lab:teams:v1')).toBe('teams'.repeat(200));
    expect(localStorage.getItem(API_CACHE_PREFIX + 'older')).toBeNull();
    expect(localStorage.getItem(API_CACHE_PREFIX + 'newer')).not.toBeNull();
    expect(localStorage.getItem('pokemon-team-lab:configurations:v1')).toBe('builds');
    expect(localStorage.getItem('other-app')).toBe('other');
  });
  it('preserva el valor anterior si ni eliminando la caché cabe el nuevo guardado', () => {
    localStorage.setItem('team', 'original');
    localStorage.setItem(API_CACHE_PREFIX + 'corrupt', 'cache antigua corrupta');
    quota(bytes() + 10);
    expect(() => writeSavedData('team', 'x'.repeat(1000))).toThrow();
    expect(localStorage.getItem('team')).toBe('original');
    expect(localStorage.getItem(API_CACHE_PREFIX + 'corrupt')).toBeNull();
  });
  it('no elimina caché ni reintenta si el navegador bloquea el almacenamiento', () => {
    localStorage.setItem(API_CACHE_PREFIX + 'pokemon', 'cached');
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(() => writeSavedData('team', 'new')).toThrow('Blocked');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(API_CACHE_PREFIX + 'pokemon')).toBe('cached');
    expect(storageFailureMessage(new DOMException('Blocked', 'SecurityError'), 'Error.')).toContain(
      'bloqueando',
    );
    expect(
      storageFailureMessage(new DOMException('Quota', 'QuotaExceededError'), 'Error.'),
    ).toContain('No hay un límite de equipos');
  });
});
describe('Caché acotada de PokéAPI', () => {
  it('limita el tamaño total y conserva las respuestas nuevas', () => {
    localStorage.setItem('team', 'saved team');
    let time = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => ++time);
    for (let i = 0; i < 4; i++)
      cacheApiResponse(`pokemon/test-${i}`, { payload: 'x'.repeat(170000) });
    expect(bytes()).toBeLessThanOrEqual(API_CACHE_BUDGET + 100);
    expect(localStorage.getItem(API_CACHE_PREFIX + 'pokemon/test-0')).toBeNull();
    expect(localStorage.getItem(API_CACHE_PREFIX + 'pokemon/test-3')).not.toBeNull();
    expect(localStorage.getItem('team')).toBe('saved team');
  });
  it('reduce una caché antigua sin límite al guardar la siguiente respuesta', () => {
    localStorage.setItem(
      API_CACHE_PREFIX + 'legacy',
      JSON.stringify({ time: 0, data: 'x'.repeat(API_CACHE_BUDGET) }),
    );
    localStorage.setItem('team', 'saved');
    cacheApiResponse('pokemon/new', { name: 'new' });
    expect(localStorage.getItem(API_CACHE_PREFIX + 'legacy')).toBeNull();
    expect(localStorage.getItem(API_CACHE_PREFIX + 'pokemon/new')).not.toBeNull();
    expect(localStorage.getItem('team')).toBe('saved');
  });
  it('mantiene las respuestas demasiado grandes en memoria sin llenar localStorage', async () => {
    const data = { payload: 'x'.repeat(API_CACHE_BUDGET) };
    const fetch = vi.fn(async () => ({ ok: true, json: async () => data }));
    vi.stubGlobal('fetch', fetch);
    expect(await request('test-oversized-storage')).toEqual(data);
    expect(await request('test-oversized-storage')).toEqual(data);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(API_CACHE_PREFIX + 'test-oversized-storage')).toBeNull();
  });
  it('permite consultar la API aunque el almacenamiento esté lleno de guardados', async () => {
    localStorage.setItem('team', 'saved');
    quota(bytes());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ name: 'new' }) })),
    );
    expect(await request('test-full-storage')).toEqual({ name: 'new' });
    expect(localStorage.getItem('team')).toBe('saved');
  });
});
