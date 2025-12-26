export class ServiceWorkerService {
  private static instance: ServiceWorkerService;
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported: boolean = 'serviceWorker' in navigator;

  private constructor() {
    if (this.isSupported) {
      this.register();
    }
  }

  static getInstance(): ServiceWorkerService {
    if (!ServiceWorkerService.instance) {
      ServiceWorkerService.instance = new ServiceWorkerService();
    }
    return ServiceWorkerService.instance;
  }

  private async register(): Promise<void> {
    if (!this.isSupported) {
      console.warn('[ServiceWorkerService] Service Workers non supportés');
      return;
    }

    try {
      // Le plugin vite-plugin-pwa enregistre automatiquement le Service Worker
      // On attend juste qu'il soit prêt
      if ('serviceWorker' in navigator) {
        // Attendre que le Service Worker soit enregistré et prêt
        const registration = await navigator.serviceWorker.ready;
        this.registration = registration;
        console.log('[ServiceWorkerService] Service Worker prêt et enregistré');
        
        // Écouter les mises à jour
        registration.addEventListener('updatefound', () => {
          console.log('[ServiceWorkerService] Nouvelle version du Service Worker détectée');
        });
      }
    } catch (error) {
      console.error('[ServiceWorkerService] Erreur lors de l\'enregistrement:', error);
    }
  }

  async getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported) {
      return null;
    }

    if (this.registration) {
      return this.registration;
    }

    try {
      if ('serviceWorker' in navigator) {
        this.registration = await navigator.serviceWorker.ready;
        return this.registration;
      }
    } catch (error) {
      console.error('[ServiceWorkerService] Erreur lors de la récupération:', error);
    }

    return null;
  }

  async sendNotification(title: string, options?: NotificationOptions): Promise<void> {
    const registration = await this.getRegistration();
    
    if (!registration) {
      console.warn('[ServiceWorkerService] Service Worker non disponible, utilisation de l\'API Notification');
      return;
    }

    try {
      // Utiliser directement showNotification du Service Worker (plus fiable)
      await registration.showNotification(title, {
        ...options,
        badge: '/icon-192x192.png',
        icon: options?.icon || '/icon-192x192.png',
        tag: options?.tag || 'default',
        requireInteraction: options?.requireInteraction || false,
        silent: false,
        vibrate: [200, 100, 200] // Vibration pour mobile
      });
      console.log('[ServiceWorkerService] Notification envoyée via Service Worker:', title);
    } catch (error) {
      console.error('[ServiceWorkerService] Erreur lors de l\'envoi de la notification:', error);
      // Si erreur avec Service Worker, essayer l'API Notification classique
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const notification = new Notification(title, {
            ...options,
            badge: '/icon-192x192.png',
            icon: options?.icon || '/icon-192x192.png',
            tag: options?.tag || 'default'
          });
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
          console.log('[ServiceWorkerService] Notification envoyée via API Notification (fallback):', title);
        } catch (fallbackError) {
          console.error('[ServiceWorkerService] Erreur avec le fallback:', fallbackError);
        }
      }
    }
  }

  isServiceWorkerAvailable(): boolean {
    return this.isSupported && this.registration !== null;
  }
}

