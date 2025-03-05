import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface Product {
  id: string;
  name: string;
  brand: string;
  expiryDate: string;
}

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Création d'une requête pour récupérer tous les produits
    const q = query(
      collection(db, 'products'),
      orderBy('expiryDate', 'asc')
    );

    // Écoute des changements en temps réel
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (productId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      try {
        await deleteDoc(doc(db, 'products', productId));
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression du produit');
      }
    }
  };

  // Filtrage des produits par terme de recherche
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Liste des Produits</h1>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Rechercher un produit
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
            placeholder="Nom ou marque du produit..."
          />
        </div>

        <div className="space-y-4">
          {filteredProducts.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              Aucun produit trouvé
            </p>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                className="border rounded-lg p-4 hover:bg-gray-50 flex justify-between items-center"
              >
                <div>
                  <h3 className="font-semibold">{product.name}</h3>
                  <p className="text-gray-600">{product.brand}</p>
                  <p className="text-sm text-gray-500">
                    DLC: {new Date(product.expiryDate).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  Supprimer
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Products; 