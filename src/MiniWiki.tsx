import { useMemo, useState } from 'react';
import { Search, BookOpen, Package, CircleDot, X } from 'lucide-react';
import { Modal, Types } from './components';
import { CategoryBadge, MoveType } from './MovePicker';
import { mechanicsLabel, type Gen } from './model';
import { accuracyLabel, powerLabel } from './moves';
import {
  searchWiki,
  wikiKindLabels,
  wikiStatKeys,
  abilityLabel,
  type WikiKind,
  type WikiEntry,
  type WikiPokemon,
  type WikiMove,
} from './wiki';
function WikiImage({ entry }: { entry: WikiEntry }) {
  const [failed, setFailed] = useState(false),
    [fallback, setFallback] = useState(false);
  const src =
    entry.kind === 'pokemon' && entry.sprite
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${entry.sprite}.png`
      : entry.kind === 'items' && entry.slug
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${fallback ? 'gen9/' : ''}${entry.slug}.png`
        : '';
  return (
    <span className="wiki-image">
      {src && !failed ? (
        <img
          src={src}
          alt={entry.name}
          loading="lazy"
          onError={() => {
            if (entry.kind === 'items' && !fallback) setFallback(true);
            else setFailed(true);
          }}
        />
      ) : entry.kind === 'items' ? (
        <Package size={20} aria-hidden="true" />
      ) : (
        <CircleDot size={20} aria-hidden="true" />
      )}
    </span>
  );
}
function PokemonStats({ entry, gen }: { entry: WikiPokemon; gen: Gen }) {
  const labels = {
    hp: 'PS',
    atk: 'Atk',
    def: 'Def',
    spa: gen === 1 ? 'Esp.' : 'SpA',
    spd: 'SpD',
    spe: 'Vel',
  };
  return (
    <div
      className="wiki-stats"
      style={{ gridTemplateColumns: `repeat(${wikiStatKeys(gen).length},minmax(0,1fr))` }}
    >
      {wikiStatKeys(gen).map((stat) => (
        <span key={stat}>
          <small>{labels[stat]}</small>
          <b>{entry.baseStats[stat]}</b>
        </span>
      ))}
    </div>
  );
}
function MoveFacts({ entry, gen }: { entry: WikiMove; gen: Gen }) {
  return (
    <div className="wiki-move-facts">
      <span>
        <small>Potencia</small>
        <b>{powerLabel(entry.power, entry.category)}</b>
      </span>
      <span>
        <small>Acierto</small>
        <b>{accuracyLabel(entry.accuracy)}</b>
      </span>
      <span
        title={`PP base: ${entry.basePP ?? '—'}. ${gen === 0 ? 'PP de Champions' : `Máximo con PP Más: ${entry.maxPP ?? '—'}`}`}
      >
        <small>PP{gen === 0 ? '' : ' base'}</small>
        <b>{entry.pp ?? '—'}</b>
      </span>
      {!!entry.priority && (
        <span>
          <small>Prioridad</small>
          <b>
            {entry.priority > 0 ? '+' : ''}
            {entry.priority}
          </b>
        </span>
      )}
    </div>
  );
}
export default function MiniWiki({
  gen,
  onChangeGen,
}: {
  gen: Gen;
  onChangeGen: (gen: Gen) => void;
}) {
  const [query, setQuery] = useState(''),
    [kind, setKind] = useState<WikiKind | 'all'>('all'),
    [limit, setLimit] = useState(40),
    [selected, setSelected] = useState<WikiEntry | null>(null);
  const results = useMemo(() => searchWiki(gen, query, kind), [gen, query, kind]);
  const navigateAbility = (name: string) => {
    setSelected(null);
    setKind('abilities');
    setQuery(name);
    setLimit(40);
  };
  function abilities(entry: WikiPokemon, hidden = false) {
    const names = hidden
      ? [entry.hiddenAbility].filter((name): name is string => !!name)
      : entry.abilities;
    return names.length ? (
      <div className="wiki-abilities">
        {names.map((name) => (
          <button key={name} onClick={() => navigateAbility(name)} title={name}>
            {abilityLabel(name)}
            <small>{abilityLabel(name) !== name ? name : ''}</small>
          </button>
        ))}
      </div>
    ) : (
      <span className="muted">{hidden ? '—' : 'Sin habilidades'}</span>
    );
  }
  return (
    <section className="wiki-view">
      <div className="wiki-header">
        <div>
          <p className="eyebrow">CONSULTA Y DESCUBRE</p>
          <h1>MiniWiki</h1>
          <p>Pokémon, habilidades, movimientos y objetos en un solo buscador.</p>
        </div>
        <label>
          Perfil de consulta
          <select
            aria-label="Generación de MiniWiki"
            value={gen}
            onChange={(event) => {
              onChangeGen(Number(event.target.value) as Gen);
              setLimit(40);
              setSelected(null);
            }}
          >
            <option value={0}>Pokémon Champions</option>
            {Array.from({ length: 9 }, (_, i) => (
              <option key={i} value={i + 1}>
                {mechanicsLabel((i + 1) as Gen)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="wiki-search">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          aria-label="Buscar en MiniWiki"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(40);
          }}
          placeholder="Busca en español o inglés: heat, Ignífugo, Onda Ígnea, roca calor…"
        />
        {query && (
          <button
            className="icon-button"
            aria-label="Limpiar búsqueda de MiniWiki"
            onClick={() => {
              setQuery('');
              setLimit(40);
            }}
          >
            <X size={17} />
          </button>
        )}
      </label>
      <div className="wiki-filters" role="group" aria-label="Filtrar MiniWiki">
        {(['all', ...Object.keys(wikiKindLabels)] as (WikiKind | 'all')[]).map((value) => (
          <button
            key={value}
            className={kind === value ? 'active' : ''}
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value);
              setLimit(40);
            }}
          >
            {value === 'all' ? 'Todo' : wikiKindLabels[value]}
          </button>
        ))}
      </div>
      <p className="small muted wiki-context">
        {mechanicsLabel(gen)} · Stats base y tipos del perfil.{' '}
        {gen === 1 ? 'La generación I usa una única estadística Especial. ' : ''}
        {gen !== 0 && gen < 5 ? 'Las habilidades ocultas aparecen desde la generación V. ' : ''}Las
        descripciones técnicas de Showdown se muestran en inglés; los efectos secundarios con datos
        numéricos también aparecen en español. Pulsa un nombre para ver su ficha.
      </p>
      <p className="wiki-result-count" role="status">
        {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
        {query ? ` para «${query}»` : ''}
      </p>
      {results.length ? (
        <div className="wiki-table-scroll">
          <table className="wiki-table">
            <caption className="sr-only">Resultados de MiniWiki para {mechanicsLabel(gen)}</caption>
            <tbody>
              {results.slice(0, limit).map((entry) => (
                <tr
                  key={`${entry.kind}:${entry.id}`}
                  className={`wiki-row wiki-entry-${entry.kind}`}
                >
                  <td>
                    <div className="wiki-name">
                      {(entry.kind === 'pokemon' || entry.kind === 'items') && (
                        <WikiImage key={`${entry.kind}:${entry.id}`} entry={entry} />
                      )}
                      <div>
                        <button onClick={() => setSelected(entry)}>{entry.localizedName}</button>
                        {entry.localizedName !== entry.name && <small>{entry.name}</small>}
                        <small className="wiki-kind">
                          {wikiKindLabels[entry.kind]}
                          {entry.nonstandard === 'Past'
                            ? ' · Histórico'
                            : entry.nonstandard
                              ? ' · Especial'
                              : ''}
                        </small>
                      </div>
                    </div>
                  </td>
                  {entry.kind === 'pokemon' ? (
                    <>
                      <td>
                        <Types types={entry.types} />
                      </td>
                      <td>{abilities(entry)}</td>
                      <td>{abilities(entry, true)}</td>
                      <td>
                        <PokemonStats entry={entry} gen={gen} />
                      </td>
                    </>
                  ) : entry.kind === 'moves' ? (
                    <>
                      <td>
                        <MoveType type={entry.type} />
                      </td>
                      <td>
                        <CategoryBadge category={entry.category} />
                      </td>
                      <td colSpan={2}>
                        <div className="wiki-move-body">
                          <MoveFacts entry={entry} gen={gen} />
                          <div>
                            <p lang="en">{entry.description}</p>
                            {entry.effects.length > 0 && (
                              <p className="wiki-secondary">{entry.effects.join(' ')}</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </>
                  ) : (
                    <td colSpan={4}>
                      <p lang="en" className="wiki-description">
                        {entry.description}
                      </p>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="library-empty">
          <BookOpen size={40} />
          <h2>No hay coincidencias en este perfil</h2>
          <p>Prueba otro nombre, categoría o generación.</p>
        </div>
      )}
      {results.length > limit && (
        <div className="wiki-more">
          <span className="small muted">
            Mostrando {Math.min(limit, results.length)} de {results.length}
          </span>
          <button className="button secondary" onClick={() => setLimit((value) => value + 40)}>
            Mostrar más resultados
          </button>
        </div>
      )}
      {selected && (
        <Modal
          title={selected.localizedName}
          subtitle={`${selected.name} · ${wikiKindLabels[selected.kind]} · ${mechanicsLabel(gen)}`}
          onClose={() => setSelected(null)}
        >
          {selected.kind === 'pokemon' ? (
            <div className="wiki-pokemon-detail">
              <WikiImage entry={selected} />
              <Types types={selected.types} />
              <h3>Estadísticas base</h3>
              <PokemonStats entry={selected} gen={gen} />
              <h3>Habilidades</h3>
              {abilities(selected)}
              <h3>Habilidad oculta</h3>
              {abilities(selected, true)}
            </div>
          ) : (
            <div className="wiki-text-detail">
              {selected.kind === 'moves' && (
                <>
                  <div className="move-facts">
                    <MoveType type={selected.type} />
                    <CategoryBadge category={selected.category} />
                  </div>
                  <MoveFacts entry={selected} gen={gen} />
                  {selected.effects.length > 0 && (
                    <p className="wiki-secondary">{selected.effects.join(' ')}</p>
                  )}
                </>
              )}
              <p lang="en">{selected.detail || selected.description}</p>
            </div>
          )}
        </Modal>
      )}
      <p className="small muted wiki-sources">
        Datos locales de{' '}
        <a
          href="https://github.com/smogon/pokemon-showdown/tree/master/data"
          target="_blank"
          rel="noreferrer"
        >
          Pokémon Showdown
        </a>
        ,{' '}
        <a
          href="https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv"
          target="_blank"
          rel="noreferrer"
        >
          PokéAPI
        </a>{' '}
        y el motor Smogon. «Histórico» indica contenido retirado de los juegos del perfil; no se
        valida un reglamento de temporada.
      </p>
    </section>
  );
}
