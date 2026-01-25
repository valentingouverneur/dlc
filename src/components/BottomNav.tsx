import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBarcode } from '@fortawesome/free-solid-svg-icons';

interface BottomNavProps {
  onScannerClick: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ onScannerClick }) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="bg-white rounded-t-3xl border-t border-gray-200 shadow-lg">
        <div className="flex items-center justify-around h-16 px-2 pb-2">
        <Link
          to="/"
          className={`flex flex-col items-center justify-center flex-1 h-full no-underline ${
            isActive('/') ? '!text-[#6F73F3]' : '!text-gray-600'
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
          </svg>
          <span className="text-xs font-medium">Dashboard</span>
        </Link>

        {/* DLC - Page */}
        <Link
          to="/dlc"
          className={`flex flex-col items-center justify-center flex-1 h-full no-underline ${
            isActive('/dlc') ? '!text-[#6F73F3]' : '!text-gray-600'
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-medium">DLC</span>
        </Link>

        {/* Scanner - Bouton central avec code-barres (design original) - Plus grand */}
        <button
          onClick={onScannerClick}
          className="flex items-center justify-center w-20 h-20 -mt-6 bg-black rounded-full shadow-lg hover:bg-gray-800 transition-colors z-10"
        >
          <FontAwesomeIcon icon={faBarcode} className="w-10 h-10 text-white" />
        </button>

        {/* Affiches */}
        <Link
          to="/affiches"
          className={`flex flex-col items-center justify-center flex-1 h-full no-underline ${
            isActive('/affiches') ? '!text-[#6F73F3]' : '!text-gray-600'
          }`}
        >
          {isActive('/affiches') ? (
            <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5.25 3h13.5A2.25 2.25 0 0121 5.25v13.5A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75V5.25A2.25 2.25 0 015.25 3zm1.5 4.5v9h10.5v-9H6.75z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          )}
          <span className="text-xs font-medium">Affiches</span>
        </Link>

        {/* Promos */}
        <Link
          to="/promos"
          className={`flex flex-col items-center justify-center flex-1 h-full no-underline ${
            isActive('/promos') ? '!text-[#6F73F3]' : '!text-gray-600'
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-medium">Promos</span>
        </Link>
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
