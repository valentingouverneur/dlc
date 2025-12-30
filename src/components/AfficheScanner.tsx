import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { OCRService } from '../services/OCRService';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Affiche } from '../types/Affiche';
import axios from 'axios';

interface AfficheScannerProps {
  onClose: () => void;
}

const AfficheScanner: React.FC<AfficheScannerProps> = ({ onClose }) => {
  const [step, setStep] = useState<'barcode' | 'processing' | 'result'>('barcode');
  const [ean, setEan] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [openFoodData, setOpenFoodData] = useState<any>(null);
  
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
        'barcode-scanner',
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
    try {
      const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      console.log('Open Food Facts response status:', response.data.status);
      if (response.data.status === 1 && response.data.product) {
        const product = response.data.product;
        console.log('Product trouvé:', product.product_name);
        
        // Récupérer l'image (priorité: front > url > ingredients > nutrition)
        const imageUrl = product.image_front_url || 
                        product.image_url || 
                        product.image_ingredients_url || 
                        product.image_nutrition_url ||
                        product.image_front_small_url ||
                        product.image_small_url ||
                        '';
        
        console.log('Image URL récupérée:', imageUrl);
        console.log('Toutes les images disponibles:', {
          image_front_url: product.image_front_url,
          image_url: product.image_url,
          image_ingredients_url: product.image_ingredients_url,
          image_nutrition_url: product.image_nutrition_url,
          image_front_small_url: product.image_front_small_url,
          image_small_url: product.image_small_url
        });
        
        setOpenFoodData({
          designation: product.product_name_fr || product.product_name || product.generic_name || '',
          brand: product.brands || '',
          weight: product.quantity || '',
          imageUrl: imageUrl,
        });
      } else {
        console.log('Produit non trouvé dans Open Food Facts pour EAN:', barcode);
      }
    } catch (err) {
      console.warn('Erreur Open Food Facts:', err);
      // Pas grave si ça échoue
    }
  };


  // Enregistrer dans Firestore
  const handleSave = async (closeAfterSave: boolean = true) => {
    if (!ean) {
      setError('Le code-barres (EAN) est obligatoire');
      return;
    }

    setSaving(true);
    setError('');
    try {
      // Construire l'objet en excluant les valeurs undefined
      const afficheData: any = {
        ean,
        designation: openFoodData?.designation || extractedData?.designation || 'Produit sans nom',
        createdAt: new Date().toISOString()
      };

      // Ajouter les champs optionnels seulement s'ils existent
      if (extractedData?.weight || openFoodData?.weight) {
        afficheData.weight = extractedData?.weight || openFoodData?.weight;
      }
      if (extractedData?.price) {
        afficheData.price = extractedData.price;
      }
      if (extractedData?.pricePerKg) {
        afficheData.pricePerKg = extractedData.pricePerKg;
      }
      if (openFoodData?.imageUrl) {
        afficheData.imageUrl = openFoodData.imageUrl;
        console.log('Sauvegarde imageUrl:', openFoodData.imageUrl);
      } else {
        console.log('Pas d\'imageUrl à sauvegarder');
      }
      
      console.log('Données à sauvegarder:', afficheData);

      await addDoc(collection(db, 'affiches'), afficheData);
      
      if (closeAfterSave) {
        onClose();
      } else {
        // Réinitialiser pour scanner un autre article
        setEan('');
        setExtractedData(null);
        setOpenFoodData(null);
        setError('');
        setStep('barcode');
        // Réinitialiser le scanner
        if (scannerRef.current) {
          scannerRef.current.clear();
          scannerRef.current = null;
        }
      }
    } catch (err: any) {
      console.error('Erreur Firestore:', err);
      let errorMessage = 'Erreur lors de l\'enregistrement';
      
      if (err.code === 'permission-denied') {
        errorMessage = 'Permission refusée. Vérifiez les règles Firestore.';
      } else if (err.code === 'unavailable') {
        errorMessage = 'Firestore indisponible. Vérifiez votre connexion.';
      } else if (err.message) {
        errorMessage = `Erreur: ${err.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setSaving(false);
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
          <div id="barcode-scanner" className="w-full max-w-md mx-auto" />
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
          {openFoodData && (
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
                value={openFoodData?.designation || extractedData?.designation || ''}
                onChange={(e) => setExtractedData({ ...extractedData, designation: e.target.value })}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                placeholder="Nom du produit"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Poids</label>
              <input
                type="text"
                value={extractedData?.weight || openFoodData?.weight || ''}
                onChange={(e) => setExtractedData({ ...extractedData, weight: e.target.value })}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                placeholder="ex: 500g"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Prix</label>
              <input
                type="text"
                value={extractedData?.price || ''}
                onChange={(e) => setExtractedData({ ...extractedData, price: e.target.value })}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                placeholder="ex: 29,99 €"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Prix au kg</label>
              <input
                type="text"
                value={extractedData?.pricePerKg || ''}
                onChange={(e) => setExtractedData({ ...extractedData, pricePerKg: e.target.value })}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                placeholder="ex: 59,98 €/kg"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saving || !ean}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer et scanner un autre'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Fermer
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving || !ean}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AfficheScanner;
