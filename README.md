# Pokémon Team Lab

Aplicación web para construir dos equipos de seis Pokémon y analizar enfrentamientos. Implementada siguiendo [TeamBuilderPokemonApp.md](TeamBuilderPokemonApp.md) y las referencias visuales del repositorio.

## Ejecutar

Requiere Node.js 22.15 o posterior y npm. Desde este directorio:

```powershell
npm ci
npm run dev
```

Abre la dirección que imprime Vite, normalmente **http://127.0.0.1:5173/**.

```powershell
npm run build       # TypeScript y producción en dist/
npm run preview     # Servir la versión de producción
npm run test        # Pruebas de dominio, motor e interfaz sin conexión
```

Prueba opcional con peticiones reales a PokéAPI:

```powershell
$env:RUN_LIVE_API = '1'
npm run test -- src/live.test.ts
Remove-Item Env:RUN_LIVE_API
```

## Uso

1. Elige las mecánicas (generaciones I–IX o Pokémon Champions) y añade un Pokémon en una plaza vacía. Los nombres de especies, habilidades, objetos y movimientos se usan en inglés para mantener compatibilidad con Showdown.
2. Carga la especie y configura sus movimientos, habilidad, naturaleza, objeto, nivel, sexo, variocolor, IVs, EVs y PS. Valores iniciales: nivel 50, IVs 31, EVs 0 y PS al 100 %. El porcentaje de PS se conserva al cambiar características.
3. Pulsa cualquier zona de una tarjeta Pokémon para seleccionarla o deseleccionarla; el nombre abre el editor sin cambiar la selección. También puedes seleccionar con Tab y Enter/Espacio. Puedes seleccionar varios Pokémon de ambos equipos y borrarlos juntos tras revisar la lista; las plazas vacías se ignoran. Selecciona exactamente dos plazas ocupadas de equipos diferentes para enfrentar Pokémon.
4. La calculadora muestra los cuatro movimientos de ambos Pokémon y recalcula al configurar clima, terreno, pantallas, estados, boosts, críticos, singles/dobles y Espacio Raro. Incluye Viento Afín y activación de efectos condicionales de habilidades.
5. Importa hasta seis Pokémon de Showdown en el equipo elegido. Por defecto se rellenan plazas libres; reemplazar el equipo requiere marcar la opción correspondiente. Todas las entradas se validan antes de modificar los equipos.
6. Exporta cualquiera de los equipos a texto, portapapeles o archivo `.txt`. Con los equipos vacíos, «Cargar ejemplo» prepara un enfrentamiento de sol y lluvia con datos de PokéAPI.
7. Cada naturaleza muestra las características que aumenta y reduce. En el editor y calculadora, flechas verdes/rojas indican la subida/bajada; las naturalezas neutras no muestran flechas.
8. Usa el botón de luna/sol para cambiar entre modo claro y oscuro. Se guarda la preferencia, y inicialmente se respeta la del sistema. La paleta usa azul, rojo Poké Ball y amarillo Pikachu.
9. En la calculadora, activa **Megaevolucionar** si el Pokémon lleva una piedra compatible. La forma depende de la piedra (por ejemplo, Charizardite X/Y); cambian estadísticas, tipos, habilidad, sprite, daño y velocidad. Puedes desactivarla para recuperar la forma original. La configuración del equipo no se modifica y se conservan nivel, naturaleza, IVs/EVs/SP, movimientos, porcentaje de PS, variocolor y boosts. El clima sigue configurándose manualmente.

## Datos y mecánicas

