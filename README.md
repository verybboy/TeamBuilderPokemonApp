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

1. Elige la generación y añade un Pokémon en una plaza vacía. Los nombres de especies, habilidades, objetos y movimientos se usan en inglés para mantener compatibilidad con Showdown.
2. Carga la especie y configura sus movimientos, habilidad, naturaleza, objeto, nivel, sexo, variocolor, IVs, EVs y PS. Valores iniciales: nivel 50, IVs 31, EVs 0 y PS al 100 %. El porcentaje de PS se conserva al cambiar características.
3. Marca una plaza para añadir/editar o borrar. Marca exactamente dos plazas ocupadas de equipos diferentes para enfrentar Pokémon.
4. La calculadora muestra los cuatro movimientos de ambos Pokémon y recalcula al configurar clima, terreno, pantallas, estados, boosts, críticos, singles/dobles y Espacio Raro. Incluye Viento Afín y activación de efectos condicionales de habilidades.
5. Importa hasta seis Pokémon de Showdown en el equipo elegido. Por defecto se rellenan plazas libres; reemplazar el equipo requiere marcar la opción correspondiente. Todas las entradas se validan antes de modificar los equipos.
6. Exporta cualquiera de los equipos a texto, portapapeles o archivo `.txt`. Con los equipos vacíos, «Cargar ejemplo» prepara un enfrentamiento de sol y lluvia con datos de PokéAPI.

## Datos y mecánicas

- **Perfil acordado con Mario:** generaciones I–IX con IVs/EVs como Showdown y nivel 50 por defecto. No se aplica la distribución de Stat Points ni la lista exclusiva de especies/objetos de Champions.
- **PokéAPI** aporta los detalles de cada especie, movimientos aprendibles por generación, habilidades actuales e históricas, sexo y sprites. Sus respuestas se guardan en una caché local de siete días y se deduplican las peticiones simultáneas.
- **`@smogon/calc`** aporta los datos históricos del combate y la fórmula real de daño de cada generación. El catálogo del editor se cruza con los nombres compatibles con este motor. No se permite asignar movimientos o habilidades de otra especie.
- En generaciones I–II el motor usa DVs derivados de los IVs, calcula los DVs de PS a partir de las otras características y asume entrenamiento máximo. Los campos de EVs, naturaleza y habilidad se desactivan. Clima, terrenos, dobles y Espacio Raro se habilitan según su generación.
- El orden de ataque usa prioridades, Prankster, Gale Wings y Triage; velocidad efectiva del motor con boosts, estados, objetos, clima y Viento Afín; Espacio Raro; Stall, Mycelium Might y objetos que alteran el orden. Indica Speed Tie y advierte de las activaciones aleatorias de Quick Claw / Quick Draw.
- El cálculo es de un ataque aislado, no un simulador completo de turnos. No aplica automáticamente el clima de Drought/Drizzle: configura el campo. Los estados pueden impedir actuar; el orden mostrado presupone que ambos pueden hacerlo.

## Guardado y formato Showdown

Se guardan ambos equipos y la generación en `localStorage`, bajo `pokemon-team-lab:v1`, incluyendo las fichas consultadas para poder restaurarlos sin red. Los equipos pertenecen al navegador y origen donde se usan. No hay backend ni cuentas.

La importación soporta especie, mote, sexo, objeto, `Ability`, `Level`, `Shiny`, `EVs`, `IVs`, naturaleza y hasta cuatro movimientos, con una línea en blanco entre Pokémon. Los campos adicionales (por ejemplo, `Tera Type`, `Happiness` y cabeceras de cajas) se rechazan con un error explícito. Showdown no conserva los PS actuales; las importaciones empiezan al 100 %.

Se comprueban nivel 1–100, IVs 0–31, EVs 0–252 y total máximo 510, sexo, especie, habilidad, objeto, naturaleza y movimientos. Cambiar la generación reconsulta y revalida todos los Pokémon: si alguno es incompatible se conservan la generación y equipos anteriores.

Las formas dependen de los recursos disponibles en PokéAPI y en la versión instalada del motor. Las formas sin movimientos para la generación elegida no se pueden guardar. La aplicación muestra errores de red y de almacenamiento y no sobrescribe un guardado corrupto al iniciarse. Exporta una copia antes de eliminar datos del navegador.

## Estructura

| Archivo              | Responsabilidad                                        |
| -------------------- | ------------------------------------------------------ |
| `src/App.tsx`        | Equipos, selección, persistencia y coordinación        |
| `src/components.tsx` | Editor, importación/exportación y diálogos accesibles  |
| `src/Calculator.tsx` | Configuración del combate y resultados bidireccionales |
| `src/model.ts`       | Modelo, validaciones y adaptador de Pokémon al motor   |
| `src/api.ts`         | PokéAPI, caché, formas y datos históricos              |
| `src/showdown.ts`    | Importador y exportador de Showdown                    |
| `src/battle.ts`      | Daño, campo y orden de ataque                          |
| `src/styles.css`     | Diseño adaptable para escritorio y móvil               |
| `src/core.test.ts`   | Reglas e integración con el motor real                 |
| `src/ui.test.tsx`    | Flujos completos con React y jsdom                     |
| `src/live.test.ts`   | Integración opcional con PokéAPI real                  |

React + TypeScript + Vite, CSS propio, Lucide y Vitest. El código se formatea con Prettier.

## Validación

La implementación se verifica con compilación de producción, pruebas de importación/exportación, legalidad, PS, cálculos reales de Smogon, las nueve generaciones, prioridades/velocidad y flujos de interfaz. La prueba de integración consulta una especie de cada generación, el ejemplo Torkoal y habilidades/tipos históricos de Gengar y Clefairy. El servidor local se comprueba mediante HTTP.

La revisión visual en un navegador real no pudo realizarse: no había ningún navegador conectado disponible en el entorno de desarrollo. jsdom verifica comportamiento y accesibilidad consultable, pero no el diseño visual ni el comportamiento nativo de los diálogos.

## Referencias

- [PokéAPI: documentación](https://pokeapi.co/docs/v2)
- [Smogon Damage Calculator: código y API](https://github.com/smogon/damage-calc)
- [Calculadora de referencia](https://calc.pokemonshowdown.com/)
- [Pokémon Champions: información oficial](https://champions.pokemon.com/en-us/pokemon/)

Pokémon y los diseños de sus personajes pertenecen a sus respectivos titulares. Proyecto independiente, sin afiliación oficial.
