import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Product } from '../types/Product';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = React.useState<Product | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;

      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
        } else {
          setError('Produit non trouvé');
        }
      } catch (err) {
        setError('Erreur lors du chargement du produit');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center text-gray-600 hover:text-black transition-colors"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Retour
      </button>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="md:flex">
          {/* Image du produit */}
          <div className="md:w-1/3 p-6 flex items-center justify-center bg-gray-50">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="max-w-full h-auto object-contain"
              />
            ) : (
              <div className="w-full h-64 flex items-center justify-center bg-gray-100 rounded-lg">
                <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Informations du produit */}
          <div className="md:w-2/3 p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
            <p className="text-gray-600 mb-4">{product.brand}</p>

            {/* Scores nutritionnels */}
            <div className="flex gap-4 mb-6">
              {product.nutriscore && (
                <div className="flex flex-col items-center">
                  <span className="text-sm text-gray-600">Nutri-Score</span>
                  <span className="text-2xl font-bold">{product.nutriscore}</span>
                </div>
              )}
              {product.ecoScore && (
                <div className="flex flex-col items-center">
                  <span className="text-sm text-gray-600">Éco-Score</span>
                  <span className="text-2xl font-bold">{product.ecoScore}</span>
                </div>
              )}
              {product.novaGroup && (
                <div className="flex flex-col items-center">
                  <span className="text-sm text-gray-600">NOVA</span>
                  <span className="text-2xl font-bold">{product.novaGroup}</span>
                </div>
              )}
            </div>

            {/* Informations principales */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <span className="text-sm text-gray-600">Date de péremption</span>
                <p className="font-medium">
                  {new Date(product.expiryDate).toLocaleDateString()}
                </p>
              </div>
              {product.quantity && (
                <div>
                  <span className="text-sm text-gray-600">Quantité</span>
                  <p className="font-medium">{product.quantity}</p>
                </div>
              )}
            </div>

            {/* Informations nutritionnelles */}
            {product.nutrition && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Informations nutritionnelles</h2>
                <div className="grid grid-cols-2 gap-4">
                  {product.nutrition.calories && (
                    <div>
                      <span className="text-sm text-gray-600">Calories</span>
                      <p className="font-medium">{product.nutrition.calories} kcal</p>
                    </div>
                  )}
                  {product.nutrition.proteins && (
                    <div>
                      <span className="text-sm text-gray-600">Protéines</span>
                      <p className="font-medium">{product.nutrition.proteins}g</p>
                    </div>
                  )}
                  {product.nutrition.carbohydrates && (
                    <div>
                      <span className="text-sm text-gray-600">Glucides</span>
                      <p className="font-medium">{product.nutrition.carbohydrates}g</p>
                    </div>
                  )}
                  {product.nutrition.fat && (
                    <div>
                      <span className="text-sm text-gray-600">Lipides</span>
                      <p className="font-medium">{product.nutrition.fat}g</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ingrédients */}
            {product.ingredients && product.ingredients.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Ingrédients</h2>
                <p className="text-gray-700">{product.ingredients.join(', ')}</p>
              </div>
            )}

            {/* Allergènes */}
            {product.allergens && product.allergens.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Allergènes</h2>
                <p className="text-gray-700">{product.allergens.join(', ')}</p>
              </div>
            )}

            {/* Conditions de conservation */}
            {product.storageConditions && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Conditions de conservation</h2>
                <p className="text-gray-700">{product.storageConditions}</p>
              </div>
            )}

            {/* Instructions de préparation */}
            {product.preparationInstructions && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Instructions de préparation</h2>
                <p className="text-gray-700">{product.preparationInstructions}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails; 