- **Perfiles:** generaciones I–IX con IVs/EVs como Showdown y **Pokémon Champions**, con 0–32 Stat Points (SP) por característica, un máximo de 66, nivel 50 e IVs perfectos.
- **PokéAPI** aporta los detalles de cada especie, movimientos aprendibles por generación, habilidades actuales e históricas, sexo y sprites. Sus respuestas se guardan en una caché local de siete días y se deduplican las peticiones simultáneas.
- **`@smogon/calc` 0.12** aporta los datos históricos y los motores de daño, incluido el motor nativo de Champions (perfil 0). Las estadísticas Champions siguen [la fórmula de Smogon](https://github.com/smogon/damage-calc/blob/master/calc/src/stats.ts): PS = base + SP + 75 (salvo Shedinja), y las otras características = `floor((base + SP + 20) × naturaleza)`. El catálogo del editor se cruza con los nombres compatibles con este motor. No se permite asignar movimientos o habilidades de otra especie.
- Para Champions, los movimientos aprendibles consultados en PokéAPI usan los grupos de versiones de la generación IX y se cruzan con el catálogo Champions del motor. PokéAPI no proporciona aquí un reglamento de temporada Champions; no se afirma legalidad de competición por temporada. Las formas nuevas siguen dependiendo de su disponibilidad en ambas fuentes.
- En generaciones I–II el motor usa DVs derivados de los IVs, calcula los DVs de PS a partir de las otras características y asume entrenamiento máximo. Los campos de EVs, naturaleza y habilidad se desactivan. Clima, terrenos, dobles y Espacio Raro se habilitan según su generación.
- El orden de ataque usa prioridades, Prankster, Gale Wings y Triage; velocidad efectiva del motor con boosts, estados, objetos, clima y Viento Afín; Espacio Raro; Stall, Mycelium Might y objetos que alteran el orden. Indica Speed Tie y advierte de las activaciones aleatorias de Quick Claw / Quick Draw.
- El cálculo es de un ataque aislado, no un simulador completo de turnos. No aplica automáticamente el clima de Drought/Drizzle: configura el campo. Los estados pueden impedir actuar; el orden mostrado presupone que ambos pueden hacerlo.

## Guardado y formato Showdown

Se guardan ambos equipos y la generación en `localStorage`, bajo `pokemon-team-lab:v1`, incluyendo las fichas consultadas para poder restaurarlos sin red. Los equipos pertenecen al navegador y origen donde se usan. No hay backend ni cuentas.

La importación soporta especie, mote, sexo, objeto, `Ability`, `Level`, `Shiny`, `EVs`, `IVs`, naturaleza y hasta cuatro movimientos, con una línea en blanco entre Pokémon. Los campos adicionales (por ejemplo, `Tera Type`, `Happiness` y cabeceras de cajas) se rechazan con un error explícito. Showdown no conserva los PS actuales; las importaciones empiezan al 100 %.

Se comprueban nivel 1–100, IVs 0–31, EVs 0–252 y total máximo 510 en los perfiles clásicos; Champions fija nivel 50/IVs 31 y limita los SP a 32/66. Se comprueban también sexo, especie, habilidad, objeto, naturaleza y movimientos. Cambiar las mecánicas reconsulta y revalida todos los Pokémon: si alguno es incompatible se conservan el perfil y equipos anteriores.

La conversión clásica → Champions usa `floor((EV + 4) / 8)`, establece nivel 50 e IVs 31, y conserva el porcentaje de PS. La conversión inversa usa `SP = 0 ? EV = 0 : EV = 8 × SP − 4`. Si un reparto de 66 SP no cabe en los 510 EVs clásicos, se rechaza el cambio sin recortar ni alterar el reparto guardado.

## Mis configuraciones

- En el editor, indica un nombre opcional y pulsa **Guardar configuración**. Se guarda una copia independiente en la biblioteca local, sin descargar archivos. También puedes guardar un Pokémon seleccionado con **Guardar configuración**. Pulsa **Exportar** en su fila para consultar el texto Pokémon Showdown, copiarlo al portapapeles o descargarlo en `.txt`, con el mismo diálogo que los equipos. Se usa el perfil guardado de la configuración, incluido Champions.
- Abre **Mis configuraciones** en el menú lateral. La tabla prioriza los seis valores EVs/SP, naturaleza y movimientos, e incluye nombre del build, Pokémon, nivel, sexo, variocolor, perfil, IVs, habilidad y objeto. Puedes buscar, renombrar y eliminar los builds; la eliminación requiere confirmar su nombre y conserva los Pokémon ya añadidos a equipos.
- Junto al sprite de cada Pokémon se muestra la imagen del objeto equipado, también en el editor y calculadora. Se consulta el recurso de [objetos de PokéAPI](https://pokeapi.co/docs/v2#items) con la misma caché local; para objetos recientes sin imagen en la API se usa su [repositorio de sprites](https://github.com/PokeAPI/sprites/tree/master/sprites/items/gen9). Si la imagen no está disponible, aparece un icono con el nombre del objeto.
- Selecciona el equipo de destino y pulsa **Añadir** en una fila: se usa la primera plaza libre, se convierte al perfil actual si es necesario y se vuelve a validar. Si falla, el equipo no cambia. Se desactiva el botón cuando el equipo está lleno.
- **Importar .txt** admite hasta seis configuraciones de Showdown por archivo (máximo 30 KB). Usa el selector de mecánicas de la biblioteca para indicar el perfil de importación. Todos los Pokémon se validan antes de guardar el archivo en la biblioteca; no se modifican los equipos al importar aquí.
- En los archivos Champions se escriben los SP 0–32 directamente en la línea estándar `EVs:`. El nombre del archivo indica `champions`; vuelve a importarlo con ese perfil seleccionado. No se multiplican los valores durante la exportación.
- Biblioteca: `pokemon-team-lab:configurations:v1`. Tema: `pokemon-team-lab:theme`. Equipos: `pokemon-team-lab:v1`; los guardados anteriores siguen siendo compatibles. Los archivos descargados no se escanean automáticamente: la tabla reúne los builds guardados en este navegador y los archivos que importes.
- La biblioteca conserva PS actuales, mientras Showdown `.txt` los restaura al 100 %. Exporta tus configuraciones antes de borrar los datos del navegador.

Las formas dependen de los recursos disponibles en PokéAPI y en la versión instalada del motor. Las formas sin movimientos para la generación elegida no se pueden guardar. La aplicación muestra errores de red y de almacenamiento y no sobrescribe un guardado corrupto al iniciarse. Exporta una copia antes de eliminar datos del navegador.

## Estructura

| Archivo                        | Responsabilidad                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `src/App.tsx`                  | Equipos, selección, persistencia y coordinación                                         |
| `src/components.tsx`           | Editor, importación/exportación y diálogos accesibles                                   |
| `src/Calculator.tsx`           | Configuración del combate y resultados bidireccionales                                  |
| `src/model.ts`                 | Modelo, validaciones y adaptador de Pokémon al motor                                    |
| `src/api.ts`                   | PokéAPI, caché, formas y datos históricos                                               |
| `src/showdown.ts`              | Importador y exportador de Showdown                                                     |
| `src/battle.ts`                | Daño, campo y orden de ataque                                                           |
| `src/styles.css`               | Diseño adaptable para escritorio y móvil                                                |
| `src/core.test.ts`             | Reglas e integración con el motor real                                                  |
| `src/ui.test.tsx`              | Flujos completos con React y jsdom                                                      |
| `src/live.test.ts`             | Integración opcional con PokéAPI real                                                   |
| `src/ConfigurationLibrary.tsx` | Tabla, búsqueda, importación de archivos y reutilización de builds                      |
| `src/library.ts`               | Persistencia de configuraciones, deduplicación y descargas                              |
| `src/theme.css`                | Paleta Pokémon, temas claro/oscuro y estilos de biblioteca                              |
| `src/champions.test.ts`        | Fórmula Champions, límites, conversiones, naturalezas y biblioteca                      |
| `src/mega.test.ts`             | Piedras y formas mega, estadísticas, daño, velocidad y conservación de la configuración |

React + TypeScript + Vite, CSS propio, Lucide y Vitest. El código se formatea con Prettier.

## Validación

La implementación se verifica con compilación de producción, pruebas de importación/exportación, legalidad, PS, cálculos reales de Smogon, las nueve generaciones, prioridades/velocidad y flujos de interfaz. Se prueban selección por tarjeta, copia/descarga de configuraciones y megaevoluciones por piedra, con retorno a la forma base sin alterar equipos. La prueba de integración consulta una especie de cada generación, el ejemplo Torkoal, habilidades/tipos históricos de Gengar y Clefairy, imágenes de objetos y sprites de Charizard Mega X/Y. El servidor local se comprueba mediante HTTP.

La revisión visual en un navegador real no pudo realizarse: no había ningún navegador conectado disponible en el entorno de desarrollo. jsdom verifica comportamiento y accesibilidad consultable, pero no el diseño visual ni el comportamiento nativo de los diálogos.

## Referencias

- [PokéAPI: documentación](https://pokeapi.co/docs/v2)
- [Smogon Damage Calculator: código y API](https://github.com/smogon/damage-calc)
- [Calculadora de referencia](https://calc.pokemonshowdown.com/)
- [Pokémon Champions: información oficial](https://champions.pokemon.com/en-us/pokemon/)
- Las piedras, formas y estadísticas mega se resuelven con [los datos del motor Smogon](https://github.com/smogon/damage-calc/blob/master/calc/src/data/items.ts). Solo se ofrece el control si la piedra y forma existen en el perfil elegido y son compatibles con la especie; se respeta el catálogo del motor sin afirmar legalidad de reglamentos de temporada.

Pokémon y los diseños de sus personajes pertenecen a sus respectivos titulares. Proyecto independiente, sin afiliación oficial.
