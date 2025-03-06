import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faPlus } from '@fortawesome/free-solid-svg-icons';
import Modal from '../components/Modal';
import ManualProductForm from './ManualProductForm';

const Navbar: React.FC = () => {
  const location = useLocation();
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);

  return (
    <>
      <nav className="bg-white shadow-sm h-14">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-gray-900">
            DLC Watcher
          </Link>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsManualFormOpen(true)}
              className="p-2 rounded-full transition-colors text-gray-600 hover:text-black bg-transparent border-0 appearance-none"
              title="Ajouter un produit manuellement"
            >
              <FontAwesomeIcon icon={faPlus} className="w-5 h-5" />
            </button>
            <Link 
              to="/products" 
              className="p-2 rounded-full transition-colors text-gray-600 hover:text-black"
              title="Liste des produits"
            >
              <FontAwesomeIcon icon={faSearch} className="w-5 h-5" />
            </Link>
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
    </>
  );
};

export default Navbar; 