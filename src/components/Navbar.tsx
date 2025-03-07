import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faPlus, faBars, faBell, faTimes } from '@fortawesome/free-solid-svg-icons';
import Modal from './Modal';
import ManualProductForm from './ManualProductForm';
import { NotificationService } from '../services/NotificationService';

const Navbar: React.FC = () => {
  const location = useLocation();
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const handleNotificationToggle = async () => {
    const notificationService = NotificationService.getInstance();
    if (notificationsEnabled) {
      notificationService.stopDailyCheck();
      setNotificationsEnabled(false);
    } else {
      const granted = await notificationService.requestPermission();
      setNotificationsEnabled(granted);
    }
    setIsMenuOpen(false);
  };

  return (
    <>
      <nav className="bg-white shadow-sm h-14">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-gray-900">
            DLC Watcher
          </Link>
          
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-full transition-colors text-gray-600 hover:text-black"
            >
              <FontAwesomeIcon icon={isMenuOpen ? faTimes : faBars} className="w-6 h-6" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
                <button
                  onClick={() => {
                    setIsManualFormOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <FontAwesomeIcon icon={faPlus} className="w-5 h-5 mr-3" />
                  Ajouter un produit
                </button>
                
                <Link 
                  to="/products" 
                  className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FontAwesomeIcon icon={faSearch} className="w-5 h-5 mr-3" />
                  Liste des produits
                </Link>

                <button
                  onClick={handleNotificationToggle}
                  className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <FontAwesomeIcon 
                    icon={faBell} 
                    className={`w-5 h-5 mr-3 ${notificationsEnabled ? 'text-green-500' : ''}`}
                  />
                  {notificationsEnabled ? 'Désactiver les notifications' : 'Activer les notifications'}
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <Modal
        isOpen={isManualFormOpen}
        onClose={() => setIsManualFormOpen(false)}
        title="Ajouter un produit"
      >
        <ManualProductForm onClose={() => setIsManualFormOpen(false)} />
      </Modal>

      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-40"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </>
  );
};

export default Navbar; 