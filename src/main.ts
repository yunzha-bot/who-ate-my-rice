import { ThreeGame } from './three/ThreeGame';
import './style.css';

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('Game container #app was not found');
new ThreeGame(container);
