import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/src/components/common/ErrorBoundary';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary fallbackTitle="Abyssinia Games encountered a display error">
    <App />
  </ErrorBoundary>
);
