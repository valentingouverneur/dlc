import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Product } from '../types/Product';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    expiryDate: ''
  });

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        if (!id) return;
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as Product;
          setProduct({ ...data, id: docSnap.id });
          setFormData({
            name: data.name,
            brand: data.brand,
            expiryDate: new Date(data.expiryDate).toISOString().split('T')[0]
          });
        } else {
          setError('Produit non trouvé');
        }
      } catch (err) {
        setError('Erreur lors du chargement du produit');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !product) return;

    try {
      const docRef = doc(db, 'products', id);
      await updateDoc(docRef, {
        name: formData.name,
        brand: formData.brand,
        expiryDate: new Date(formData.expiryDate).toISOString()
      });

      setProduct({
        ...product,
        name: formData.name,
        brand: formData.brand,
        expiryDate: new Date(formData.expiryDate).toISOString()
      });
      
      setIsEditing(false);
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
      alert('Erreur lors de la mise à jour du produit');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
          <div className="text-red-600">{error || 'Produit non trouvé'}</div>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-black text-white rounded-lg"
          >
            Retour au calendrier
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Modifier le produit' : 'Détails du produit'}
            </h1>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800"
            >
              {isEditing ? 'Annuler' : 'Modifier'}
            </button>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nom du produit
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Marque
                </label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date de péremption
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-black border border-transparent rounded-md hover:bg-gray-800"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-32 h-32 object-contain rounded-lg"
                  />
                )}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{product.name}</h2>
                  <p className="text-gray-500">{product.brand}</p>
                  <p className="text-gray-600 mt-2">
                    Date de péremption : {new Date(product.expiryDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              {product.nutrition && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Informations nutritionnelles</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Calories</p>
                      <p className="text-lg font-medium">{product.nutrition.calories} kcal</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Protéines</p>
                      <p className="text-lg font-medium">{product.nutrition.proteins}g</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Glucides</p>
                      <p className="text-lg font-medium">{product.nutrition.carbohydrates}g</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Lipides</p>
                      <p className="text-lg font-medium">{product.nutrition.fat}g</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Retour au calendrier
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetails; 