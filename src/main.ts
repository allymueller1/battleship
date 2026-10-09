import '@fontsource-variable/inter';
import '@fontsource/orbitron/700.css';
import './styles.css';
import { mountApp } from './ui/app';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  mountApp(app);
}
