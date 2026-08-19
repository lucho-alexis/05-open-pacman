# SPEC 01 — Los cuatro fantasmas clásicos

> **Status:** Aprobado
> **Depends on:** ninguna
> **Date:** 2026-08-18
> **Objective:** Los 4 fantasmas (blinky, pinky, inky, clyde) salen escalonadamente de la casa y persiguen a Pac-Man cada uno con su personalidad clásica del arcade.

## Por qué existe esta spec

Hoy hay 2 fantasmas genéricos (`hunter` y `random` en `GHOST_STARTS`, `src/js/maze.js`). Esta spec los reemplaza por el elenco clásico de 4, cada uno con su propia forma de elegir objetivo, y añade la salida escalonada de la casa.

## Alcance

**In:**

- `GHOST_STARTS` pasa de 2 a 4 fantasmas con `kind` `blinky`/`pinky`/`inky`/`clyde`.
- Blinky arranca fuera de la casa, en (13,11); pinky, inky y clyde dentro de la casa.
- Salida escalonada por tiempo: retardo fijo por fantasma (0s, 2s, 4s, 6s).
- `decideGhost` (`src/js/game.js`) calcula el objetivo según el `kind`:
  - **blinky**: celda de Pac-Man (persecución agresiva directa).
  - **pinky**: 4 casillas delante de Pac-Man según su dirección (emboscada).
  - **inky**: punto simétrico de blinky respecto a 2 casillas delante de Pac-Man (flanqueo).
  - **clyde**: persigue a Pac-Man si está a >8 casillas (Manhattan); si está a ≤8, se dirige a su esquina (1,29).
- Al perder una vida, los 4 vuelven a sus posiciones iniciales y se repiten los retardos de salida.
- Reordenar `GHOST_COLORS` (`src/js/render.js`) para que cada color corresponda a su fantasma clásico.

**Fuera de alcance (para futuras specs):**

- Alternancia global scatter/chase.
- Power pellets y modo asustado (fantasmas comestibles).
- Aceleración de blinky tipo "Cruise Elroy".
- Rebote vertical de los fantasmas dentro de la casa mientras esperan.
- Colisión entre fantasmas (se atraviesan, como hoy).

## Modelo de datos

```js
// src/js/maze.js — GHOST_STARTS (antes 2 entradas)
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'blinky', exitDelay: 0 },   // fuera, sobre la puerta
  { x: 13, y: 14, kind: 'pinky',  exitDelay: 120 }, // 2s
  { x: 12, y: 14, kind: 'inky',   exitDelay: 240 }, // 4s
  { x: 15, y: 14, kind: 'clyde',  exitDelay: 360 }, // 6s
];

// src/js/game.js — cada fantasma en game.ghosts
{
  x, y, dir, speed, kind,
  state: 'waiting' | 'exiting' | 'active',
  waitTimer: exitDelay, // frames restantes para salir (~60 fps)
}

// src/js/game.js
const CLYDE_CORNER = { x: 1, y: 29 }; // esquina inferior izquierda (retirada de clyde)
```

Objetivos por `kind` (todos solo se usan para comparar distancias, pueden quedar fuera del tablero):

- blinky: `(round(p.x), round(p.y))`
- pinky: `pacman + 4 · DIRS[pacman.dir]`
- inky: `2 · (pacman + 2 · DIRS[pacman.dir]) − blinky`
- clyde: `pacman` si `manhattan(clyde, pacman) > 8`, si no `CLYDE_CORNER`

## Plan de implementación

1. `src/js/maze.js`: reemplazar `GHOST_STARTS` por las 4 entradas con `kind` y `exitDelay`. Prueba manual: se ven 4 fantasmas (colores aún por índice; blinky usa la lógica `hunter` vieja, el resto aleatoria).
2. `src/js/game.js`: en `createGame` inicializar `state` y `waitTimer` por fantasma; en `update` gestionar `waiting` (decrementa `waitTimer`) → `exiting` (moverse por los waypoints (13,14) → (13,11) a velocidad normal, atravesando la puerta) → `active`. `moveGhost` solo mueve fantasmas `exiting`/`active`. `resetPositions` re-arma posiciones, `state` y `waitTimer`. Prueba manual: salen escalonados sin atravesar paredes.
3. `src/js/game.js`: reescribir `decideGhost` con el objetivo por `kind` (elección greedy sin reversa, igual que el `hunter` actual) y añadir `CLYDE_CORNER`. Prueba manual: cada fantasma muestra su personalidad.
4. `src/js/render.js`: reordenar `GHOST_COLORS` a rojo, rosa, cian, naranja (blinky, pinky, inky, clyde). Prueba manual: colores correctos por fantasma.

## Criterios de aceptación

- [ ] Al iniciar hay 4 fantasmas: rojo en (13,11) fuera de la casa; rosa, cian y naranja dentro.
- [ ] Pinky, inky y clyde salen de la casa ~2s, ~4s y ~6s después de iniciar y tras cada muerte.
- [ ] Los fantasmas dentro esperan quietos; cruzan la puerta solo al salir.
- [ ] Ningún fantasma atraviesa paredes (solo puerta y túnel de la fila 14).
- [ ] Blinky toma siempre la dirección (sin reversa) que minimiza distancia Manhattan a la celda de Pac-Man.
- [ ] Pinky se adelanta a la trayectoria de Pac-Man (apunta 4 casillas delante).
- [ ] Inky flanquea: su rumbo se desvía según la posición de blinky.
- [ ] Clyde huye hacia (1,29) cuando Pac-Man está a ≤8 casillas y persigue cuando está más lejos.
- [ ] Perder una vida reinicia posiciones y retardos (0/2/4/6s) y el juego continúa igual.
- [ ] Una partida completa no lanza errores en consola.

## Decisiones

- **Sí:** personalidades clásicas del arcade (blinky/pinky/inky/clyde). El laberinto ya es fiel al nivel 1.
- **Sí:** salida escalonada por tiempo (0/120/240/360 frames). Simple y con ritmo de arcade.
- **Sí:** blinky arranca fuera de la casa (13,11) y activo desde el frame 0.
- **Sí:** reordenar `GHOST_COLORS`; hoy el orden daría rosa a inky y cian a pinky.
- **No:** alternancia scatter/chase global — merece su propia spec.
- **No:** power pellets y modo asustado — feature grande, otra spec.
- **No:** "Cruise Elroy" (blinky acelera con pocos dots) — velocidad uniforme `GHOST_SPEED`.
- **No:** replicar el bug del arcade en el objetivo de pinky (dirección up invertida) — simplificación consciente.
- **No:** rebote vertical en la casa ni desempate de dirección del arcade (up>left>down>right) — se mantiene el orden de `DIRS` existente como desempate.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `requestAnimationFrame` a 120Hz dobla la velocidad de todo (incluidos los retardos) | Preexistente en el juego; fuera de alcance de esta spec. |
| Fantasmas solapados en la misma celda | Preexistente y solo cosmético; registrado como fuera de alcance. |

## Lo que **no** está en esta spec

- Scatter/chase global, power pellets, modo asustado, "Cruise Elroy", animación de espera en la casa, colisión entre fantasmas. Cada uno, si llega, va en su propia spec.
