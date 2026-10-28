import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createPlatformService } from './platform/index.ts';
import './styles.css';
import { Hud } from './ui/Hud.tsx';
import { useHud } from './ui/store.ts';

function mustGet(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing from index.html`);
  return node;
}

const platform = createPlatformService();
createRoot(mustGet('hud-root')).render(
  <StrictMode>
    <Hud platform={platform} />
  </StrictMode>,
);

async function boot(): Promise<void> {
  const setLabel = (loadingLabel: string) => useHud.setState({ loadingLabel });
  // The engine (three.js + Rapier) is split into its own chunks so this screen paints first;
  // start fetching it while the platform SDK initialises.
  const engine = import('./engine/Game.ts');
  setLabel('Contacting platform…');
  await platform.init();
  platform.loadingStart();
  platform.onMuteChange((muted) => useHud.setState({ muted }));

  try {
    const { Game } = await engine;
    const game = await Game.create(mustGet('game-root'), mustGet('overlay-root'), platform, setLabel);
    platform.onAdBreak((active) => game.setAdBreak(active));
    useHud.setState({ phase: 'title' });
    if (import.meta.env.DEV) Object.assign(window, { __game: game });
  } catch (error) {
    console.error(error);
    useHud.setState({ phase: 'error', error: error instanceof Error ? error.message : String(error) });
  } finally {
    platform.loadingStop();
  }
}

void boot();
