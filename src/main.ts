import { Game } from './game/Game';
import { GameSession } from './game/GameSession';
import './ui/styles.css';
import { browserStore } from './utils/storage';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

function showFatal(message: string): void {
  uiRoot.style.pointerEvents = 'auto';
  uiRoot.innerHTML = `<div class="overlay"><div class="panel" style="padding:28px;max-width:520px"><b>LINUX//QUEST</b><p>${message}</p></div></div>`;
}

try {
  const session = new GameSession(browserStore());
  const game = new Game(canvas, uiRoot, session);
  game.start();
  if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')) {
    (window as unknown as { __game: ReturnType<Game['debug']> }).__game = game.debug();
  }
} catch (error) {
  console.error(error);
  showFatal('No se pudo iniciar el juego. Verificá que tu navegador tenga WebGL habilitado.');
}
