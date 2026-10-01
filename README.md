# LINUX//QUEST

Un videojuego educativo 3D para aprender Linux. Despertás en una estación de datos futurista que es una representación visual de un sistema Linux: caminás en primera persona, encontrás problemas (una puerta con `ACCESS DENIED`, un servicio caído…) y los resolvés escribiendo comandos en una **terminal simulada**. Aprendés porque *necesitás* Linux para avanzar.

> Nada de lo que escribís se ejecuta en tu máquina: la terminal, el filesystem, los usuarios y los procesos son una simulación 100 % en memoria.

## Estado: Milestone 1 (vertical slice)

- Escenario 3D modular (Sector 01 + Sector 02 sellado), primera persona (WASD, mouse, Shift, E, ESC).
- Terminal simulada con filesystem virtual, parser (comillas, `$VAR`, `~`, pipes, `;`, `&&`, `||`, `<`, `>`, `>>`, `2>`), códigos de salida y errores estilo bash.
- Comandos: `pwd ls cd mkdir touch cat echo clear whoami hostname help` (+ `--help`, autocompletado con Tab, historial).
- Misión **The Locked Sector** (9 objetivos, dificultad Tutorial): hints progresivos, explicación de errores ("coach"), lecciones al cumplir objetivos.
- XP, niveles con título, Codex de comandos, conceptos aprendidos, minimapa con áreas por descubrir.
- Feedback visual y sonoro al completar: puerta que se abre, cambio de iluminación, data lines, sonidos sintetizados.
- Persistencia en `localStorage` (filesystem, misión, progreso, flags del mundo, historial).
- 56 tests (parser, filesystem, comandos, misiones, progresión, autocompletado).

## Ejecutar

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests de la lógica (sin renderizar nada)
npm run typecheck
npm run build      # genera dist/
```

Controles: `WASD` moverse · `Mouse` mirar · `Shift` correr · `E` interactuar · `C` Codex · `M` silenciar · `ESC` cerrar terminal / pausa.
Agregá `?debug` a la URL para exponer `window.__game` (teleport, estado) — útil para pruebas end-to-end.
En la terminal: `help`, `hint`, `quest`, `game reset --yes` (borra el progreso).

## Stack

TypeScript estricto · Three.js · Vite · HTML/CSS superpuesto al canvas · Vitest. Sin React ni assets externos: toda la geometría, texturas y sonidos son procedurales.

## Arquitectura

La regla central: **la lógica de Linux y del juego no conoce a Three.js ni al DOM**. Por eso todo lo que está arriba de la línea se testea en Node.

```
src/
├─ filesystem/   VirtualFileSystem (árbol en memoria, errores POSIX-like, snapshots), FsSpec declarativo
├─ commands/     Command (interfaz), un archivo por grupo de comandos, CommandRegistry, CommandEngine
├─ terminal/     parser (tokenizer → AST), TerminalSystem (línea → engine → líneas de salida), coach, completion
├─ quests/       tipos de misión (datos), conditions (checks declarativos), QuestSystem
├─ progression/  XP/niveles, conceptos, descubrimientos; reglas por dificultad
├─ game/         GameSession (compone todo lo anterior + persistencia + eventos)  ← frontera "sin render"
│                Game (une la sesión con Three.js, input, audio, UI), InteractionSystem
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
├─ world/        SceneManager, ZoneBuilder (ZoneDef → Three.js), props, collision, materiales procedurales
├─ player/       PlayerController (primera persona + colisión por tiles)
├─ core/         EventBus tipado, InputManager (teclado, mouse, pointer lock)
├─ audio/        AudioManager (Web Audio) + recetas de sonidos sintetizados
├─ ui/           HUD, TerminalUI, CodexUI, Minimap, Overlays (HTML/CSS)
├─ data/         TODO el contenido: quests/, commands/ (codex), levels/, world/ (zonas + filesystem base)
└─ utils/        math, ansi, storage
tests/           parser, filesystem, comandos, misiones, progresión, completion
```

### Flujo de un comando

```
TerminalUI → GameSession.runCommand(line)
  → TerminalSystem.submit      (meta-comandos del juego: hint/quest/game, o…)
  → CommandEngine.run          (parse → pipelines → redirecciones → Command.execute)
  → coach                      (explica el error según la dificultad)
  → QuestSystem.evaluate       (objetivos cumplidos? misión completa?)
  → ProgressionSystem          (XP, Codex, conceptos)
  → EventBus                   ('flag-set', 'quest-complete', 'sound', …)
