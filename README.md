# Pokémon Team Lab

Aplicación web con hasta cinco LABs independientes, cada uno con dos equipos de seis Pokémon y sus propias mecánicas, para analizar enfrentamientos. Implementada siguiendo [TeamBuilderPokemonApp.md](TeamBuilderPokemonApp.md) y las referencias visuales del repositorio.

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

1. Usa las pestañas **LAB** del constructor y **+** para crear hasta cinco LABs. Cada uno tiene dos equipos, nombre editable y mecánica independiente (I–IX, Locke o Champions). Los LABs nuevos empiezan vacíos con Champions; los guardados recuperan su perfil. Cambiar de LAB limpia la selección de tarjetas y las previsualizaciones de cobertura mega. Especies, habilidades, objetos y movimientos mantienen sus nombres ingleses para Showdown; el selector añade los nombres españoles de los movimientos cuando están disponibles.
2. Carga la especie y configura sus movimientos, habilidad, naturaleza, objeto, nivel, sexo, variocolor, IVs, EVs y PS. Valores iniciales: nivel 50, IVs 31, EVs 0 y PS al 100 %. El porcentaje de PS se conserva al cambiar características.
3. Pulsa cualquier zona de una tarjeta Pokémon para seleccionarla o deseleccionarla; el nombre abre el editor sin cambiar la selección. También puedes seleccionar con Tab y Enter/Espacio. Puedes seleccionar varios Pokémon de ambos equipos y borrarlos juntos tras revisar la lista; las plazas vacías se ignoran. Selecciona exactamente dos plazas ocupadas de equipos diferentes para enfrentar Pokémon.
4. La calculadora muestra los cuatro movimientos de ambos Pokémon y recalcula al configurar clima, terreno, pantallas, estados, boosts, críticos, singles/dobles y Espacio Raro. Los efectos de Equipo 1 y Equipo 2 aparecen en dos columnas, lado a lado: Reflejo, Pantalla de Luz, Viento Afín, Velo Aurora y Refuerzo. Velo Aurora representa una pantalla ya activa (desde generación VII), sin exigir que continúe el clima que permitió activarla. Refuerzo potencia al atacante del equipo marcado y solo se habilita en dobles (desde generación III). El motor resuelve las pantallas, su interacción con críticos y el daño en ambas direcciones.
5. Importa hasta seis Pokémon de Showdown en el equipo elegido. Por defecto se rellenan plazas libres; reemplazar el equipo requiere marcar la opción correspondiente. Todas las entradas se validan antes de modificar los equipos.
6. Exporta cualquiera de los equipos a texto, portapapeles o archivo `.txt`. Con los equipos vacíos, «Cargar ejemplo» prepara un enfrentamiento de sol y lluvia con datos de PokéAPI.
7. Cada naturaleza muestra las características que aumenta y reduce. En el editor y calculadora, flechas verdes/rojas indican la subida/bajada; las naturalezas neutras no muestran flechas.
8. Usa el botón de luna/sol para cambiar entre modo claro y oscuro. Se guarda la preferencia, y inicialmente se respeta la del sistema. La paleta está inspirada en Torkoal: naranja brasa, rojo del caparazón, gris carbón y crema del humo. Botones, navegación, bordes y superficies se adaptan a ambos temas, con texto de contraste específico para los acentos.
   Los campos editables tienen fondo blanco y borde naranja diferenciado; en modo oscuro usan un marrón cálido considerablemente más luminoso que los paneles. Incluye nombres de equipo, búsquedas, selectores, movimientos, IVs/EVs y campos de texto. Los campos desactivados o de solo lectura conservan su aspecto neutro.
   TEAMLAB y el favicon usan el mismo [sprite pixel art de Torkoal](https://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/324.png), incluido en `public/branding/torkoal.png` para cargarse sin consultar la API. El logo conserva los píxeles nítidos y el PNG su transparencia. Los colores identificativos de los tipos y las indicaciones de subida/bajada, daño y PS mantienen su significado.
9. En la calculadora, activa **Megaevolucionar** si el Pokémon lleva una piedra compatible. La forma depende de la piedra (por ejemplo, Charizardite X/Y); cambian estadísticas, tipos, habilidad, sprite, daño y velocidad. Puedes desactivarla para recuperar la forma original. La configuración del equipo no se modifica y se conservan nivel, naturaleza, IVs/EVs/SP, movimientos, porcentaje de PS, variocolor y boosts. El clima sigue configurándose manualmente.
10. En el editor, el selector de movimientos presenta filas con nombre español/inglés, tipo coloreado, icono físico/especial/estado, potencia, acierto, PP y descripción breve. Busca por nombre, tipo o categoría; usa las flechas y Enter para seleccionar o Escape para cerrar la lista. Incluye movimientos aprendibles y disponibles en el perfil; en Locke incluye el catálogo completo IX. Las tarjetas del constructor también muestran el tipo de cada movimiento.
11. En la calculadora, edita los seis EVs/SP de cada Pokémon para comparar repartos. Se recalculan PS, estadísticas, daño y velocidad, conservando el porcentaje de PS. Los repartos respetan los límites 252/510 o 32/66; los valores inválidos no se aplican. **Restablecer reparto** recupera el original. Los cambios son locales a la comparación y no alteran equipos o builds guardados; se conservan al activar/desactivar una megaevolución. Los datos de movimientos son más grandes e incluyen prioridad positiva/negativa.
12. Junto al nombre de cada equipo, **Guardar en Mis equipos** conserva una copia con el nombre que elijas. **Limpiar equipo entero** muestra sus Pokémon, pide continuar y luego escribir `LIMPIAR` para confirmar. Vacía solo ese equipo, conserva su nombre y las bibliotecas guardadas.
13. Debajo de cada equipo, **Cobertura defensiva** muestra los 18 tipos ofensivos disponibles en el perfil (menos en generaciones antiguas), las seis plazas, multiplicadores y totales. Cada Pokémon débil/resistente cuenta una vez, aunque tenga 4×/¼; las inmunidades cuentan como resistencias. Usa tipos y tablas históricos del motor, sin habilidades ni efectos de campo/objetos. Si un Pokémon lleva una megapiedra compatible, marca **Mega** en su columna para calcular con los tipos de esa forma: por ejemplo, Charizardite X cambia a Fuego/Dragón y Charizardite Y mantiene Fuego/Volador. Se actualizan nombre, tipos, sprite, multiplicadores y totales; desmarcar recupera la forma base. La selección solo afecta a la tabla, es independiente en cada equipo y se reinicia al cambiar especie, piedra o perfil, o vaciar la plaza. La cobertura mega funciona sin red; la imagen se consulta aparte y se puede reintentar desmarcando y marcando Mega. La tabla se desplaza horizontalmente en pantallas estrechas.

Los movimientos con crítico fijo (como Frost Breath, Storm Throw, Wicked Blow, Surging Strikes o Flower Trick) muestran **Crítico** marcado y bloqueado según los datos nativos del perfil; las habilidades defensivas pueden impedir el crítico en el cálculo. Los demás ataques permiten activar críticos manualmente.

La **X** de cada LAB permite cerrarlo con doble confirmación: revisar sus dos equipos, continuar y escribir `CERRAR`. El cierre elimina ese LAB y sus equipos, conserva las bibliotecas y libera una plaza para crear otro. Si era el activo, abre el vecino; al cerrar el último crea un LAB 1 vacío en Champions. Si el navegador no puede guardar el cierre, conserva el LAB y permite reintentarlo. Los LABs nuevos reciben un nombre predeterminado disponible para evitar duplicados después de cerrar pestañas.

## Datos y mecánicas

- **Perfiles:** generaciones I–IX con IVs/EVs como Showdown, **Locke** y **Pokémon Champions**, con 0–32 Stat Points (SP) por característica, un máximo de 66, nivel 50 e IVs perfectos.
- **Locke:** elige cualquier Pokémon, movimiento y habilidad del catálogo de generación IX, aunque la especie no los aprenda habitualmente. Datos de movimientos, estadísticas, daño y velocidad siguen las reglas IX; IVs 0–31, EVs 0–252 y máximo 510, nivel 50 por defecto. Conserva el perfil en constructor, bibliotecas y copias de seguridad. Exporta Showdown normalmente e importa con Locke seleccionado (el .txt no codifica el perfil). Al cambiar a otro perfil, revalida movimientos y habilidades propios de cada especie y conserva el estado anterior si hay incompatibilidades. El identificador interno 10 representa Locke y se traduce a 9 al llamar al motor; no representa una generación X.
- **PokéAPI** aporta los detalles de cada especie, movimientos aprendibles por generación, habilidades actuales e históricas, sexo y sprites. Sus respuestas se guardan hasta siete días en una caché local limitada a aproximadamente 1 MiB, retirando las más antiguas cuando hace falta espacio. Las respuestas que superan ese presupuesto solo se conservan en memoria durante la sesión. Se deduplican las peticiones simultáneas.
- **`@smogon/calc` 0.12** aporta los datos históricos y los motores de daño, incluido el motor nativo de Champions (perfil 0). Las estadísticas Champions siguen [la fórmula de Smogon](https://github.com/smogon/damage-calc/blob/master/calc/src/stats.ts): PS = base + SP + 75 (salvo Shedinja), y las otras características = `floor((base + SP + 20) × naturaleza)`. El catálogo del editor se cruza con los nombres compatibles con este motor. Excepto en Locke, solo permite movimientos y habilidades propios de cada especie.
- Para Champions, los movimientos aprendibles consultados en PokéAPI usan los grupos de versiones de la generación IX y se cruzan con el catálogo Champions del motor. PokéAPI no proporciona aquí un reglamento de temporada Champions; no se afirma legalidad de competición por temporada. Las formas nuevas siguen dependiendo de su disponibilidad en ambas fuentes.
- En generaciones I–II el motor usa DVs derivados de los IVs, calcula los DVs de PS a partir de las otras características y asume entrenamiento máximo. Los campos de EVs, naturaleza y habilidad se desactivan. Clima, terrenos, dobles y Espacio Raro se habilitan según su generación.
- El orden de ataque usa prioridades, Prankster, Gale Wings y Triage; velocidad efectiva del motor con boosts, estados, objetos, clima y Viento Afín; Espacio Raro; Stall, Mycelium Might y objetos que alteran el orden. Indica Speed Tie y advierte de las activaciones aleatorias de Quick Claw / Quick Draw.
- El cálculo es de un ataque aislado, no un simulador completo de turnos. No aplica automáticamente el clima de Drought/Drizzle: configura el campo. Los estados pueden impedir actuar; el orden mostrado presupone que ambos pueden hacerlo.
- El [catálogo local de movimientos](src/data/README.md) completa precisión, PP, nombres/descripciones y prioridades con PokéAPI y Showdown. No requiere red para abrir el selector. Se muestran PP máximos con 3 PP Más en perfiles clásicos y los PP propios de Champions (por ejemplo, Heat Wave: 12; Protect: 8). Tipo, categoría y potencia base siguen el motor del perfil; las potencias variables se identifican como tales. Acierto y prioridades son los valores base, sin aplicar modificadores de campo/habilidad en las fichas. Las descripciones son orientativas de los juegos y no describen todas las interacciones Champions. `npm run update:moves` regenera el snapshot con red; el build normal usa el archivo versionado.

## Guardado y formato Showdown

Se guardan todos los LABs, sus dos equipos, nombres, mecánicas y LAB activo en `localStorage`, bajo `pokemon-team-lab:v1`, con contenido versión 2 y las fichas consultadas para restaurarlos sin red. Los guardados anteriores versión 1 se migran en memoria a **LAB 1** conservando sus equipos y perfil; no se sobrescribe el original hasta modificar el constructor. Las copias completas admiten ambas versiones y validan también los LABs inactivos. Los equipos pertenecen al navegador y origen donde se usan. No hay backend ni cuentas.

No existe un límite de cinco equipos ni otro límite por cantidad en la biblioteca. Sí existe la [cuota de almacenamiento local del navegador](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), compartida con la caché de PokéAPI. Ante `QuotaExceededError`, los guardados del constructor, bibliotecas y tema retiran respuestas antiguas de esa caché y reintentan la escritura. Se conservan los equipos, Pokémon guardados y otros datos del origen; si el nuevo guardado sigue sin caber, permanece el valor anterior y se muestra un aviso de espacio lleno. Los errores de bloqueo del navegador se distinguen de los errores de cuota. La caché antigua sin límite se reduce al escribir una respuesta nueva o cuando un guardado necesita espacio; no es necesario borrar los datos del sitio.

La importación soporta especie, mote, sexo, objeto, `Ability`, `Level`, `Shiny`, `EVs`, `IVs`, naturaleza y hasta cuatro movimientos, con una línea en blanco entre Pokémon. Los campos adicionales (por ejemplo, `Tera Type`, `Happiness` y cabeceras de cajas) se rechazan con un error explícito. Showdown no conserva los PS actuales; las importaciones empiezan al 100 %.

Se comprueban nivel 1–100, IVs 0–31, EVs 0–252 y total máximo 510 en los perfiles clásicos; Champions fija nivel 50/IVs 31 y limita los SP a 32/66. Se comprueban también sexo, especie, habilidad, objeto, naturaleza y movimientos. Cambiar las mecánicas reconsulta y revalida todos los Pokémon: si alguno es incompatible se conservan el perfil y equipos anteriores.

La conversión clásica → Champions usa `floor((EV + 4) / 8)`, establece nivel 50 e IVs 31, y conserva el porcentaje de PS. La conversión inversa usa `SP = 0 ? EV = 0 : EV = 8 × SP − 4`. Si un reparto de 66 SP no cabe en los 510 EVs clásicos, se rechaza el cambio sin recortar ni alterar el reparto guardado.

## Mis configuraciones

- **Perfil de importación / destino** filtra tanto Mis Pokémon como Mis equipos: solo muestra configuraciones guardadas con ese perfil, incluyendo la distinción entre generación IX y Locke. Los contadores indican el total guardado del perfil elegido; la búsqueda filtra dentro de ese conjunto. Cambiar de LAB actualiza el filtro según su mecánica. Los datos de los demás perfiles permanecen guardados y vuelven a aparecer al seleccionarlos.
- Dos apartados: **Mis Pokémon**, ordenado alfabéticamente por especie y después por nombre de configuración; **Mis equipos**, ordenado por el nombre elegido al guardarlo. Se mantienen los Pokémon guardados anteriormente.
- En **Mis equipos** puedes buscar por nombre o integrantes, renombrar, eliminar con confirmación y exportar el equipo completo con copia Showdown o descarga voluntaria `.txt`. **Cargar** usa el destino elegido; si tiene Pokémon, pide confirmar el reemplazo. Convierte y valida todos los integrantes antes de cambiar el destino, conservando las seis posiciones del equipo guardado. La importación `.txt` en este apartado guarda un equipo por archivo y toma su nombre del archivo.
- En el editor, indica un nombre opcional y pulsa **Guardar configuración**. Se guarda una copia independiente en la biblioteca local, sin descargar archivos. También puedes guardar un Pokémon seleccionado con **Guardar configuración**. Pulsa **Exportar** en su fila para consultar el texto Pokémon Showdown, copiarlo al portapapeles o descargarlo en `.txt`, con el mismo diálogo que los equipos. Se usa el perfil guardado de la configuración, incluido Champions.
- Al guardar desde la barra inferior del constructor, un aviso flotante confirma **Configuración guardada** con el nombre y destino **Mis Pokémon**, visible aunque estés al final de la página. Se cierra automáticamente a los seis segundos o con su botón de cierre; repetir el guardado renueva el aviso. Si el almacenamiento falla, muestra un error y conserva los datos anteriores.
- Abre **Mis configuraciones** en el menú lateral. La tabla prioriza los seis valores EVs/SP, naturaleza y movimientos, e incluye nombre del build, Pokémon, nivel, sexo, variocolor, perfil, IVs, habilidad y objeto. Puedes buscar, renombrar y eliminar los builds; la eliminación requiere confirmar su nombre y conserva los Pokémon ya añadidos a equipos.
- Junto al sprite de cada Pokémon se muestra la imagen del objeto equipado, también en el editor y calculadora. Se consulta el recurso de [objetos de PokéAPI](https://pokeapi.co/docs/v2#items) con la misma caché local; para objetos recientes sin imagen en la API se usa su [repositorio de sprites](https://github.com/PokeAPI/sprites/tree/master/sprites/items/gen9). Si la imagen no está disponible, aparece un icono con el nombre del objeto.
- Selecciona **LAB de implementación**, equipo de destino y perfil, y pulsa **Añadir** en una fila: usa la primera plaza libre, convierte al perfil de ese LAB si es necesario y vuelve a validar. El selector de perfil modifica solo el LAB elegido; los demás conservan equipos y mecánicas. Cargar un equipo guardado usa ese mismo destino y su confirmación identifica el LAB. Si falla, el equipo no cambia. Se desactiva el botón cuando el equipo está lleno. El título Mis configuraciones no muestra contador; los contadores permanecen en Mis Pokémon y Mis equipos.
- **Importar .txt** admite hasta seis configuraciones de Showdown por archivo (máximo 30 KB). Usa el selector de mecánicas de la biblioteca para indicar el perfil de importación. Todos los Pokémon se validan antes de guardar el archivo en la biblioteca; no se modifican los equipos al importar aquí.
- En los archivos Champions se escriben los SP 0–32 directamente en la línea estándar `EVs:`. El nombre del archivo indica `champions`; vuelve a importarlo con ese perfil seleccionado. No se multiplican los valores durante la exportación.
- Biblioteca de Pokémon: `pokemon-team-lab:configurations:v1`. Biblioteca de equipos: `pokemon-team-lab:teams:v1`. Tema: `pokemon-team-lab:theme`. Constructor: `pokemon-team-lab:v1`; los guardados anteriores siguen siendo compatibles. Las copias conservan el perfil y PS actuales, no se modifican al editar o limpiar el constructor, y se deduplican por nombre, perfil y configuración completa. Los archivos descargados no se escanean automáticamente: la tabla reúne los builds guardados en este navegador y los archivos que importes.
- La biblioteca conserva PS actuales, mientras Showdown `.txt` los restaura al 100 %. Exporta tus configuraciones antes de borrar los datos del navegador.

Las formas dependen de los recursos disponibles en PokéAPI y en la versión instalada del motor. Las formas sin movimientos para la generación elegida no se pueden guardar, salvo en Locke, que usa el catálogo global IX. La aplicación muestra errores de red y de almacenamiento y no sobrescribe un guardado corrupto al iniciarse. Exporta una copia antes de eliminar datos del navegador.

## Copia de seguridad completa

- Abre **Copia de seguridad** en el menú lateral (también disponible en móvil) y pulsa **Exportar copia completa**. Descarga un `.json` con todas las claves locales de la app: constructor, Mis equipos, Mis Pokémon, perfiles, PS actuales, preferencias, caché de PokéAPI y otras claves propias. No incluye datos de otras aplicaciones del mismo origen. Se leen los valores actuales del navegador al exportar; no se necesita conexión ni cuenta.
- **Importar copia completa** acepta ese formato `.json` hasta 20 MB. Comprueba formato/versión, claves únicas y propias, tema, equipos, bibliotecas y datos de Pokémon antes de modificar nada. Después muestra el archivo, fecha, cantidades y tamaño aproximado. **Cancelar** conserva el estado actual; **Reemplazar datos y restaurar** confirma la sustitución completa. Puedes descargar una copia actual desde esa revisión.
- La restauración conserva exactamente los registros importados, incluyendo nombres, ID, plazas vacías, perfiles y porcentaje de PS. El constructor, bibliotecas y tema se actualizan sin recargar. Los registros propios ausentes en el archivo se eliminan; los datos ajenos quedan intactos. Los `.txt` de Showdown se siguen importando desde sus apartados habituales.
- Si una escritura falla (por cuota o bloqueo), se intenta recuperar íntegramente el almacenamiento anterior. Si el navegador bloquea también esa recuperación, se mantiene una copia del estado previo en memoria con el botón **Descargar copia de recuperación**, disponible incluso al cambiar de sección; descárgala antes de cerrar la página. Los valores corruptos también pueden exportarse para recuperación manual, aunque no se aceptan como una restauración válida.
- Formato: `pokemon-team-lab-backup`, versión 1; `entries` conserva pares clave/valor de `pokemon-team-lab:*` y `ptl-api:*`. Los nombres de archivo incluyen fecha UTC. Al restaurar se reinicia la caché en memoria, y las peticiones anteriores no sobrescriben la caché importada.

## Calculadora de tipos

- Abre **Calculadora de tipos** en el lateral, también disponible en móvil. Dos modos independientes: **Cobertura de ataque** permite elegir los 18 tipos; **Cobertura defensiva** limita a dos y permite desmarcarlos. Cambiar de modo conserva su selección durante la visita; **Limpiar selección** reinicia los tipos y efectos del modo activo.
- La tabla IX del motor agrupa los 18 tipos por multiplicador. En ataque muestra el mejor ataque contra cada tipo defensor individual; en defensa multiplica las resistencias/debilidades de los tipos elegidos. Selección vacía: 1×. Sin sección Pokédex ni selector de teratipo.
- En ataque, multiplicadores superiores a 1× aparecen en verde y resistencias/inmunidades en rojo. En defensa, las debilidades aparecen en rojo y resistencias/inmunidades en verde.
- Ataque: Liofilización, Mil Flechas y Plancha Voladora, más Cromolente e Intrépido. Los movimientos especiales se pueden usar sin seleccionar su tipo; al activar ambas habilidades se aplican sus dos efectos a los ataques elegidos.
- Defensa: selector de habilidades que afectan a tipos/daño, incluidas inmunidades, Sebo, Filtro, Superguarda, Ráfaga Delta y Teraparazón. Ráfaga Delta asume su clima activo y solo anula las debilidades de Volador; Teraparazón incluye un control de PS al máximo. Los resultados muestran también multiplicadores como 1,5×/3× o 1,25×/2,5×.
- Cálculo local sin red, STAB, potencia ni otros efectos de combate. Colores e iconos por tipo, disposición adaptable y carga separada del constructor. Inspirada en [PKMN.help](https://www.pkmn.help/defense/solo/), con implementación propia y tabla nativa Smogon.

## MiniWiki

- Los resultados no muestran la cabecera de columnas. Habilidades y objetos presentan el nombre a la izquierda y su descripción a la derecha.
- Abre **MiniWiki** en el menú lateral. El selector superior permite consultar generaciones I–IX o Champions sin alterar las mecánicas del constructor. Recuerda la selección al cambiar de sección durante la sesión.
- El buscador mezcla Pokémon, habilidades, movimientos y objetos en filas como la referencia de Smogon; busca nombres en español o inglés sin distinguir acentos, tipos, categorías y efectos. Puedes filtrar una categoría, abrir la ficha pulsando el nombre y consultar una habilidad desde un Pokémon. **Mostrar más resultados** recorre el catálogo completo en grupos de 40.
- Pokémon: tipos y stats base nativos del perfil, habilidades normales y ocultas históricas y sprites cuando están disponibles. En I–II no hay habilidades; las ocultas aparecen desde V. La generación I muestra su estadística Especial única. Por ejemplo, Gengar pasa de Levitate a Cursed Body y Rotom-Heat cambia de Eléctrico/Fantasma a Eléctrico/Fuego según la generación.
- Movimientos: tipo coloreado, icono físico/especial/estado, potencia, acierto, PP y prioridad. Las generaciones clásicas muestran **PP base**, con el máximo tras PP Más en el tooltip; Champions muestra sus PP de combate. Las descripciones breves y ampliadas usan el texto técnico inglés de Showdown para el perfil. Los efectos secundarios con datos estructurados se añaden en español, con porcentaje, estado o cambios de estadísticas y objetivo/usuario, incluyendo cambios de Champions.
- Habilidades y objetos: nombres españoles cuando hay traducción en PokéAPI y descripciones técnicas históricas de Showdown. La ficha amplía el texto breve. Champions incorpora sus textos específicos (como Healer al 50 %) y los datos de sus modificaciones; Run Away incorpora su efecto de evitar atrapamiento.
- El [catálogo local](src/data/README.md) usa el motor instalado y datos de Showdown/PokéAPI. No consulta la API ni escribe localStorage para buscar; las imágenes son opcionales y requieren red o caché del navegador. Se carga al abrir MiniWiki para no añadir todo el catálogo a la carga inicial del constructor. `npm run update:wiki` regenera los datos con red; el build normal funciona con el snapshot versionado.
- Se excluyen contenidos CAP, personalizados y futuros. Los contenidos retirados aparecen como **Histórico**; se consulta el perfil de mecánicas sin asegurar legalidad de un reglamento de temporada.

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
| `src/coverage.ts`              | Cobertura defensiva por tipos, perfil y previsualización de megaevoluciones             |
| `src/DefensiveCoverage.tsx`    | Tabla de multiplicadores, integrantes y totales                                         |
| `src/teams.css`                | Biblioteca de equipos, cobertura y efectos de combate en dos columnas                   |
| `src/team-features.test.ts`    | Copias de equipos, tablas históricas y daño real con Velo Aurora/Refuerzo               |
| `src/coverage-ui.test.tsx`     | Megaevolución en cobertura, reversión, cambios de piedra/perfil e imágenes sin red      |
| `src/library.ts`               | Persistencia de configuraciones, deduplicación y descargas                              |
| `src/storage.ts`               | Prioridad de guardados, recuperación ante cuota y caché de API acotada                  |
| `src/storage.test.ts`          | Cuota realista, protección de datos anteriores y límites de caché                       |
| `src/theme.css`                | Paleta Pokémon, temas claro/oscuro y estilos de biblioteca                              |
| `src/champions.test.ts`        | Fórmula Champions, límites, conversiones, naturalezas y biblioteca                      |
| `src/mega.test.ts`             | Piedras y formas mega, estadísticas, daño, velocidad y conservación de la configuración |
| `src/MovePicker.tsx`           | Selector accesible por filas y fichas de movimientos con iconos                         |
| `src/moves.ts`                 | Datos de movimiento por perfil, precisión, PP y prioridades históricas                  |
| `src/moves.css`                | Selector adaptable, tipos y datos ampliados de la calculadora                           |
| `src/moves.test.ts`            | Datos históricos, PP Champions, prioridades y cambios de EVs/SP                         |
| `scripts/update-moves.mjs`     | Generación del catálogo local desde datos públicos de PokéAPI y Showdown                |
| `src/BackupView.tsx`           | Exportación/importación completa desde el menú, resumen y confirmación                  |
| `src/backup.ts`                | Formato JSON, validación, restauración y recuperación ante fallos                       |
| `src/backup.test.ts`           | Portabilidad, protección de claves ajenas, cuota y recuperación                         |
| `src/backup.css`               | Pantalla de copias adaptable y acceso lateral en móvil                                  |
| `src/TypeCalculator.tsx`       | Calculadora independiente de cobertura ofensiva y defensiva                             |
| `src/type-calculator.ts`       | Tabla IX, movimientos especiales, habilidades y agrupación por multiplicador            |
| `src/types.css`                | Tipos con iconos, selecciones y resultados adaptables a ambos temas                     |
| `src/type-calculator.test.ts`  | Inmunidades, mejores ataques, tipos dobles y efectos especiales                         |
| `src/locke.test.ts`            | Perfil libre, validación, Showdown, bibliotecas, copia y motor IX                       |
| `src/labs.ts`                  | LABs independientes, límite de cinco, migración y persistencia del constructor          |
| `src/labs.test.ts`             | Migración, independencia, límites, restauración y copias de todos los LABs              |

React + TypeScript + Vite, CSS propio, Lucide y Vitest. El código se formatea con Prettier.

## Validación

La implementación se verifica con compilación de producción, pruebas de importación/exportación, legalidad, PS, cálculos reales de Smogon, las nueve generaciones, prioridades/velocidad y flujos de interfaz. Se prueban selección por tarjeta, copia/descarga de configuraciones y megaevoluciones por piedra, con retorno a la forma base sin alterar equipos. La prueba de integración consulta una especie de cada generación, el ejemplo Torkoal, habilidades/tipos históricos de Gengar y Clefairy, imágenes de objetos y sprites de Charizard Mega X/Y. El servidor local se comprueba mediante HTTP.

La revisión visual en un navegador real no pudo realizarse: no había ningún navegador conectado disponible en el entorno de desarrollo. jsdom verifica comportamiento y accesibilidad consultable, pero no el diseño visual ni el comportamiento nativo de los diálogos.

MiniWiki se implementa en `src/MiniWiki.tsx`, `src/wiki.ts` y `src/wiki.css`, con datos versionados en `src/data/wiki.json`. `scripts/update-wiki.mjs` regenera el catálogo; `src/wiki.test.ts` comprueba generaciones, habilidades ocultas, efectos y PP, y `src/wiki-ui.test.tsx` prueba búsquedas mixtas, filtros y fichas. El flujo integrado también verifica que consultar un perfil distinto no modifica el constructor.

## Referencias

- [PokéAPI: documentación](https://pokeapi.co/docs/v2)
- [Smogon Damage Calculator: código y API](https://github.com/smogon/damage-calc)
- [PKMN.help: referencia de calculadora de tipos](https://www.pkmn.help/defense/solo/)
- [Calculadora de referencia](https://calc.pokemonshowdown.com/)
- [Pokémon Champions: información oficial](https://champions.pokemon.com/en-us/pokemon/)
- Las piedras, formas y estadísticas mega se resuelven con [los datos del motor Smogon](https://github.com/smogon/damage-calc/blob/master/calc/src/data/items.ts). Solo se ofrece el control si la piedra y forma existen en el perfil elegido y son compatibles con la especie; se respeta el catálogo del motor sin afirmar legalidad de reglamentos de temporada.

Pokémon y los diseños de sus personajes pertenecen a sus respectivos titulares. Proyecto independiente, sin afiliación oficial.
