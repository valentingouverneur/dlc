import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NotificationService } from '../services/NotificationService';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Product } from '../types/Product';

const brandBlue = '#6F73F3';

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
  const itemBase =
    'flex items-center gap-3 p-3 transition-colors rounded text-slate-300 hover:text-[--brand-blue] hover:bg-[color:rgb(111_115_243_/0.12)]';
  const itemActive = 'text-[--brand-blue] bg-[color:rgb(111_115_243_/0.18)]';

  return (
    <aside className="hidden md:flex fixed top-0 bottom-0 left-0 z-40 w-72 flex-col bg-[#0F172A] border-r border-slate-800">
      <style>{`:root{--brand-blue:${brandBlue};}`}</style>
      <Link to="/" className="flex items-center gap-3 p-6 text-white">
        <div className="w-9 h-9 rounded-lg bg-[--brand-blue] flex items-center justify-center text-white font-semibold">
          D
        </div>
        <span className="text-lg font-semibold">DLC</span>
      </Link>

      <div className="p-4 pt-0 pb-6 border-b border-slate-800">
        <div className="relative">
          <input
            type="text"
            placeholder="Search here"
            className="w-full h-10 px-4 pr-12 text-sm rounded border border-slate-700 bg-slate-900 text-slate-300 placeholder:text-slate-500 focus:border-[--brand-blue] focus:outline-none"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute top-2.5 right-4 h-5 w-5 stroke-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"></path>
          </svg>
        </div>
      </div>

      <nav aria-label="side navigation" className="flex-1 overflow-auto">
        <ul className="flex flex-col gap-1 py-3">
          <li className="px-3">
            <Link to="/" className={`${itemBase} ${isActive('/') ? itemActive : ''}`} aria-current={isActive('/') ? 'page' : undefined}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
              </svg>
              <span className="text-sm">DLC</span>
            </Link>
          </li>
          <li className="px-3">
            <Link to="/affiches" className={`${itemBase} ${isActive('/affiches') ? itemActive : ''}`} aria-current={isActive('/affiches') ? 'page' : undefined}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="text-sm">Affiches</span>
            </Link>
          </li>
          <li className="px-3">
            <Link to="/promos" className={`${itemBase} ${isActive('/promos') ? itemActive : ''}`} aria-current={isActive('/promos') ? 'page' : undefined}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">Promos</span>
            </Link>
          </li>
        </ul>
      </nav>

      <div className="p-3 border-t border-slate-800">
        <button
          onClick={handleNotificationToggle}
          className={`${itemBase} w-full justify-between ${notificationsEnabled ? itemActive : ''}`}
          title={notificationsEnabled ? 'Désactiver les notifications' : 'Activer les notifications'}
        >
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-sm">Notifications</span>
          </div>
          {notificationsEnabled && (
            <span className="inline-flex items-center justify-center px-2 text-xs rounded-full bg-[--brand-blue] text-white">
              on
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
