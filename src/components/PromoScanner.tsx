import React, { useState, useRef, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import { ImageSearchService } from '../services/ImageSearchService';

interface PromoScannerProps {
  onClose: () => void;
  onProductScanned: (ean: string, designation: string, imageUrl: string) => void;
}

const PromoScanner: React.FC<PromoScannerProps> = ({ onClose, onProductScanned }) => {
  const [step, setStep] = useState<'barcode' | 'result'>('barcode');
  const [ean, setEan] = useState('');
  const [openFoodData, setOpenFoodData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Scanner de code-barres
  useEffect(() => {
    if (step === 'barcode') {
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      scannerRef.current = new Html5QrcodeScanner(
        'promo-barcode-scanner',
        config,
        false
      );

      scannerRef.current.render(
        async (decodedText: string) => {
          // Vérifier que c'est un EAN valide (13 chiffres)
          if (/^\d{13}$/.test(decodedText)) {
            setEan(decodedText);
            if (scannerRef.current) {
              scannerRef.current.clear();
              scannerRef.current = null;
            }
            // Récupérer les infos depuis Open Food Facts
            await fetchOpenFoodData(decodedText);
            setStep('result');
          }
        },
        (errorMessage: string) => {
          // Ignorer les erreurs de scan
        }
      );

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear();
        }
      };
    }
  }, [step]);

  // Récupérer les données depuis Open Food Facts
  const fetchOpenFoodData = async (barcode: string) => {
    setLoading(true);
    try {
      const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      if (response.data.status === 1 && response.data.product) {
        const product = response.data.product;
        const designation = product.product_name_fr || product.product_name || product.generic_name || '';
        
        // Rechercher une image depuis Google Images
        const googleImage = await ImageSearchService.searchImage(barcode, designation);
        
        setOpenFoodData({
          designation: designation,
          imageUrl: googleImage || ''
        });
      } else {
        // Essayer quand même Google Images même si pas trouvé sur Open Food Facts
        const googleImage = await ImageSearchService.searchImage(barcode);
        if (googleImage) {
          setOpenFoodData({
            designation: '',
            imageUrl: googleImage,
          });
        }
      }
    } catch (err) {
      console.warn('Erreur Open Food Facts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Enregistrer le produit
  const handleSave = () => {
    if (!ean) {
      setError('Le code-barres (EAN) est obligatoire');
      return;
    }

    const designation = openFoodData?.designation || '';
    const imageUrl = openFoodData?.imageUrl || '';
    
    onProductScanned(ean, designation, imageUrl);
    onClose();
  };

  // Réinitialiser pour scanner un autre
  const handleScanAnother = () => {
    setEan('');
    setOpenFoodData(null);
    setError('');
    setStep('barcode');
    // Réinitialiser le scanner
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Étape 1 : Scanner le code-barres */}
      {step === 'barcode' && (
        <div>
          <h3 className="text-lg font-medium mb-4">Scanner le code-barres</h3>
          <div id="promo-barcode-scanner" className="w-full max-w-md mx-auto" />
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                if (scannerRef.current) {
                  scannerRef.current.clear();
                }
                setStep('result');
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Ou saisir manuellement
            </button>
          </div>
        </div>
      )}

      {/* Étape 2 : Résultat et validation */}
      {step === 'result' && (
        <div>
          <h3 className="text-lg font-medium mb-4">Informations du produit</h3>
          {loading && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Récupération des informations...
              </p>
            </div>
          )}
          {openFoodData && !loading && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ Données récupérées depuis Open Food Facts
              </p>
            </div>
          )}
          <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Code-barres (EAN) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                placeholder="13 chiffres"
                required
                maxLength={13}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Désignation</label>
              <input
                type="text"
                value={openFoodData?.designation || ''}
                onChange={(e) => setOpenFoodData({ ...openFoodData, designation: e.target.value })}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                placeholder="Nom du produit"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={handleScanAnother}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Scanner un autre
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Fermer
            </button>
            <button
              onClick={handleSave}
              disabled={!ean}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromoScanner;
