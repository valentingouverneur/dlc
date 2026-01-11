import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NotificationService } from '../services/NotificationService';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Product } from '../types/Product';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('notificationsEnabled') === 'true';
  });
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);
      
      if (notificationsEnabled && productsData.length > 0) {
        const notificationService = NotificationService.getInstance();
        notificationService.startDailyCheck(productsData);
      }
    });

    return () => unsubscribe();
  }, [notificationsEnabled]);

  const handleNotificationToggle = async () => {
    const notificationService = NotificationService.getInstance();
    if (notificationsEnabled) {
      notificationService.stopDailyCheck();
      setNotificationsEnabled(false);
      localStorage.setItem('notificationsEnabled', 'false');
    } else {
      const granted = await notificationService.requestPermission();
      setNotificationsEnabled(granted);
      if (granted && products.length > 0) {
        localStorage.setItem('notificationsEnabled', 'true');
        notificationService.startDailyCheck(products);
      } else if (granted) {
        localStorage.setItem('notificationsEnabled', 'true');
      }
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-16 bg-gray-800 flex-col items-center py-4 z-40">
      {/* Logo en haut */}
      <Link to="/" className="mb-8">
        <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 transition-colors">
          <span className="text-white font-bold text-sm">DLC</span>
        </div>
      </Link>

      {/* Menu items */}
      <nav className="flex flex-col items-center space-y-4 flex-1">
        {/* DLC - Page d'accueil */}
        <Link
          to="/"
          className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
            isActive('/') ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
          title="DLC"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </Link>

        {/* Search - Liste des produits */}
        <Link
          to="/products"
          className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
            isActive('/products') ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
          title="Recherche"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </Link>

        {/* Affiches */}
        <Link
          to="/affiches"
          className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
            isActive('/affiches') ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
          title="Affiches"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </Link>

        {/* Promos */}
        <Link
          to="/promos"
          className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
            isActive('/promos') ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
          title="Promotions"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </Link>
      </nav>

      {/* Notifications en bas */}
      <button
        onClick={handleNotificationToggle}
        className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors mt-auto ${
          notificationsEnabled ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
        }`}
        title={notificationsEnabled ? 'Désactiver les notifications' : 'Activer les notifications'}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </button>
    </aside>
  );
};

export default Sidebar;
