import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Import and initialize PWA elements for Capacitor web support
import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Initialize PWA elements for Capacitor web support
defineCustomElements(window);

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
