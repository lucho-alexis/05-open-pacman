// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame
const PELLET_SCORE = 50;
const FRIGHT_FRAMES = 360;   // ~6 s
const FRIGHT_FLASH = 120;    // ultimos ~2 s
const FRIGHT_SPEED = 0.05;   // mitad de GHOST_SPEED
const EYES_SPEED = 0.2;      // doble de GHOST_SPEED

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    frightTimer: 0,
    ghostCombo: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      state: g.exitDelay > 0 ? 'waiting' : 'active',
      waitTimer: g.exitDelay,
      frightened: false,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pared (1): bloquea a todos.
//   puerta (3): bloquea a pacman y a fantasmas activos; los que salen de
//   la casa (exiting) no pasan por aqui (usan waypoints), asi la puerta
//   solo se cruza al salir.
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot (10 pts) o power pellet (50 pts).
    const cell = grid[ p.y ][ p.x ];
    if ( cell === 2 || cell === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += cell === 4 ? PELLET_SCORE : 10;
      game.dotsRemaining--;
      if ( cell === 4 ) activateFrightened( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

const CLYDE_CORNER = { x: 1, y: 29 }; // esquina inferior izquierda (retirada de clyde)

function activateFrightened( game ) {
  game.frightTimer = FRIGHT_FRAMES;
  game.ghostCombo = 0;
  game.ghosts.forEach( ( g ) => {
    if ( g.state === 'eyes' || g.state === 'entering' ) return;
    g.frightened = true;
    if ( g.state === 'active' ) g.dir = OPPOSITE[ g.dir ];
  } );
}

function clearFrightened( game ) {
  game.frightTimer = 0;
  game.ghostCombo = 0;
  game.ghosts.forEach( ( g ) => { g.frightened = false; } );
}

// Objetivo por kind. Solo se usa para comparar distancias: puede quedar
// fuera del tablero (pinky/inky) y no hace falta validarlo.
function ghostTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const d = DIRS[ p.dir ] || { x: 0, y: 0 };

  if ( g.kind === 'pinky' ) {
    // Emboscada: 4 casillas delante de pacman.
    return { x: px + 4 * d.x, y: py + 4 * d.y };
  }
  if ( g.kind === 'inky' ) {
    // Flanqueo: simetrico de blinky respecto a 2 delante de pacman.
    const blinky = game.ghosts[ 0 ]; // GHOST_STARTS[0] es blinky
    const ax = px + 2 * d.x;
    const ay = py + 2 * d.y;
    return { x: 2 * ax - Math.round( blinky.x ), y: 2 * ay - Math.round( blinky.y ) };
  }
  if ( g.kind === 'clyde' ) {
    // Timido: persigue lejos; a <=8 casillas se retira a su esquina.
    const dist = Math.abs( Math.round( g.x ) - px ) + Math.abs( Math.round( g.y ) - py );
    return dist > 8 ? { x: px, y: py } : CLYDE_CORNER;
  }
  // blinky (y defecto): celda de pacman, persecucion directa.
  return { x: px, y: py };
}

function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  if ( g.frightened ) {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    return;
  }

  const target = ghostTarget( game, g );

  // Greedy sin reversa: la direccion que minimiza Manhattan al objetivo.
  // El orden de DIRS (left, right, up, down) queda como desempate.
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Salida de la casa por waypoints: (13,14) -> (13,11), atravesando la
// puerta a velocidad normal y sin decidir direccion.
function moveGhostExiting( g ) {
  const speed = g.frightened ? FRIGHT_SPEED : g.speed;
  if ( Math.abs( g.x - 13 ) > 1e-3 ) {
    // Waypoint 1: centrarse en la columna de la puerta.
    g.dir = g.x < 13 ? 'right' : 'left';
    const dx = 13 - g.x;
    g.x += Math.abs( dx ) <= speed ? dx : Math.sign( dx ) * speed;
    return;
  }
  g.x = 13;
  // Waypoint 2: subir atravesando la puerta hasta fuera de la casa.
  g.dir = 'up';
  g.y -= Math.min( speed, g.y - 11 );
  if ( g.y <= 11 + 1e-3 ) {
    g.y = 11;
    g.state = 'active';
  }
}

// Mueve un fantasma exiting/active. Los waiting estan quietos: update
// gestiona su temporizador de salida.
function moveGhost( game, g ) {
  if ( g.state === 'waiting' ) return;

  if ( g.state === 'exiting' ) {
    moveGhostExiting( g );
    return;
  }

  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  const speed = g.frightened ? FRIGHT_SPEED : g.speed;
  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  clearFrightened( game );
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    const start = GHOST_STARTS[ i ];
    g.x = start.x;
    g.y = start.y;
    g.dir = 'up';
    g.state = start.exitDelay > 0 ? 'waiting' : 'active';
    g.waitTimer = start.exitDelay;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );

  game.ghosts.forEach( ( g ) => {
    if ( g.state === 'waiting' ) {
      // Salida escalonada: al agotar el temporizador empieza a salir.
      g.waitTimer--;
      if ( g.waitTimer <= 0 ) g.state = 'exiting';
      return;
    }
    moveGhost( game, g );
  } );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        clearFrightened( game );
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.frightTimer > 0 ) {
    game.frightTimer--;
    if ( game.frightTimer <= 0 ) clearFrightened( game );
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
