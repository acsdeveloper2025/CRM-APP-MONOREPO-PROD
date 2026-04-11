// Side-effect import — MUST be first so the OpenTelemetry web SDK patches
// global fetch/XHR before React or axios capture references to them. The
// bootstrap is env-gated (VITE_OTEL_ENABLED) so non-tracing builds pay
// zero runtime cost.
import './tracing';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
