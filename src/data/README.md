# Catálogo local de movimientos

Snapshot de datos públicos incorporado el 10 de octubre de 2026. Las fichas de movimiento abren sin peticiones de red.

- [PokéAPI CSV](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv): nombres en español, descripciones, PP base, precisión e historial.
- [Pokémon Showdown movedex](https://play.pokemonshowdown.com/data/moves.json): datos complementarios y movimientos sin aumento de PP.
- [Modificaciones históricas de Showdown](https://github.com/smogon/pokemon-showdown/tree/master/data/mods): cambios de precisión/PP en generaciones I–VIII y Champions.
- [Reglas de PP de Champions](https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/scripts.ts): PP base limitados a 20 y PP de combate `(base / 5 + 1) × 4`, salvo movimientos sin aumento.
- [PP clásicos de Showdown](https://github.com/smogon/pokemon-showdown/blob/master/sim/battle.ts): 3 PP Más por defecto; en I–II, un movimiento de 40 PP alcanza 61.

Tipo, categoría y potencia base se toman del perfil nativo de `@smogon/calc`. PokéAPI identifica ataques sin potencia base numérica, como Giro Bola, que se etiquetan como «Variable» en lugar de mostrar valores simbólicos internos del motor. Las prioridades se completan con los datos de Showdown, incluyendo las negativas de movimientos de estado que el calculador omite, y se utilizan tanto en las fichas como en el orden de ataque. Las descripciones de PokéAPI son textos orientativos de los juegos: se prioriza español y se utiliza inglés cuando no existe traducción. No describen todas las interacciones o modificaciones de reglamentos Champions.

Regenerar con `npm run update:moves` (requiere red). El script analiza los archivos TypeScript de Smogon como datos mediante su AST, sin ejecutar código descargado. El build normal utiliza el JSON versionado y no descarga nada.

Créditos: datos de PokéAPI y Smogon / Pokémon Showdown. Los nombres y textos de Pokémon pertenecen a sus respectivos titulares.

## Catálogo de MiniWiki

`wiki.json` incorpora un snapshot del 13 de octubre de 2026 con 1380 registros de Pokémon/formas, 321 habilidades, 954 movimientos y 583 objetos antes de filtrar por el catálogo nativo y el perfil. Se carga solo al abrir MiniWiki.

- Datos y modificaciones de [Pokémon Showdown](https://github.com/smogon/pokemon-showdown/tree/master/data), generaciones I–VIII y Champions: habilidades por ranura normal/oculta, PP, precisión, prioridades y efectos secundarios.
- [Textos técnicos de Showdown](https://github.com/smogon/pokemon-showdown/tree/master/data/text): descripción breve/ampliada e historial por generación, incluidos textos específicos de Champions. Se conserva el inglés de la fuente; los efectos secundarios estructurados se expresan también en español sin inventar porcentajes.
- [CSV de PokéAPI](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv): nombres españoles y referencias para imágenes de Pokémon/formas y objetos. Tipos y estadísticas se obtienen del perfil nativo de `@smogon/calc`, y la generación I muestra una estadística Especial.
- Run Away en Champions se resume desde [su modificación de Showdown](https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/abilities.ts), que permite cambiar aun ante efectos de atrapamiento; su texto clásico no describe ese cambio.
- Se adjunta la [licencia MIT de Showdown](showdown-LICENSE) con su aviso de copyright. Créditos de PokéAPI y Pokémon como arriba.

Regenerar con `npm run update:wiki`. El script analiza literales del AST de TypeScript; nunca evalúa ni ejecuta código descargado. El snapshot guarda perfiles completos y solo conserva los que cambian; el lector resuelve IX hacia la generación elegida y Champions aplica su propio perfil. La lista se cruza con el catálogo nativo instalado y excluye contenido CAP, personalizado y futuro. «Histórico» conserva contenido retirado para consultar sus mecánicas, sin validar temporadas competitivas. Las búsquedas usan únicamente datos locales y no duplican este catálogo en localStorage.
