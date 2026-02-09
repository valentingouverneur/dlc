import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SafeImage } from '../components/SafeImage';
import axios from 'axios';

interface ScannerProps {
  onClose: () => void;
}

interface Html5QrcodeScannerConfig {
  fps: number;
  qrbox: { width: number; height: number };
  aspectRatio: number;
}

const Scanner: React.FC<ScannerProps> = ({ onClose }) => {
  const [barcode, setBarcode] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const config: Html5QrcodeScannerConfig = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };

    scannerRef.current = new Html5QrcodeScanner(
      'reader',
      config,
      false
    );

    scannerRef.current.render(
      (decodedText: string) => {
        handleScan(decodedText);
      },
      (errorMessage: string) => {
        console.warn(errorMessage);
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, []);

  const handleScan = async (decodedText: string) => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    
    setBarcode(decodedText);
    setLoading(true);
    setError('');

    try {
      const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`);
      if (response.data.status === 1 && response.data.product) {
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
      }
    } catch (err) {
      setError('Erreur lors de la recherche du produit');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    console.log('Tentative de sauvegarde avec:', { product, expiryDate });
    if (!product || !expiryDate) {
      console.log('Données manquantes:', { product: !!product, expiryDate: !!expiryDate });
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const productData = {
        name: product.product_name || 'Produit inconnu',
        brand: product.brands || 'Marque inconnue',
        barcode: barcode,
        expiryDate: new Date(expiryDate).toISOString(),
        imageUrl: product.image_url,
        createdAt: new Date().toISOString(),
        nutrition: product.nutriments ? {
          calories: product.nutriments['energy-kcal_100g'] || 0,
          proteins: product.nutriments.proteins_100g || 0,
          carbohydrates: product.nutriments.carbohydrates_100g || 0,
          fat: product.nutriments.fat_100g || 0,
        } : null,
        quantity: product.quantity || '',
        categories: product.categories_tags ? 
          product.categories_tags.map((c: string) => c.replace('fr:', '')).filter(Boolean) : 
          [],
        ingredients: product.ingredients_text_fr ? 
          product.ingredients_text_fr.split(',').map((i: string) => i.trim()).filter(Boolean) : 
          []
      };

      console.log('Données à sauvegarder:', productData);

      const docRef = await addDoc(collection(db, 'products'), productData);
      console.log('Produit enregistré avec succès, ID:', docRef.id);
      alert('Produit enregistré avec succès !');
      onClose();
    } catch (err: any) {
      console.error('Erreur détaillée lors de l\'enregistrement:', err);
      setError(`Erreur lors de l'enregistrement : ${err?.message || 'Erreur inconnue'}`);
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="text-red-500 text-center">{error}</div>}
      
      {!product && (
        <div id="reader" className="w-full max-w-md mx-auto" />
      )}

      {loading && (
        <div className="text-center text-gray-600">Chargement...</div>
      )}

      {product && !loading && (
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            {product.image_url && (
              <SafeImage
                src={product.image_url}
                alt={product.product_name}
                className="w-20 h-20 object-contain"
              />
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

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-black hover:bg-gray-800 text-white transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scanner; 