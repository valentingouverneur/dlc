import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NotificationService } from '../services/NotificationService';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Product } from '../types/Product';

interface BottomNavProps {
  onScannerClick: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ onScannerClick }) => {
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="bg-white rounded-t-3xl border-t border-gray-200 shadow-lg">
        <div className="flex items-center justify-around h-16 px-2 pb-2">
        {/* DLC - Page d'accueil */}
        <Link
          to="/"
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            isActive('/') ? 'text-purple-600' : 'text-gray-600'
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-medium">DLC</span>
        </Link>

        {/* Search - Liste des produits */}
        <Link
          to="/products"
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            isActive('/products') ? 'text-purple-600' : 'text-gray-600'
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs font-medium">Search</span>
        </Link>

        {/* Scanner - Bouton central avec code-barres */}
        <button
          onClick={onScannerClick}
          className="flex items-center justify-center w-16 h-16 -mt-6 bg-purple-600 rounded-full shadow-lg hover:bg-purple-700 transition-colors z-10"
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            {/* Rectangle avec coins */}
            <path d="M6 6h12v12H6z" strokeLinecap="round" strokeLinejoin="round" />
            {/* Coins */}
            <path d="M6 6l4 0M6 6l0 4M18 6l-4 0M18 6l0 4M6 18l4 0M6 18l0 -4M18 18l-4 0M18 18l0 -4" strokeLinecap="round" />
            {/* Lignes verticales du code-barres */}
            <path d="M8 8v8M10 9v6M12 8v8M14 9v6M16 8v8" strokeLinecap="round" />
          </svg>
        </button>

        {/* Affiches */}
        <Link
          to="/affiches"
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            isActive('/affiches') ? 'text-purple-600' : 'text-gray-600'
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span className="text-xs font-medium">Affiches</span>
        </Link>

        {/* Notifications */}
        <button
          onClick={handleNotificationToggle}
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            notificationsEnabled ? 'text-purple-600' : 'text-gray-600'
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-xs font-medium">Notifications</span>
        </button>
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
