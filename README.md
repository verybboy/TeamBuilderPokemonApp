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

1. Pokémon Champions es el perfil inicial para equipos nuevos. Los equipos guardados recuperan su perfil anterior. Puedes elegir generaciones I–IX o Champions y añadir un Pokémon en una plaza vacía. Especies, habilidades, objetos y movimientos mantienen sus nombres ingleses para Showdown; el selector añade los nombres españoles de los movimientos cuando están disponibles.
2. Carga la especie y configura sus movimientos, habilidad, naturaleza, objeto, nivel, sexo, variocolor, IVs, EVs y PS. Valores iniciales: nivel 50, IVs 31, EVs 0 y PS al 100 %. El porcentaje de PS se conserva al cambiar características.
3. Pulsa cualquier zona de una tarjeta Pokémon para seleccionarla o deseleccionarla; el nombre abre el editor sin cambiar la selección. También puedes seleccionar con Tab y Enter/Espacio. Puedes seleccionar varios Pokémon de ambos equipos y borrarlos juntos tras revisar la lista; las plazas vacías se ignoran. Selecciona exactamente dos plazas ocupadas de equipos diferentes para enfrentar Pokémon.
4. La calculadora muestra los cuatro movimientos de ambos Pokémon y recalcula al configurar clima, terreno, pantallas, estados, boosts, críticos, singles/dobles y Espacio Raro. Los efectos de Equipo 1 y Equipo 2 aparecen en dos columnas, lado a lado: Reflejo, Pantalla de Luz, Viento Afín, Velo Aurora y Refuerzo. Velo Aurora representa una pantalla ya activa (desde generación VII), sin exigir que continúe el clima que permitió activarla. Refuerzo potencia al atacante del equipo marcado y solo se habilita en dobles (desde generación III). El motor resuelve las pantallas, su interacción con críticos y el daño en ambas direcciones.
5. Importa hasta seis Pokémon de Showdown en el equipo elegido. Por defecto se rellenan plazas libres; reemplazar el equipo requiere marcar la opción correspondiente. Todas las entradas se validan antes de modificar los equipos.
6. Exporta cualquiera de los equipos a texto, portapapeles o archivo `.txt`. Con los equipos vacíos, «Cargar ejemplo» prepara un enfrentamiento de sol y lluvia con datos de PokéAPI.
7. Cada naturaleza muestra las características que aumenta y reduce. En el editor y calculadora, flechas verdes/rojas indican la subida/bajada; las naturalezas neutras no muestran flechas.
8. Usa el botón de luna/sol para cambiar entre modo claro y oscuro. Se guarda la preferencia, y inicialmente se respeta la del sistema. La paleta usa azul, rojo Poké Ball y amarillo Pikachu.
9. En la calculadora, activa **Megaevolucionar** si el Pokémon lleva una piedra compatible. La forma depende de la piedra (por ejemplo, Charizardite X/Y); cambian estadísticas, tipos, habilidad, sprite, daño y velocidad. Puedes desactivarla para recuperar la forma original. La configuración del equipo no se modifica y se conservan nivel, naturaleza, IVs/EVs/SP, movimientos, porcentaje de PS, variocolor y boosts. El clima sigue configurándose manualmente.
10. En el editor, el selector de movimientos presenta filas con nombre español/inglés, tipo coloreado, icono físico/especial/estado, potencia, acierto, PP y descripción breve. Busca por nombre, tipo o categoría; usa las flechas y Enter para seleccionar o Escape para cerrar la lista. Solo incluye movimientos aprendibles y disponibles en el perfil. Las tarjetas del constructor también muestran el tipo de cada movimiento.
11. En la calculadora, edita los seis EVs/SP de cada Pokémon para comparar repartos. Se recalculan PS, estadísticas, daño y velocidad, conservando el porcentaje de PS. Los repartos respetan los límites 252/510 o 32/66; los valores inválidos no se aplican. **Restablecer reparto** recupera el original. Los cambios son locales a la comparación y no alteran equipos o builds guardados; se conservan al activar/desactivar una megaevolución. Los datos de movimientos son más grandes e incluyen prioridad positiva/negativa.
12. Junto al nombre de cada equipo, **Guardar en Mis equipos** conserva una copia con el nombre que elijas. **Limpiar equipo entero** muestra sus Pokémon, pide continuar y luego escribir `LIMPIAR` para confirmar. Vacía solo ese equipo, conserva su nombre y las bibliotecas guardadas.
13. Debajo de cada equipo, **Cobertura defensiva** muestra los 18 tipos ofensivos disponibles en el perfil (menos en generaciones antiguas), las seis plazas, multiplicadores y totales. Cada Pokémon débil/resistente cuenta una vez, aunque tenga 4×/¼; las inmunidades cuentan como resistencias. Usa tipos y tablas históricos del motor, sin habilidades, objetos ni efectos de campo. La tabla se desplaza horizontalmente en pantallas estrechas.

