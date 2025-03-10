import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Link, useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import ExpiryNotifications from '../components/ExpiryNotifications';
import { NotificationService } from '../services/NotificationService';
import { Product } from '../types/Product';

const Calendar: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('Initialisation de la souscription Firebase');
    setLoading(true);
    setError(null);
    
    try {
      const q = query(
        collection(db, 'products'),
        orderBy('expiryDate', 'asc')
      );

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          console.log('Données reçues de Firebase:', snapshot.size, 'produits');
          const productsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Product[];
          console.log('Produits récupérés:', productsData);
          setProducts(productsData);
          setLoading(false);
        }, 
        (error) => {
          console.error('Erreur lors de la récupération des données:', error);
          setError('Erreur lors du chargement des produits');
          setLoading(false);
        }
      );

      return () => {
        console.log('Désinscription de la souscription Firebase');
        unsubscribe();
      };
    } catch (err) {
      console.error('Erreur lors de l\'initialisation de la souscription:', err);
      setError('Erreur lors de l\'initialisation');
      setLoading(false);
    }
  }, []);

  const handleDelete = async (productId: string) => {
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression du produit');
    }
  };

  const groupedProducts = products.length > 0 
    ? products.reduce((acc, product) => {
        const date = new Date(product.expiryDate).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(product);
        return acc;
      }, {} as Record<string, Product[]>)
    : {};

  console.log('Produits groupés:', groupedProducts);

  const sortedDates = Object.keys(groupedProducts).sort();

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Calendrier des DLC - Surgelés</h1>
            </div>

            <ExpiryNotifications products={products} />

            <div className="mb-6">
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-6">
              {sortedDates.map((date) => (
                <div key={date} className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {new Date(date).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h3>
                  <div className="space-y-4">
                    {groupedProducts[date].map((product) => (
                      <div
                        key={product.id}
                        className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <Link to={`/product/${product.id}`} className="flex items-center space-x-4 flex-1">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-16 h-16 object-contain"
                              />
                            ) : (
                              <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-lg">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{product.name}</h4>
                              <p className="text-sm text-gray-500">{product.brand}</p>
                            </div>
                          </Link>
                          <div className="flex items-center space-x-2">
                            <Link
                              to={`/product/${product.id}`}
                              className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                              title="Modifier le produit"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Link>
                            <button
                              onClick={() => {
                                setProductToDelete(product);
                                setDeleteModalOpen(true);
                              }}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                              title="Supprimer le produit"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={() => {
          if (productToDelete?.id) {
            handleDelete(productToDelete.id);
          }
          setDeleteModalOpen(false);
        }}
        title="Supprimer le produit"
        message={`Êtes-vous sûr de vouloir supprimer ${productToDelete?.name} ? Cette action est irréversible.`}
      />
    </div>
  );
};

export default Calendar; 