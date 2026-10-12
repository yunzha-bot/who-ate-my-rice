import { ThreeGame } from './three/ThreeGame';
import './style.css';
import './industrial-ui.css';
import './sheet-ui.css';

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('Game container #app was not found');
new ThreeGame(container);
