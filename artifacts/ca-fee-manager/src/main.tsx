import { createRoot } from 'react-dom/client';
import { Router } from 'wouter';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App';

import './index.css';

const base = import.meta.env.BASE_URL || '/';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <Router base={base}>
      <App />
    </Router>
  </ErrorBoundary>
);
