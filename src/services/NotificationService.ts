import { Product } from '../types/Product';

export class NotificationService {
  private static instance: NotificationService;
  private hasPermission: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.checkPermission();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async checkPermission() {
    if (!('Notification' in window)) {
      console.log('Ce navigateur ne supporte pas les notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      this.hasPermission = true;
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      return this.hasPermission;
    } catch (error) {
      console.error('Erreur lors de la demande de permission:', error);
      return false;
    }
  }

  private async sendNotification(title: string, options?: NotificationOptions) {
    if (!this.hasPermission) return;

    try {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification:', error);
    }
  }

  startDailyCheck(products: Product[]) {
    // Arrêter l'intervalle précédent s'il existe
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Vérifier toutes les minutes si c'est l'heure d'envoyer les notifications
    this.checkInterval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      const minutes = now.getMinutes();
      const day = now.getDay();

      // Envoyer la notification à 6h00 sauf le dimanche (0)
      if (hour === 6 && minutes === 0 && day !== 0) {
        const today = new Date().toISOString().split('T')[0];
        
        // Filtrer les produits qui expirent aujourd'hui
        const expiringProducts = products.filter(product => {
          const expiryDate = new Date(product.expiryDate).toISOString().split('T')[0];
          return expiryDate === today;
        });

        if (expiringProducts.length > 0) {
          const productNames = expiringProducts.map(p => p.name).join(', ');
          this.sendNotification(
            'Produits à consommer aujourd\'hui',
            {
              body: `${productNames}`,
              icon: '/icon-192x192.png',
              tag: `expiry-${today}`,
              requireInteraction: true
            }
          );
        }
      }
    }, 60000); // Vérifier toutes les minutes
  }

  stopDailyCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
} 