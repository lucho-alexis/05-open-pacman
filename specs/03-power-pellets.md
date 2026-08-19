# SPEC 03 — Power pellets y modo asustado

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-08-19
> **Objective:** Las 4 power pellets de las esquinas asustan a los fantasmas durante ~6 s (azules, lentos y aleatorios, con reversa inicial), permitiendo a Pac-Man comérselos por 200/400/800/1600 y convirtiéndolos en ojos que regresan a la casa para revivir.

## Por qué existe esta spec

SPEC 01 dejó explícitamente fuera "power pellets y modo asustado — feature grande, otra spec". Esta es esa spec. Hoy el laberinto no tiene pastillas (solo dots de 10 pts), la colisión con cualquier fantasma siempre quita vida (`src/js/game.js:253-263`), y los fantasmas solo conocen los estados `waiting`/`exiting`/`active`.

## Alcance

**In:**

- Tile nuevo `o` = power pellet (4) en `MAZE_STR` (`src/js/maze.js`), en las 4 posiciones clásicas: (1,3), (26,3), (1,23), (26,23).
- Comer una pastilla: +50 pts, cuenta para `dotsRemaining` (ganar exige comerlas) y activa el modo asustado: `frightTimer = 360` (~6 s a 60 tps), combo a 200, todos los fantasmas no-ojos con `frightened = true`, y los `active` invierten dirección.
- Fantasmas asustados: velocidad 0.05 (mitad) y dirección aleatoria sin reversa en cada intersección; callejón → reversa.
- Parpadeo azul↔blanco en los últimos ~2 s; al expirar vuelven a color, velocidad y persecución normales.
- Comer fantasma asustado: +200/400/800/1600 (duplica por fantasma dentro de la misma pastilla), popup con el puntaje ~1 s, y el fantasma pasa a `eyes`: solo ojos, velocidad 0.2 (doble), greedy hacia (13,11); al alinear baja por la puerta a (13,14), revive (`exiting`) y sale normal (no asustado). `eyes`/`entering` no colisionan con Pac-Man.
- Morir termina el modo asustado: timer a 0, flags limpios, sin ojos ni popups residuales.
- Comer otra pastilla con el modo activo reinicia timer y combo.

**Fuera de alcance (para futuras specs):**

- Pausa de ~0.5 s estilo arcade al comer un fantasma.
- Scatter/chase global, Cruise Elroy, túnel lento (ya registrados fuera en SPEC 01/02).
- Duración escalable por nivel (solo existe el nivel 1).
- Frutas bonus.

## Modelo de datos

```js
// src/js/maze.js
parseTile('o') → 4   // 'o' en (1,3), (26,3), (1,23), (26,23) de MAZE_STR

// src/js/game.js — constantes nuevas
const PELLET_SCORE = 50;
const FRIGHT_FRAMES = 360;  // ~6 s
const FRIGHT_FLASH = 120;   // últimos ~2 s parpadean
const FRIGHT_SPEED = 0.05;  // mitad de GHOST_SPEED
const EYES_SPEED = 0.2;     // doble de GHOST_SPEED

// src/js/game.js — estado de game
frightTimer: 0,     // frames restantes (0 = inactivo)
ghostCombo: 0,      // fantasmas comidos con la pastilla actual (0-3)
popups: [],         // { x, y, value, timer(~60) }

// src/js/game.js — cada fantasma en game.ghosts
{
  x, y, dir, speed, kind, waitTimer,
  state: 'waiting' | 'exiting' | 'active' | 'eyes' | 'entering',
  frightened: false, // flag ortogonal: aplica también a waiting/exiting
}
```

Orden dentro de `update()`: mover → colisiones (comer/morir) → decrementar `frightTimer` y limpiar flags al llegar a 0 → popups → victoria.

## Plan de implementación

