import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './services/pwaService';
import { initSelfHealingPatch, SelfHealingErrorBoundary } from './services/selfHealingPatch';

// Initialize autonomous background error-correction & WebSocket noise suppression
initSelfHealingPatch();

if (typeof document !== 'undefined') {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <StrictMode>
        <SelfHealingErrorBoundary>
          <App />
        </SelfHealingErrorBoundary>
      </StrictMode>,
    );
  }
}
