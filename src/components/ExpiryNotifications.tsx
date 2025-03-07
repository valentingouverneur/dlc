import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types/Product';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faInfoCircle } from '@fortawesome/free-solid-svg-icons';

interface ExpiryNotificationsProps {
  products: Product[];
}

const ExpiryNotifications: React.FC<ExpiryNotificationsProps> = ({ products }) => {
  const today = new Date();
  const in3Days = new Date();
  const in7Days = new Date();
  in3Days.setDate(today.getDate() + 3);
  in7Days.setDate(today.getDate() + 7);

  const getExpiringProducts = () => {
    return products.reduce((acc, product) => {
      const expiryDate = new Date(product.expiryDate);
      
      if (expiryDate <= today) {
        acc.expired.push(product);
      } else if (expiryDate <= in3Days) {
        acc.critical.push(product);
      } else if (expiryDate <= in7Days) {
        acc.warning.push(product);
      }
      
      return acc;
    }, {
      expired: [] as Product[],
      critical: [] as Product[],
      warning: [] as Product[]
    });
  };

  const { expired, critical, warning } = getExpiringProducts();

  if (expired.length === 0 && critical.length === 0 && warning.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {expired.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex items-center">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500 w-5 h-5 mr-2" />
            <div className="flex-1">
              <p className="text-red-700 font-medium">
                Produits périmés ({expired.length})
              </p>
              <div className="mt-1 text-sm">
                {expired.map(product => (
                  <Link 
                    key={product.id}
                    to={`/product/${product.id}`}
                    className="block text-red-600 hover:text-red-800"
                  >
                    {product.name} - {new Date(product.expiryDate).toLocaleDateString('fr-FR')}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {critical.length > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4">
          <div className="flex items-center">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-orange-500 w-5 h-5 mr-2" />
            <div className="flex-1">
              <p className="text-orange-700 font-medium">
                À consommer dans les 3 jours ({critical.length})
              </p>
              <div className="mt-1 text-sm">
                {critical.map(product => (
                  <Link 
                    key={product.id}
                    to={`/product/${product.id}`}
                    className="block text-orange-600 hover:text-orange-800"
                  >
                    {product.name} - {new Date(product.expiryDate).toLocaleDateString('fr-FR')}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {warning.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
          <div className="flex items-center">
            <FontAwesomeIcon icon={faInfoCircle} className="text-yellow-500 w-5 h-5 mr-2" />
            <div className="flex-1">
              <p className="text-yellow-700 font-medium">
                À consommer dans la semaine ({warning.length})
              </p>
              <div className="mt-1 text-sm">
                {warning.map(product => (
                  <Link 
                    key={product.id}
                    to={`/product/${product.id}`}
                    className="block text-yellow-600 hover:text-yellow-800"
                  >
                    {product.name} - {new Date(product.expiryDate).toLocaleDateString('fr-FR')}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpiryNotifications; 