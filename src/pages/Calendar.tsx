import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

interface Product {
  id: string;
  name: string;
  brand: string;
  expiryDate: string;
  imageUrl?: string;
}

const Calendar: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    console.log('Page Calendrier chargée');
    
    const q = query(
      collection(db, 'products'),
      orderBy('expiryDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Données reçues de Firebase:', snapshot.size, 'produits');
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      console.log('Produits récupérés:', productsData);
      setProducts(productsData);
    }, (error) => {
      console.error('Erreur lors de la récupération des données:', error);
    });

    return () => unsubscribe();
  }, []);

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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Calendrier des DLC - Surgelés</h1>
        </div>

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
            <div key={date} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                <h2 className="font-semibold text-gray-700 text-lg">
                  {new Date(date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {groupedProducts[date].map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-6 p-6 hover:bg-gray-50 transition-colors"
                  >
                    {product.imageUrl && (
                      <div className="w-24 h-24 bg-white rounded-lg p-2 flex items-center justify-center border border-gray-100">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            console.error('Erreur de chargement de l\'image:', e);
                            e.currentTarget.src = 'https://placehold.co/400x400/png?text=Image+non+disponible';
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium text-xl text-gray-800 mb-1">{product.name}</h3>
                      <p className="text-sm text-gray-600">{product.brand}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Calendar; 