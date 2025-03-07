import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBars, 
  faPlus, 
  faBell, 
  faSearch,
  faXmark
} from '@fortawesome/free-solid-svg-icons';

interface BurgerMenuProps {
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  onOpenManualForm: () => void;
}

const BurgerMenu: React.FC<BurgerMenuProps> = ({
  notificationsEnabled,
  onToggleNotifications,
  onOpenManualForm,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={toggleMenu}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Menu"
      >
        <FontAwesomeIcon 
          icon={isOpen ? faXmark : faBars} 
          className="w-6 h-6 text-gray-700"
        />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
            <button
              onClick={() => handleAction(onOpenManualForm)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-2"
            >
              <FontAwesomeIcon icon={faPlus} className="w-5 h-5 text-gray-600" />
              <span>Ajouter un produit</span>
            </button>

            <Link 
              to="/products" 
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-2"
              onClick={() => setIsOpen(false)}
            >
              <FontAwesomeIcon icon={faSearch} className="w-5 h-5 text-gray-600" />
              <span>Liste des produits</span>
            </Link>

            <button
              onClick={() => handleAction(onToggleNotifications)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-2"
            >
              <FontAwesomeIcon 
                icon={faBell} 
                className={`w-5 h-5 ${notificationsEnabled ? 'text-black' : 'text-gray-600'}`}
              />
              <span>
                {notificationsEnabled ? 'Désactiver les notifications' : 'Activer les notifications'}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default BurgerMenu; 