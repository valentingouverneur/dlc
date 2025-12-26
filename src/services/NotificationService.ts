import { Product } from '../types/Product';
import { ServiceWorkerService } from './ServiceWorkerService';

export class NotificationService {
  private static instance: NotificationService;
  private hasPermission: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private isDebug: boolean = true;
  private products: Product[] = [];
  private serviceWorkerService: ServiceWorkerService;

  private constructor() {
    this.serviceWorkerService = ServiceWorkerService.getInstance();
    this.checkPermission();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private log(message: string) {
    if (this.isDebug) {
      console.log(`[NotificationService] ${message}`);
    }
  }

  private async checkPermission() {
    if (!('Notification' in window)) {
      this.log('Ce navigateur ne supporte pas les notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      this.hasPermission = true;
      this.log('Les notifications sont déjà autorisées');
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      this.log(`Permission de notification: ${permission}`);
    } else {
      this.log('Les notifications sont refusées');
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      this.log('Les notifications ne sont pas supportées');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      this.log(`Nouvelle permission de notification: ${permission}`);
      return this.hasPermission;
    } catch (error) {
      console.error('Erreur lors de la demande de permission:', error);
      return false;
    }
  }

  private async sendNotification(title: string, options?: NotificationOptions) {
    if (!this.hasPermission) {
      this.log('Impossible d\'envoyer la notification: pas de permission');
      return;
    }

    try {
      // Essayer d'utiliser le Service Worker d'abord
      if (this.serviceWorkerService.isServiceWorkerAvailable()) {
        await this.serviceWorkerService.sendNotification(title, options);
        this.log(`Notification envoyée via Service Worker: ${title}`);
        return;
      }

      // Fallback sur l'API Notification classique
      const notification = new Notification(title, {
        ...options,
        badge: '/icon-192x192.png',
        icon: options?.icon || '/icon-192x192.png'
      });
      this.log(`Notification envoyée: ${title}`);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Fermer automatiquement après 5 secondes
      setTimeout(() => {
        notification.close();
      }, 5000);
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification:', error);
    }
  }

  private normalizeDate(date: Date | string | any): Date {
    // Si c'est déjà une Date
    if (date instanceof Date) {
      return date;
    }
    
    // Si c'est une string ISO
    if (typeof date === 'string') {
      return new Date(date);
    }
    
    // Si c'est un Timestamp Firebase
    if (date && typeof date === 'object' && date.toDate) {
      return date.toDate();
    }
    
    // Si c'est un objet avec seconds (Timestamp Firebase)
    if (date && typeof date === 'object' && date.seconds) {
      return new Date(date.seconds * 1000);
    }
    
    // Sinon, essayer de créer une Date
    return new Date(date);
  }

  private checkExpiringProducts(products: Product[]) {
    if (!products || products.length === 0) {
      this.log('Aucun produit à vérifier');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    this.log(`Vérification des produits expirant le ${today.toISOString().split('T')[0]}`);
    this.log(`Nombre de produits à vérifier: ${products.length}`);
    
    const expiringProducts = products.filter(product => {
      try {
        const expiryDate = this.normalizeDate(product.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // Produits expirant aujourd'hui ou dans les 3 prochains jours
        return daysUntilExpiry >= -1 && daysUntilExpiry <= 3;
      } catch (error) {
        console.error('Erreur lors de la vérification de la date:', error, product);
        return false;
      }
    });

    if (expiringProducts.length > 0) {
      const productNames = expiringProducts.map(p => p.name).join(', ');
      const daysText = expiringProducts.some(p => {
        const expiryDate = this.normalizeDate(p.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        const days = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return days < 0;
      }) ? 'périmés' : 'expirant bientôt';
      
      this.log(`Produits ${daysText} trouvés: ${productNames}`);
      
      this.sendNotification(
        `Produits ${daysText}`,
        {
          body: `${expiringProducts.length} produit(s): ${productNames}`,
          icon: '/icon-192x192.png',
          tag: `expiry-${today.toISOString().split('T')[0]}`,
          requireInteraction: true,
          silent: false
        }
      );
    } else {
      this.log('Aucun produit n\'expire dans les prochains jours');
    }
  }

  updateProducts(products: Product[]) {
    this.products = products;
    this.log(`Produits mis à jour: ${products.length} produits`);
    
    // Si les notifications sont actives, vérifier immédiatement
    if (this.hasPermission && this.checkInterval) {
      this.checkExpiringProducts(products);
    }
  }

  startDailyCheck(products: Product[]) {
    this.log('Démarrage de la vérification des notifications');
    
    // Stocker les produits
    this.products = products;
    
    if (products.length === 0) {
      this.log('Aucun produit disponible, attente des données...');
      return;
    }
    
    // Vérification immédiate
    this.checkExpiringProducts(products);

    // Arrêter l'intervalle précédent s'il existe
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.log('Arrêt de l\'ancien intervalle de vérification');
    }

    // Vérifier toutes les 30 secondes en mode debug, sinon toutes les heures
    const interval = this.isDebug ? 30000 : 3600000;
    
    this.checkInterval = setInterval(() => {
      // Utiliser les produits stockés ou ceux passés en paramètre
      const productsToCheck = this.products.length > 0 ? this.products : products;
      
      if (productsToCheck.length === 0) {
        this.log('Aucun produit à vérifier dans l\'intervalle');
        return;
      }

      const now = new Date();
      const hour = now.getHours();
      const minutes = now.getMinutes();
      const day = now.getDay();

      // En mode debug, vérifier toutes les 30 secondes
      // En production, vérifier à 6h00 sauf le dimanche
      if (this.isDebug || (hour === 6 && minutes === 0 && day !== 0)) {
        this.checkExpiringProducts(productsToCheck);
      }
    }, interval);

    this.log(`Nouvel intervalle de vérification configuré: ${interval/1000} secondes`);
  }

  stopDailyCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.log('Arrêt de la vérification des notifications');
    }
  }
} 