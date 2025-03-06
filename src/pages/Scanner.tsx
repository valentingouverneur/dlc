import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import axios from 'axios';

interface ScannerProps {
  onClose: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onClose }) => {
  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [manualProduct, setManualProduct] = useState({
    name: '',
    brand: '',
    imageUrl: ''
  });
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (scanning) {
      scannerRef.current = new Html5QrcodeScanner(
        'reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          handleScan(decodedText);
        },
        (errorMessage) => {
          console.warn(errorMessage);
        }
      );
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, [scanning]);

  const handleScan = async (code: string) => {
    setBarcode(code);
    setScanning(false);
    setLoading(true);
    setError('');
    setImageError(false);

    try {
      const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      if (response.data.status === 1 && response.data.product) {
        // Préférence pour les images plus récentes
        const productData = response.data.product;
        const imageUrl = productData.image_front_url || 
                        productData.image_url || 
                        productData.image_ingredients_url || 
                        productData.image_nutrition_url;
        
        setProduct({
          ...productData,
          image_url: imageUrl
        });
      } else {
        setError('Produit non trouvé dans la base de données OpenFoodFacts');
        setManualMode(true);
      }
    } catch (err) {
      setError('Erreur lors de la recherche du produit');
      setManualMode(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualProduct.name || !manualProduct.brand) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setProduct({
      product_name: manualProduct.name,
      brands: manualProduct.brand,
      image_url: manualProduct.imageUrl
    });
    setManualMode(false);
    setImageError(false);
  };

  const handleSave = async () => {
    console.log('Tentative de sauvegarde avec:', { product, expiryDate });
    if (!product || !expiryDate) {
      console.log('Données manquantes:', { product: !!product, expiryDate: !!expiryDate });
      return;
    }

    try {
      console.log('Données à sauvegarder:', {
        name: product.product_name || 'Produit inconnu',
        brand: product.brands || 'Marque inconnue',
        barcode,
        expiryDate: new Date(expiryDate),
        imageUrl: product.image_url
      });

      const docRef = await addDoc(collection(db, 'products'), {
        name: product.product_name || 'Produit inconnu',
        brand: product.brands || 'Marque inconnue',
        barcode: barcode,
        expiryDate: new Date(expiryDate),
        imageUrl: product.image_url,
        createdAt: new Date(),
        // Informations nutritionnelles
        nutrition: product.nutriments ? {
          calories: product.nutriments['energy-kcal_100g'],
          proteins: product.nutriments.proteins_100g,
          carbohydrates: product.nutriments.carbohydrates_100g,
          fat: product.nutriments.fat_100g,
          fiber: product.nutriments.fiber_100g,
          salt: product.nutriments.salt_100g
        } : undefined,
        // Informations supplémentaires
        quantity: product.quantity,
        categories: product.categories_tags?.map((c: string) => c.replace('fr:', '')),
        ingredients: product.ingredients_text_fr 
          ? product.ingredients_text_fr.split(',').map((i: string) => i.trim())
          : undefined,
        allergens: product.allergens_tags
          ? product.allergens_tags.map((a: string) => a.replace('fr:', ''))
          : undefined,
        labels: product.labels_tags
          ? product.labels_tags.map((l: string) => l.replace('fr:', ''))
          : undefined,
        ecoScore: product.ecoscore_grade,
        novaGroup: product.nova_group,
        nutriscore: product.nutriscore_grade,
        // Informations de traçabilité
        origins: product.origins_tags?.map((o: string) => o.replace('fr:', '')),
        manufacturingPlaces: product.manufacturing_places_tags,
        packaging: product.packaging_tags,
        // Informations de conservation
        storageConditions: product.storage_conditions,
        // Informations de consommation
        servingSize: product.serving_size,
        preparationInstructions: product.preparation_instructions
      });

      console.log('Produit enregistré avec succès, ID:', docRef.id);
      alert('Produit enregistré avec succès !');
      onClose();
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement:', err);
      setError('Erreur lors de l\'enregistrement du produit');
    }
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-4 mb-4">
        <button
          onClick={() => setScanning(!scanning)}
          className={`px-4 py-2 rounded-lg ${
            scanning
              ? 'bg-black hover:bg-gray-800'
              : 'bg-black hover:bg-gray-800'
          } text-white transition-colors`}
        >
          {scanning ? 'Arrêter le scan' : 'Scanner un code-barres'}
        </button>
        <button
          onClick={() => {
            setScanning(false);
            setManualMode(true);
            setProduct(null);
            setBarcode('');
          }}
          className="px-4 py-2 rounded-lg bg-black hover:bg-gray-800 text-white transition-colors"
        >
          Saisir manuellement
        </button>
      </div>

      {scanning && (
        <div id="reader" className="w-full max-w-md mx-auto" />
      )}

      {!scanning && (
        <div className="space-y-4">
          {!manualMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code-barres
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                placeholder="Entrez le code-barres"
              />
            </div>
          )}

          {loading ? (
            <div className="text-center text-gray-600">Chargement...</div>
          ) : manualMode ? (
            <div className="space-y-4">
              {error && <div className="text-red-500 text-center">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du produit
                </label>
                <input
                  type="text"
                  value={manualProduct.name}
                  onChange={(e) => setManualProduct({ ...manualProduct, name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="Nom du produit"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Marque
                </label>
                <input
                  type="text"
                  value={manualProduct.brand}
                  onChange={(e) => setManualProduct({ ...manualProduct, brand: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="Marque"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL de l'image (optionnel)
                </label>
                <input
                  type="text"
                  value={manualProduct.imageUrl}
                  onChange={(e) => setManualProduct({ ...manualProduct, imageUrl: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="URL de l'image"
                />
              </div>
              <button
                onClick={handleManualSubmit}
                className="w-full bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Valider les informations
              </button>
            </div>
          ) : product ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                {product.image_url && (
                  <div className="relative w-20 h-20">
                    {imageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
                      </div>
                    )}
                    {imageError ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    ) : (
                      <img
                        src={product.image_url}
                        alt={product.product_name}
                        className="w-20 h-20 object-contain"
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                        style={{ display: imageLoading ? 'none' : 'block' }}
                      />
                    )}
                  </div>
                )}
                <div>
                  <h3 className="font-medium text-gray-900">
                    {product.product_name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {product.brands}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de péremption
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={!expiryDate}
                className="w-full bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Enregistrer
              </button>
            </div>
          ) : (
            <button
              onClick={() => setScanning(true)}
              className="w-full bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Scanner un code-barres
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Scanner; 