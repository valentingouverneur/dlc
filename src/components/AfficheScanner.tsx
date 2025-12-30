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
  const [step, setStep] = useState<'barcode' | 'photo' | 'processing' | 'result'>('barcode');
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
            setStep('photo');
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
      if (response.data.status === 1 && response.data.product) {
        const product = response.data.product;
        setOpenFoodData({
          designation: product.product_name_fr || product.product_name || product.generic_name || '',
          brand: product.brands || '',
          weight: product.quantity || '',
        });
      }
    } catch (err) {
      console.warn('Erreur Open Food Facts:', err);
      // Pas grave si ça échoue
    }
  };

  // Prendre la photo pour OCR (optionnel, pour prix/poids)
  const takePhoto = useCallback(() => {
    // Utiliser l'API de la caméra du navigateur
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        
        video.onloadedmetadata = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const imageSrc = canvas.toDataURL('image/jpeg', 0.8);
            stream.getTracks().forEach(track => track.stop());
            setPhoto(imageSrc);
            setStep('processing');
            processOCR(imageSrc);
          }
        };
      })
      .catch(err => {
        setError('Impossible d\'accéder à la caméra pour la photo');
        console.error(err);
      });
  }, []);

  // Traitement OCR (optionnel, pour prix/poids)
  const processOCR = async (imageDataUrl: string) => {
    setLoading(true);
    setError('');
    
    try {
      const text = await OCRService.extractTextFromImage(imageDataUrl);
      const parsed = OCRService.parseLabelText(text);
      
      setExtractedData({
        weight: parsed.weight,
        price: parsed.price,
        pricePerKg: parsed.pricePerKg,
        rawText: text
      });
      
      setPhoto(null);
      setStep('result');
    } catch (err) {
      // Pas grave si l'OCR échoue, on continue quand même
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  // Enregistrer dans Firestore
  const handleSave = async () => {
    if (!ean) {
      setError('Le code-barres (EAN) est obligatoire');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const afficheData: Omit<Affiche, 'id'> = {
        ean,
        designation: openFoodData?.designation || extractedData?.designation || 'Produit sans nom',
        weight: extractedData?.weight || openFoodData?.weight,
        price: extractedData?.price,
        pricePerKg: extractedData?.pricePerKg,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'affiches'), afficheData);
      onClose();
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
                setStep('photo');
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Ou saisir manuellement
            </button>
          </div>
        </div>
      )}

      {/* Étape 2 : Photo optionnelle pour prix/poids */}
      {step === 'photo' && (
        <div>
          <h3 className="text-lg font-medium mb-4">Photographier l'étiquette (optionnel)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Pour récupérer le prix et le poids automatiquement
          </p>
          <div className="flex justify-center space-x-3">
            <button
              onClick={takePhoto}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Prendre une photo
            </button>
            <button
              onClick={() => setStep('result')}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Passer cette étape
            </button>
          </div>
        </div>
      )}

      {/* Étape 3 : Traitement OCR */}
      {step === 'processing' && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Extraction des informations...</p>
          <p className="text-sm text-gray-500 mt-2">Cela peut prendre quelques secondes</p>
        </div>
      )}

      {/* Étape 4 : Résultat et validation */}
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
              onClick={() => {
                setStep('barcode');
                setEan('');
                setExtractedData(null);
                setOpenFoodData(null);
                setError('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Recommencer
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
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
