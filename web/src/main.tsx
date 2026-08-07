import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles.css';
import './styles/tokens.css';
import './styles/shell.css';
import './styles/quick-quote.css';
import './styles/dialogs.css';
import './styles/settings.css';
import './styles/tables.css';
import './styles/filaments.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);
