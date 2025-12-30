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
  const [debugInfo, setDebugInfo] = useState<string>('');
  
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

  // Mettre à jour les infos de debug
  const updateDebugInfo = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    
    const info = [
      `Stream: ${stream ? (stream.active ? 'ACTIF' : 'INACTIF') : 'NULL'}`,
      `Video: ${video ? 'EXISTE' : 'NULL'}`,
      `Video srcObject: ${video?.srcObject ? 'OUI' : 'NON'}`,
      `Video dimensions: ${video ? `${video.videoWidth}x${video.videoHeight}` : 'N/A'}`,
      `Video readyState: ${video ? video.readyState : 'N/A'}`,
      `Video paused: ${video ? video.paused : 'N/A'}`,
      `Camera ready: ${cameraReady ? 'OUI' : 'NON'}`,
    ];
    
    setDebugInfo(info.join(' | '));
  }, [cameraReady]);

  // Démarrer la caméra pour la photo
  const startCamera = useCallback(async () => {
    try {
      setError('');
      setCameraReady(false);
      setDebugInfo('Démarrage...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      streamRef.current = stream;
      setDebugInfo('Stream obtenu, actif: ' + stream.active + ' | Attente assignation dans useEffect');
      
      // L'assignation du srcObject sera faite dans le useEffect séparé
      // qui se déclenche quand la vidéo est montée
      
      // Vérifier périodiquement que la vidéo est vraiment prête
      const checkVideoReady = () => {
        if (!videoRef.current) return false;
        const video = videoRef.current;
        updateDebugInfo();
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          setCameraReady(true);
          setDebugInfo(prev => prev + ' | CAMERA READY (dimensions OK)');
          return true;
        }
        return false;
      };
      
      // Vérifier immédiatement
      if (checkVideoReady()) {
        return;
      }
      
      // Sinon, vérifier toutes les 200ms avec un timeout de 5 secondes
      let attempts = 0;
      const maxAttempts = 25; // 25 * 200ms = 5 secondes
      
      checkIntervalRef.current = setInterval(() => {
        attempts++;
        updateDebugInfo();
        if (checkVideoReady() || attempts >= maxAttempts) {
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          // Même si on n'a pas de dimensions, si le stream est actif, on force
          if (attempts >= maxAttempts && !checkVideoReady()) {
            if (streamRef.current && streamRef.current.active) {
              setCameraReady(true);
              setDebugInfo(prev => prev + ' | FORCE READY (stream actif)');
            } else {
              setDebugInfo(prev => prev + ' | TIMEOUT');
            }
          }
        }
      }, 200);
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
      setDebugInfo('ERREUR: ' + err.name + ' - ' + err.message);
      setCameraReady(false);
    }
  }, [updateDebugInfo]);

  // Assigner le stream à la vidéo quand elle est montée
  useEffect(() => {
    if (step === 'photo' && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      const stream = streamRef.current;
      
      // Vérifier que la vidéo est dans le DOM
      if (!video.isConnected) {
        setDebugInfo(prev => prev + ' | ERREUR: video pas dans le DOM');
        return;
      }
      
      if (video.srcObject !== stream) {
        setDebugInfo(prev => prev + ' | Assignation srcObject dans useEffect');
        try {
          video.srcObject = stream;
          // Vérifier immédiatement
          if (video.srcObject === stream) {
            setDebugInfo(prev => prev + ' | srcObject assigné OK');
            video.play().catch((err: any) => {
              setDebugInfo(prev => prev + ' | play() ERREUR: ' + err.message);
            });
          } else {
            setDebugInfo(prev => prev + ' | ERREUR: srcObject non assigné après tentative');
          }
          updateDebugInfo();
        } catch (err: any) {
          setDebugInfo(prev => prev + ' | EXCEPTION lors assignation: ' + err.message);
        }
      } else {
        // Si déjà assigné, juste essayer de jouer
        video.play().catch((err: any) => {
          setDebugInfo(prev => prev + ' | play() ERREUR: ' + err.message);
        });
      }
    }
  }, [step, updateDebugInfo]);

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

  // Mettre à jour les infos de debug périodiquement
  useEffect(() => {
    if (step === 'photo') {
      const interval = setInterval(() => {
        updateDebugInfo();
      }, 500);
      return () => clearInterval(interval);
    }
  }, [step, updateDebugInfo]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Debug info */}
      {debugInfo && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded text-xs font-mono break-all">
          <strong>Debug:</strong> {debugInfo}
        </div>
      )}

      {/* Étape 1 : Prendre la photo de l'étiquette */}
      {step === 'photo' && (
        <div>
          <h3 className="text-lg font-medium mb-4">Photographier l'étiquette</h3>
          {/* Toujours rendre la vidéo dans le DOM, même si le stream n'est pas encore prêt */}
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full rounded-lg ${streamRef.current && streamRef.current.active ? '' : 'hidden'}`}
            />
            {!streamRef.current || !streamRef.current.active ? (
              error ? (
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
              )
            ) : (
              <>
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
              </>
            )}
          </div>
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
