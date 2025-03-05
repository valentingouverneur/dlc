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

    try {
      const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      if (response.data.status === 1 && response.data.product) {
        setProduct(response.data.product);
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
    if (!product || !expiryDate) return;

    try {
      await addDoc(collection(db, 'products'), {
        name: product.product_name || 'Produit inconnu',
        brand: product.brands || 'Marque inconnue',
        barcode: barcode,
        expiryDate: new Date(expiryDate),
        imageUrl: product.image_url,
        createdAt: new Date()
      });
      onClose();
    } catch (err) {
      setError('Erreur lors de l\'enregistrement du produit');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center mb-4">
        <button
          onClick={() => setScanning(!scanning)}
          className={`px-4 py-2 rounded-lg ${
            scanning
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white transition-colors`}
        >
          {scanning ? 'Arrêter le scan' : 'Démarrer le scan'}
        </button>
      </div>

      {scanning && (
        <div id="reader" className="w-full max-w-md mx-auto" />
      )}

      {!scanning && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code-barres
            </label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Entrez le code-barres"
            />
          </div>

          {loading ? (
            <div className="text-center text-gray-600">Chargement...</div>
          ) : error ? (
            <div className="text-red-500 text-center">{error}</div>
          ) : product ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                {product.image_url && (
                  <img
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
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={!expiryDate}
                className="w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Enregistrer
              </button>
            </div>
          ) : (
            <button
              onClick={() => setScanning(true)}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
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