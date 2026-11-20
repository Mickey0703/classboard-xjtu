import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/main.css';
import './styles/refresh.css';
import './styles/workspace.css';
import './styles/edition.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
