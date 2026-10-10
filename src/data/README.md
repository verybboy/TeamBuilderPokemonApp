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
