import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ServiceWorkerService } from './services/ServiceWorkerService'

// Initialiser le Service Worker
if ('serviceWorker' in navigator) {
  ServiceWorkerService.getInstance();
  
  // Écouter les mises à jour du Service Worker
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[Main] Service Worker mis à jour, rechargement de la page...');
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