## Datos y mecánicas

- **Perfiles:** generaciones I–IX con IVs/EVs como Showdown y **Pokémon Champions**, con 0–32 Stat Points (SP) por característica, un máximo de 66, nivel 50 e IVs perfectos.
- **PokéAPI** aporta los detalles de cada especie, movimientos aprendibles por generación, habilidades actuales e históricas, sexo y sprites. Sus respuestas se guardan en una caché local de siete días y se deduplican las peticiones simultáneas.
- **`@smogon/calc` 0.12** aporta los datos históricos y los motores de daño, incluido el motor nativo de Champions (perfil 0). Las estadísticas Champions siguen [la fórmula de Smogon](https://github.com/smogon/damage-calc/blob/master/calc/src/stats.ts): PS = base + SP + 75 (salvo Shedinja), y las otras características = `floor((base + SP + 20) × naturaleza)`. El catálogo del editor se cruza con los nombres compatibles con este motor. No se permite asignar movimientos o habilidades de otra especie.
- Para Champions, los movimientos aprendibles consultados en PokéAPI usan los grupos de versiones de la generación IX y se cruzan con el catálogo Champions del motor. PokéAPI no proporciona aquí un reglamento de temporada Champions; no se afirma legalidad de competición por temporada. Las formas nuevas siguen dependiendo de su disponibilidad en ambas fuentes.
- En generaciones I–II el motor usa DVs derivados de los IVs, calcula los DVs de PS a partir de las otras características y asume entrenamiento máximo. Los campos de EVs, naturaleza y habilidad se desactivan. Clima, terrenos, dobles y Espacio Raro se habilitan según su generación.
- El orden de ataque usa prioridades, Prankster, Gale Wings y Triage; velocidad efectiva del motor con boosts, estados, objetos, clima y Viento Afín; Espacio Raro; Stall, Mycelium Might y objetos que alteran el orden. Indica Speed Tie y advierte de las activaciones aleatorias de Quick Claw / Quick Draw.
- El cálculo es de un ataque aislado, no un simulador completo de turnos. No aplica automáticamente el clima de Drought/Drizzle: configura el campo. Los estados pueden impedir actuar; el orden mostrado presupone que ambos pueden hacerlo.
- El [catálogo local de movimientos](src/data/README.md) completa precisión, PP, nombres/descripciones y prioridades con PokéAPI y Showdown. No requiere red para abrir el selector. Se muestran PP máximos con 3 PP Más en perfiles clásicos y los PP propios de Champions (por ejemplo, Heat Wave: 12; Protect: 8). Tipo, categoría y potencia base siguen el motor del perfil; las potencias variables se identifican como tales. Acierto y prioridades son los valores base, sin aplicar modificadores de campo/habilidad en las fichas. Las descripciones son orientativas de los juegos y no describen todas las interacciones Champions. `npm run update:moves` regenera el snapshot con red; el build normal usa el archivo versionado.

## Guardado y formato Showdown

Se guardan ambos equipos y la generación en `localStorage`, bajo `pokemon-team-lab:v1`, incluyendo las fichas consultadas para poder restaurarlos sin red. Los equipos pertenecen al navegador y origen donde se usan. No hay backend ni cuentas.

La importación soporta especie, mote, sexo, objeto, `Ability`, `Level`, `Shiny`, `EVs`, `IVs`, naturaleza y hasta cuatro movimientos, con una línea en blanco entre Pokémon. Los campos adicionales (por ejemplo, `Tera Type`, `Happiness` y cabeceras de cajas) se rechazan con un error explícito. Showdown no conserva los PS actuales; las importaciones empiezan al 100 %.

Se comprueban nivel 1–100, IVs 0–31, EVs 0–252 y total máximo 510 en los perfiles clásicos; Champions fija nivel 50/IVs 31 y limita los SP a 32/66. Se comprueban también sexo, especie, habilidad, objeto, naturaleza y movimientos. Cambiar las mecánicas reconsulta y revalida todos los Pokémon: si alguno es incompatible se conservan el perfil y equipos anteriores.

La conversión clásica → Champions usa `floor((EV + 4) / 8)`, establece nivel 50 e IVs 31, y conserva el porcentaje de PS. La conversión inversa usa `SP = 0 ? EV = 0 : EV = 8 × SP − 4`. Si un reparto de 66 SP no cabe en los 510 EVs clásicos, se rechaza el cambio sin recortar ni alterar el reparto guardado.

## Mis configuraciones

- Dos apartados: **Mis Pokémon**, ordenado alfabéticamente por especie y después por nombre de configuración; **Mis equipos**, ordenado por el nombre elegido al guardarlo. Se mantienen los Pokémon guardados anteriormente.
- En **Mis equipos** puedes buscar por nombre o integrantes, renombrar, eliminar con confirmación y exportar el equipo completo con copia Showdown o descarga voluntaria `.txt`. **Cargar** usa el destino elegido; si tiene Pokémon, pide confirmar el reemplazo. Convierte y valida todos los integrantes antes de cambiar el destino, conservando las seis posiciones del equipo guardado. La importación `.txt` en este apartado guarda un equipo por archivo y toma su nombre del archivo.
- En el editor, indica un nombre opcional y pulsa **Guardar configuración**. Se guarda una copia independiente en la biblioteca local, sin descargar archivos. También puedes guardar un Pokémon seleccionado con **Guardar configuración**. Pulsa **Exportar** en su fila para consultar el texto Pokémon Showdown, copiarlo al portapapeles o descargarlo en `.txt`, con el mismo diálogo que los equipos. Se usa el perfil guardado de la configuración, incluido Champions.
- Abre **Mis configuraciones** en el menú lateral. La tabla prioriza los seis valores EVs/SP, naturaleza y movimientos, e incluye nombre del build, Pokémon, nivel, sexo, variocolor, perfil, IVs, habilidad y objeto. Puedes buscar, renombrar y eliminar los builds; la eliminación requiere confirmar su nombre y conserva los Pokémon ya añadidos a equipos.
- Junto al sprite de cada Pokémon se muestra la imagen del objeto equipado, también en el editor y calculadora. Se consulta el recurso de [objetos de PokéAPI](https://pokeapi.co/docs/v2#items) con la misma caché local; para objetos recientes sin imagen en la API se usa su [repositorio de sprites](https://github.com/PokeAPI/sprites/tree/master/sprites/items/gen9). Si la imagen no está disponible, aparece un icono con el nombre del objeto.
- Selecciona el equipo de destino y pulsa **Añadir** en una fila: se usa la primera plaza libre, se convierte al perfil actual si es necesario y se vuelve a validar. Si falla, el equipo no cambia. Se desactiva el botón cuando el equipo está lleno.
- **Importar .txt** admite hasta seis configuraciones de Showdown por archivo (máximo 30 KB). Usa el selector de mecánicas de la biblioteca para indicar el perfil de importación. Todos los Pokémon se validan antes de guardar el archivo en la biblioteca; no se modifican los equipos al importar aquí.
- En los archivos Champions se escriben los SP 0–32 directamente en la línea estándar `EVs:`. El nombre del archivo indica `champions`; vuelve a importarlo con ese perfil seleccionado. No se multiplican los valores durante la exportación.
- Biblioteca de Pokémon: `pokemon-team-lab:configurations:v1`. Biblioteca de equipos: `pokemon-team-lab:teams:v1`. Tema: `pokemon-team-lab:theme`. Constructor: `pokemon-team-lab:v1`; los guardados anteriores siguen siendo compatibles. Las copias conservan el perfil y PS actuales, no se modifican al editar o limpiar el constructor, y se deduplican por nombre, perfil y configuración completa. Los archivos descargados no se escanean automáticamente: la tabla reúne los builds guardados en este navegador y los archivos que importes.
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
| `src/SavedTeams.tsx`           | Biblioteca de equipos, carga, renombrado, borrado y exportación                         |
| `src/TeamDialogs.tsx`          | Guardado del equipo completo y limpieza con doble confirmación                          |
| `src/coverage.ts`              | Cobertura defensiva por tipos y perfil                                                  |
| `src/DefensiveCoverage.tsx`    | Tabla de multiplicadores, integrantes y totales                                         |
| `src/teams.css`                | Biblioteca de equipos, cobertura y efectos de combate en dos columnas                   |
| `src/team-features.test.ts`    | Copias de equipos, tablas históricas y daño real con Velo Aurora/Refuerzo               |
| `src/library.ts`               | Persistencia de configuraciones, deduplicación y descargas                              |
| `src/theme.css`                | Paleta Pokémon, temas claro/oscuro y estilos de biblioteca                              |
| `src/champions.test.ts`        | Fórmula Champions, límites, conversiones, naturalezas y biblioteca                      |
| `src/mega.test.ts`             | Piedras y formas mega, estadísticas, daño, velocidad y conservación de la configuración |
| `src/MovePicker.tsx`           | Selector accesible por filas y fichas de movimientos con iconos                         |
| `src/moves.ts`                 | Datos de movimiento por perfil, precisión, PP y prioridades históricas                  |
| `src/moves.css`                | Selector adaptable, tipos y datos ampliados de la calculadora                           |
| `src/moves.test.ts`            | Datos históricos, PP Champions, prioridades y cambios de EVs/SP                         |
| `scripts/update-moves.mjs`     | Generación del catálogo local desde datos públicos de PokéAPI y Showdown                |

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
