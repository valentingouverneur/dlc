import React, { useState, useRef, useEffect, useCallback } from 'react';
import { OCRService } from '../services/OCRService';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Affiche } from '../types/Affiche';

interface AfficheScannerProps {
  onClose: () => void;
}

const AfficheScanner: React.FC<AfficheScannerProps> = ({ onClose }) => {
  const [step, setStep] = useState<'photo' | 'processing' | 'result'>('photo');
  const [ean, setEan] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Arrêter la caméra
  const stopCamera = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  // Démarrer la caméra pour la photo
  const startCamera = useCallback(async () => {
    try {
      setError('');
      setCameraReady(false);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        
        // Essayer de jouer la vidéo
        try {
          await video.play();
          console.log('Video.play() réussi');
        } catch (playErr) {
          console.warn('Erreur play():', playErr);
        }
        
        // Afficher la vidéo immédiatement si le stream est actif
        // On ne bloque plus sur la détection des dimensions
        if (stream.active) {
          console.log('Stream actif, on affiche la vidéo');
          // Attendre un peu pour que la vidéo se charge
          setTimeout(() => {
            setCameraReady(true);
          }, 500);
        }
        
        // Vérifier périodiquement que la vidéo est vraiment prête
        // La vidéo est prête quand elle a des dimensions valides
        const checkVideoReady = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            console.log('Caméra prête:', { width: video.videoWidth, height: video.videoHeight });
            if (checkIntervalRef.current) {
              clearInterval(checkIntervalRef.current);
              checkIntervalRef.current = null;
            }
            setCameraReady(true);
            return true;
          }
          return false;
        };
        
        // Vérifier immédiatement
        if (checkVideoReady()) {
          return;
        }
        
        // Sinon, vérifier toutes les 100ms avec un timeout de 3 secondes
        let attempts = 0;
        const maxAttempts = 30; // 30 * 100ms = 3 secondes
        
        checkIntervalRef.current = setInterval(() => {
          attempts++;
          if (checkVideoReady() || attempts >= maxAttempts) {
            if (checkIntervalRef.current) {
              clearInterval(checkIntervalRef.current);
              checkIntervalRef.current = null;
            }
            // Même si on n'a pas de dimensions, si le stream est actif, on affiche quand même
            if (attempts >= maxAttempts && !checkVideoReady()) {
              if (streamRef.current && streamRef.current.active) {
                console.log('Timeout mais stream actif, on force cameraReady');
                setCameraReady(true);
              }
            }
          }
        }, 100);
      }
    } catch (err: any) {
      let errorMessage = 'Impossible d\'accéder à la caméra';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'L\'accès à la caméra a été refusé. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'Aucune caméra n\'a été trouvée sur votre appareil.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'La caméra est peut-être utilisée par une autre application.';
      } else {
        errorMessage = `Erreur: ${err.message}`;
      }
      
      setError(errorMessage);
      console.error('Erreur caméra:', err);
      setCameraReady(false);
    }
  }, []);

  // Démarrer la caméra automatiquement
  useEffect(() => {
    if (step === 'photo') {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step, startCamera, stopCamera]);

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
      
      // Utiliser l'EAN extrait par OCR ou laisser vide pour saisie manuelle
      setEan(parsed.ean || '');
      
      setExtractedData({
        ...parsed,
        rawText: text
      });
      
      // Supprimer la photo de la mémoire
      setPhoto(null);
      setStep('result');
    } catch (err) {
      setError('Erreur lors de l\'extraction du texte. Veuillez réessayer.');
      console.error('Erreur OCR:', err);
      setStep('photo');
    } finally {
      setLoading(false);
    }
  };

  // Enregistrer dans Firestore
  const handleSave = async () => {
    if (!ean || !extractedData) {
      setError('Le code-barres (EAN) est obligatoire');
      return;
    }

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
    };
  }, [stopCamera]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Étape 1 : Prendre la photo de l'étiquette */}
      {step === 'photo' && (
        <div>
          <h3 className="text-lg font-medium mb-4">Photographier l'étiquette</h3>
          {streamRef.current && streamRef.current.active ? (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg"
              />
              <div className="mt-4 flex justify-center">
                <button
                  onClick={takePhoto}
                  disabled={!cameraReady}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cameraReady ? 'Prendre la photo' : 'Chargement...'}
                </button>
              </div>
              {!cameraReady && (
                <p className="text-center text-sm text-gray-500 mt-2">
                  Attente de la caméra...
                </p>
              )}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-black text-white rounded-lg"
              >
                Réessayer
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
              <p className="text-gray-600">Démarrage de la caméra...</p>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      )}

      {/* Étape 2 : Traitement OCR */}
      {step === 'processing' && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Extraction des informations...</p>
          <p className="text-sm text-gray-500 mt-2">Cela peut prendre quelques secondes</p>
        </div>
      )}

      {/* Étape 3 : Résultat et validation */}
      {step === 'result' && extractedData && (
        <div>
          <h3 className="text-lg font-medium mb-4">Informations extraites</h3>
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
                placeholder="Saisir ou scanner le code-barres"
                required
              />
              {extractedData.ean && extractedData.ean !== ean && (
                <p className="text-xs text-gray-500 mt-1">
                  EAN détecté par OCR: {extractedData.ean}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Désignation</label>
              <input
                type="text"
                value={extractedData.designation}
                onChange={(e) => setExtractedData({ ...extractedData, designation: e.target.value })}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Poids</label>
              <input
                type="text"
                value={extractedData.weight || ''}
                onChange={(e) => setExtractedData({ ...extractedData, weight: e.target.value })}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                placeholder="ex: 500g"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Prix</label>
              <input
                type="text"
                value={extractedData.price || ''}
                onChange={(e) => setExtractedData({ ...extractedData, price: e.target.value })}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                placeholder="ex: 29,99 €"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Prix au kg</label>
              <input
                type="text"
                value={extractedData.pricePerKg || ''}
                onChange={(e) => setExtractedData({ ...extractedData, pricePerKg: e.target.value })}
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                placeholder="ex: 59,98 €/kg"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => {
                stopCamera();
                setStep('photo');
                setEan('');
                setExtractedData(null);
                setError('');
                setCameraReady(false);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reprendre une photo
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
