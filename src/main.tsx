import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles/globals.css';
import './styles/grain.css';
import './styles/transitions.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found in index.html');

// NOTE: the Router lives inside App so the Rush B sub-app (which carries its
// own MemoryRouter) can render OUTSIDE BrowserRouter — nesting two routers
// throws "You cannot render a <Router> inside another <Router>".
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
