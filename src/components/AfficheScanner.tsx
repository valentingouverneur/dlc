import React, { useState, useRef, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { OCRService } from '../services/OCRService';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Affiche } from '../types/Affiche';

interface AfficheScannerProps {
  onClose: () => void;
}

interface Html5QrcodeScannerConfig {
  fps: number;
  qrbox: { width: number; height: number };
  aspectRatio: number;
}

const AfficheScanner: React.FC<AfficheScannerProps> = ({ onClose }) => {
  const [step, setStep] = useState<'barcode' | 'photo' | 'processing' | 'result'>('barcode');
  const [ean, setEan] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Scanner de code-barres
  useEffect(() => {
    if (step === 'barcode') {
      const config: Html5QrcodeScannerConfig = {
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
        (decodedText: string) => {
          setEan(decodedText);
          if (scannerRef.current) {
            scannerRef.current.clear();
            scannerRef.current = null;
          }
          setStep('photo');
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

  // Démarrer la caméra pour la photo
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Impossible d\'accéder à la caméra');
      console.error(err);
    }
  };

  // Arrêter la caméra
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Prendre la photo
  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhoto(photoDataUrl);
        stopCamera();
        setStep('processing');
        processOCR(photoDataUrl);
      }
    }
  };

  // Traitement OCR
  const processOCR = async (imageDataUrl: string) => {
    setLoading(true);
    setError('');
    
    try {
      const text = await OCRService.extractTextFromImage(imageDataUrl);
      const parsed = OCRService.parseLabelText(text);
      
      setExtractedData({
        ...parsed,
        rawText: text
      });
      
      // Supprimer la photo de la mémoire (elle n'est plus dans le state)
      setPhoto(null);
      setStep('result');
    } catch (err) {
      setError('Erreur lors de l\'extraction du texte');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Enregistrer dans Firestore
  const handleSave = async () => {
    if (!ean || !extractedData) return;

    setSaving(true);
    try {
      const afficheData: Omit<Affiche, 'id'> = {
        ean,
        designation: extractedData.designation || 'Produit sans nom',
        weight: extractedData.weight,
        price: extractedData.price,
        pricePerKg: extractedData.pricePerKg,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'affiches'), afficheData);
      onClose();
    } catch (err) {
      setError('Erreur lors de l\'enregistrement');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Nettoyage
  useEffect(() => {
    return () => {
      stopCamera();
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

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
          <h3 className="text-lg font-medium mb-4">Étape 1 : Scanner le code-barres</h3>
          <div id="barcode-scanner" className="w-full max-w-md mx-auto" />
        </div>
      )}

      {/* Étape 2 : Prendre la photo de l'étiquette */}
      {step === 'photo' && (
        <div>
          <h3 className="text-lg font-medium mb-4">Étape 2 : Photographier l'étiquette</h3>
          <div className="relative">
            {!streamRef.current ? (
              <button
                onClick={startCamera}
                className="w-full px-4 py-3 bg-black text-white rounded-lg"
              >
                Démarrer la caméra
              </button>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg"
                />
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={takePhoto}
                    className="px-6 py-3 bg-black text-white rounded-lg"
                  >
                    Prendre la photo
                  </button>
                </div>
              </>
            )}
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      )}

      {/* Étape 3 : Traitement OCR */}
      {step === 'processing' && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Extraction des informations...</p>
        </div>
      )}

      {/* Étape 4 : Résultat et validation */}
      {step === 'result' && extractedData && (
        <div>
          <h3 className="text-lg font-medium mb-4">Informations extraites</h3>
          <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-700">Code-barres (EAN)</label>
              <input
                type="text"
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Désignation</label>
              <input
                type="text"
                value={extractedData.designation}
                onChange={(e) => setExtractedData({ ...extractedData, designation: e.target.value })}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Poids</label>
              <input
                type="text"
                value={extractedData.weight || ''}
                onChange={(e) => setExtractedData({ ...extractedData, weight: e.target.value })}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                placeholder="ex: 500g"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Prix</label>
              <input
                type="text"
                value={extractedData.price || ''}
                onChange={(e) => setExtractedData({ ...extractedData, price: e.target.value })}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                placeholder="ex: 29,99 €"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Prix au kg</label>
              <input
                type="text"
                value={extractedData.pricePerKg || ''}
                onChange={(e) => setExtractedData({ ...extractedData, pricePerKg: e.target.value })}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                placeholder="ex: 59,98 €/kg"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
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

      {step !== 'processing' && step !== 'result' && (
        <button
          onClick={onClose}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Annuler
        </button>
      )}
    </div>
  );
};

export default AfficheScanner;