Game escucha el bus → luces/puertas (ZoneBuilder.syncFlags), sonido, HUD, banners.
```

El mundo 3D es una **función de los flags** (`sector02.unlocked`, …): las misiones solo activan flags y el mundo reacciona. Así los comandos tienen consecuencias visibles sin acoplar la lógica de Linux al render.

### Decisiones importantes

- **Misiones como datos** (`src/data/quests/*.ts`): filesystem inicial, comandos permitidos, objetivos con condiciones declarativas, hints, recompensas, eventos al completar. Un test recorre *todas* las misiones y ejecuta su `solution` para garantizar que son resolubles — escala a cientos.
- **Condiciones latcheadas por objetivo**: cada objetivo se acredita cuando se cumple (en cualquier orden) y queda acreditado; el HUD muestra el primero pendiente.
- **Dificultad = reglas** (`progression/difficulty.ts`): cuántas pistas, cuánto explica el coach, si hay sugerencias. Tutorial guía; Expert no da pistas ni explicaciones.
- **Comandos permitidos por misión**: un comando que existe pero aún no es parte del kit responde como `command not found` (con explicación del coach), manteniendo el mundo coherente.
- **Zonas como datos** (`src/data/world/`): un layout ASCII + leyenda; `ZoneBuilder` genera geometría instanciada (muros, pisos, trims), props, colisión e interactuables. Una sola ruta de render para todo.
- **Rendimiento**: `InstancedMesh` para arquitectura, 4 luces puntuales, sin sombras dinámicas (luz emisiva + trims), texturas de 256 px generadas por canvas, pixel ratio ≤ 2.
- **Contenido**: la voz del sistema (banners, archivos) está en inglés; el coach, hints y lecciones (ARIA) en español rioplatense. Todo vive en `data/`, así que se puede localizar después.

## Cómo agregar un comando

1. Creá el comando (en un archivo de `src/commands/` o uno nuevo):

   ```ts
   export const head: Command = {
     name: 'head',
     description: 'Print the first lines of a file',
     usage: 'head [-n N] [file...]',
     execute(ctx, args) {
       // ctx.fs, ctx.state (cwd, vars), ctx.stdin, ctx.resolve(path), ctx.piped
       return ok('...\n');            // o fail('head: x: No such file...', 'ENOENT')
     },
   };
   ```
   Helpers en `commands/util.ts`: `ok`, `fail`, `parseFlags`, `invalidOption`, `fsMessage`.
2. Registralo en `ALL_COMMANDS` (`src/commands/index.ts`). Ya funciona con pipes, redirecciones, `--help`, `help` y Tab.
3. Agregá su entrada al Codex en `src/data/commands/codex.ts` (se desbloquea al usarlo con éxito).
4. Agregalo a `allowedCommands` de las misiones donde corresponda y escribí un test en `tests/commands.test.ts`.

## Cómo agregar una misión

1. Creá `src/data/quests/02-mi-mision.ts` exportando un `QuestDefinition` (mirá `01-locked-sector.ts`): `world` (filesystem inicial y `cwd`), `allowedCommands`, `objectives` (cada uno con `condition`, `hints`, `lesson`), `solution`, `reward`, `concepts`, `introduces`, `onComplete`.
2. Agregala a `QUESTS` en `src/data/quests/index.ts` (el orden es el de la historia; `requires` permite dependencias).
3. Si necesitás un check nuevo, sumá una variante a `Condition` (`quests/types.ts`) y su caso en `quests/conditions.ts`.
4. `npm test`: el test de soluciones verifica que tu misión se pueda completar con la `solution` que declaraste.

Eventos disponibles en `onComplete`: `setFlag` (cambia el mundo), `sound`, `notify`.

## Cómo agregar una nueva zona

1. Creá `src/data/world/mi-zona.ts` exportando un `ZoneDef`: `layout` ASCII (`#` pared, `.` piso, `@` spawn, `R/r` rack, `C` caja, más los caracteres que definas en `objects`), `tiles`, `objects` (puertas, terminales, NPCs, hologramas), `regions` (con `poweredByFlag` opcional), `lights` y `dataLines` reaccionando a flags.
2. Cargala en `Game` (`sceneManager.loadZone(...)`). Hoy el juego carga una sola zona; el cambio entre zonas es el siguiente paso natural.
3. Una puerta se abre sola cuando su `unlockFlag` aparece; un terminal/NPC nuevo solo requiere su entrada en `objects`. Para un tipo de objeto nuevo, agregá su `create…` en `world/props.ts`.

## Próximos pasos sugeridos

1. **Sector 02 (Nivel 2)**: `rm cp mv head tail less`, archivos ocultos, y una misión de reorganización de directorios.
2. **Cambio de zona** y guardado de la posición del jugador.
3. **Nivel 3–4**: `grep find sort uniq wc cut` + pipes (el parser ya soporta `|`, `>`, `>>`, `<`, `2>`; faltan `2>&1` y globs `*`).
4. **Permisos** (`chmod chown sudo`): el filesystem ya guarda `mode/owner/group`, falta aplicarlos en `VirtualFileSystem` según el usuario del shell.
5. **Procesos y servicios**: agregar `ProcessTable` y `ServiceManager` a `GameSession` (mismo patrón: estado puro + eventos al bus + flags para el mundo).
6. Audio real (reemplazar recetas en `audio/sounds.ts` por samples), logros, perfil de jugador.