1. `src/js/maze.js` + `game.js` + `render.js`: tile `o`→4 en las 4 esquinas; `createGame` cuenta `v === 2 || v === 4` en `dotsRemaining`; `movePacman` come 4 (+50, `dotsRemaining--`); `drawDots` dibuja valor 4 como círculo grande (r≈6) parpadeante por `frame`. Prueba manual: 4 pastillas grandes parpadean, +50 al comerlas, el nivel se gasta al limpiarlas.
2. `src/js/game.js`: constantes, `frightTimer`/`ghostCombo`, activación al comer pastilla (flags a todos los no-ojos, reversa de activos), rama aleatoria en `decideGhost` cuando `frightened`, velocidad efectiva 0.05, decremento/expiración, limpieza al morir. `render.js`: cuerpo azul con ojos blancos sin pupilas; parpadeo azul↔blanco en los últimos 120 frames. Prueba manual: azules lentos y erráticos ~6 s, parpadeo final, siguen matando al chocar.
3. `src/js/game.js`: colisión con frightened → comer (score `200 << ghostCombo`, `ghostCombo++`, `state='eyes'`, flag off); `eyes` greedy a (13,11) a 0.2 usando `decideGhost` con objetivo fijo; `entering` baja (13,11)→(13,14) → `exiting`; `eyes`/`entering` no colisionan. Prueba manual: comer 2 seguidos da 200+400; los ojos cruzan hasta la casa, entran y el fantasma sale normal.
4. `src/js/game.js` + `render.js`: `game.popups` (crear al comer, `timer--` en update, eliminar a 0) y texto cian ~1 s en la posición del fantasma. Prueba manual: aparece 200/400/800/1600 donde estaba el fantasma.

## Criterios de aceptación

- [ ] Hay exactamente 4 pastillas grandes en (1,3), (26,3), (1,23), (26,23) y parpadean.
- [ ] Comer una pastilla suma 50 pts y cuenta para la victoria (no se gana sin comer las 4).
- [ ] Al comerla, todos los fantasmas (también waiting/exiting) se pintan azules y los activos invierten dirección.
- [ ] Los asustados van a mitad de velocidad y eligen dirección aleatoria sin reversa.
- [ ] El modo dura ~6 s; en los últimos ~2 s parpadean azul↔blanco; al terminar recuperan color, velocidad y persecución.
- [ ] Chocar con un asustado se lo come: +200/400/800/1600 en orden dentro de la misma pastilla; la siguiente reinicia a 200.
- [ ] El comido se vuelve ojos rápidos, llega a (13,11), entra a la casa, revive y sale normal (no asustado).
- [ ] Los ojos no matan a Pac-Man ni se dejan comer.
- [ ] Un popup con el puntaje es visible ~1 s en el lugar del fantasma comido.
- [ ] Morir termina el modo: sin fantasmas azules, sin ojos, sin popups residuales.
- [ ] Comer una pastilla con el modo activo reinicia timer (~6 s) y combo.
- [ ] Una partida completa no lanza errores en consola.

## Decisiones

- **Sí (confirmado):** aleatorio sin reversa en asustado; ojos que regresan y revivan; 200/400/800/1600 con reinicio por pastilla; ~6 s fijo; asustado 0.05 / ojos 0.2; reversa de activos al comer pastilla; parpadeo final azul↔blanco; la casa también se asusta; popup sin pausa.
- **Sí:** pastilla = 50 pts y cuenta para `dotsRemaining` (fidelidad arcade: los energizadores forman parte de los 244 dots).
- **Sí:** `frightened` como flag ortogonal a `state` — cubre waiting/exiting sin duplicar la máquina de estados.
- **Sí:** parpadeo de la pastilla con paridad de `frame` — fiel al arcade y gratis con el tick fijo de SPEC 02.
- **No:** pausa de ~0.5 s al comer fantasma — congelar el bucle añade un estado global; si se echa de menos, otra spec.
- **No:** revivir asustado — el arcade revive normal.
- **No:** RNG ni pista de ojos especial del arcade — greedy existente a (13,11) reutiliza `decideGhost`.
- **No:** duración escalable por nivel — solo hay nivel 1.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Greedy sin reversa puede dar rodeos con los ojos hacia (13,11) | Mismo mecanismo ya usado por los 4 fantasmas hacia cualquier objetivo; aceptado, llega igual. |
| Comer un fantasma en el mismo tick en que expira el timer | Las colisiones se resuelven antes de decrementar `frightTimer` en `update()`. |
| Velocidad 0.05 alinea cada 20 frames (giros asustados menos frecuentes) | Comportamiento esperado: se mueven lento; sin código extra. |

## Lo que **no** está en esta spec

- Pausa arcade al comer fantasma, scatter/chase, Cruise Elroy, túnel lento, niveles, frutas. Cada uno, si llega, va en su propia spec.
