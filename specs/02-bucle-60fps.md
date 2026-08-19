# SPEC 02 — Bucle a paso fijo: velocidad estable a 60 ticks/s

> **Status:** Borrador
> **Depends on:** ninguna
> **Date:** 2026-08-19
> **Objective:** Normalizar el bucle de juego a un paso fijo de 60 ticks/s para que la velocidad de Pac-Man, los fantasmas y los retardos de salida dejen de depender de la frecuencia del monitor.

## Por qué existe esta spec

El juego se percibe demasiado rápido: los fantasmas atrapan casi de inmediato. La causa raíz no son las constantes — `PACMAN_SPEED = 0.125` y `GHOST_SPEED = 0.1` (`src/js/game.js:13-14`) ya replican el arcade del nivel 1 a 60 fps. La causa es que `loop()` (`src/js/main.js:42-51`) ejecuta `update()` en cada `requestAnimationFrame` sin límite: en pantallas de 120 Hz todo corre al doble (Pac-Man a 15 celdas/s, retardos de salida comprimidos a 1/2/3 s). SPEC 01 ya registró este riesgo como preexistente; esta spec lo ataca.

## Alcance

**In:**

- `src/js/main.js`: bucle con acumulador de tiempo real — `update(game)` y `frame++` se ejecutan solo a 60 ticks/s; `draw()` sigue en cada `requestAnimationFrame`.
- Tope de `dt` (~100 ms) al reanudar desde una pestaña en segundo plano, para evitar ráfagas de ticks.
- La animación de la boca de Pac-Man (`Math.sin(frame * 0.3)` en `render.js`) queda a 60 Hz en cualquier monitor al mover `frame++` dentro del tick.

**Fuera de alcance (para futuras specs):**

- Cambiar `PACMAN_SPEED` o `GHOST_SPEED` — se mantienen en 0.125/0.1 (arcade nivel 1, fantasmas al 80% de Pac-Man).
- Migrar el motor a delta-time (velocidades en celdas/segundo).
- Aceleraciones futuras (Cruise Elroy, modo asustado, túnel lento).
- Pausa del juego o manejo más elaborado de pestaña oculta.

## Modelo de datos

```js
// src/js/main.js — constantes y estado del bucle (nuevo)
const TICK_MS = 1000 / 60;  // paso fijo: 60 ticks/s
let last = performance.now();
let acc = 0;
```

Nada más cambia: velocidades y temporizadores siguen expresados por frame (celdas/frame, `waitTimer` en frames), ahora garantizados a 60 fps.

## Plan de implementación

1. `src/js/main.js`: reescribir `loop()` con acumulador — en cada rAF calcular `dt = now − last` (tope ~100 ms), acumular y ejecutar `while (acc >= TICK_MS) { frame++; if (playing) update(game); acc -= TICK_MS; }`; los overlays de `won`/`lost` se revisan tras los ticks y `draw()` se llama una vez por rAF. Prueba manual: en 120 Hz el ritmo se siente a la mitad; pinky/inky/clyde salen a ~2/4/6 s reales; en 60 Hz no hay cambio apreciable.

## Criterios de aceptación

- [ ] En una pantalla de 60 Hz el ritmo y los retardos son idénticos a los actuales.
- [ ] En una pantalla de 120 Hz Pac-Man cruza el tablero de 28 casillas en ~3.7 s (~7.5 celdas/s), la mitad de rápido que hoy.
- [ ] Pinky, inky y clyde salen de la casa a ~2 s, ~4 s y ~6 s de tiempo real, al iniciar y tras cada muerte, en cualquier monitor.
- [ ] `update()` se ejecuta ~60 veces por segundo de reloj (verificable con un contador temporal en consola).
- [ ] Volver de una pestaña en segundo plano no produce saltos ni ráfagas perceptibles.
- [ ] Una partida completa no lanza errores en consola.

## Decisiones

- **Sí:** paso fijo de 60 ticks/s con acumulador — el motor completo está diseñado por frames (velocidades en celdas/frame, giros solo al alinear cada 8/10 frames, `waitTimer` en frames); el paso fijo lo conserva sin tocar `game.js`.
- **Sí:** mantener `PACMAN_SPEED = 0.125` y `GHOST_SPEED = 0.1` — valores del arcade nivel 1 a 60 fps, con fantasmas al 80% de Pac-Man (decisión confirmada).
- **Sí:** tope de `dt` de ~100 ms — sin él, al volver de una pestaña oculta habría una ráfaga de cientos de ticks y teletransportes.
- **Sí:** `frame++` dentro del tick — la animación queda ligada al ritmo del juego, no al del monitor.
- **No:** bajar las constantes — el diagnóstico apunta al bucle sin límite; además, al no conocerse el Hz de la pantalla, normalizar cubre todos los casos por igual.
- **No:** delta-time real (celdas/segundo) — rompería la lógica de alineación por frames enteros (`aligned()` en `game.js`); cambio mucho mayor sin beneficio aquí.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Pantallas por debajo de 60 Hz: varios ticks por rAF | Comportamiento aceptado: el ritmo se mantiene; solo se ve más entrecortado. |
| Deriva por redondeo del acumulador en coma flotante | Despreciable con `performance.now()` y el tope de `dt`. |

## Lo que **no** está en esta spec

- Cambiar valores de velocidad, delta-time, aceleraciones (Elroy/asustado/túnel lento), pausa. Cada uno, si llega, va en su propia spec.
