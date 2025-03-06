import React, { useState, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface ManualProductFormProps {
  onClose: () => void;
}

const ManualProductForm: React.FC<ManualProductFormProps> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setError(null);
    setTakingPhoto(true);

    // Attendre que le composant vidéo soit monté
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('L\'API MediaDevices n\'est pas disponible sur ce navigateur');
      }

      if (!videoRef.current) {
        throw new Error('La référence video n\'est pas disponible');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: "environment" } },
        audio: false
      });

      // Assigner le stream à la vidéo
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

    } catch (err) {
      let errorMessage = 'Impossible d\'accéder à la caméra';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'L\'accès à la caméra a été refusé. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = 'Aucune caméra n\'a été trouvée sur votre appareil.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage = 'La caméra est peut-être utilisée par une autre application.';
        } else {
          errorMessage = `Erreur: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      setTakingPhoto(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setTakingPhoto(false);
  };

  const takePhoto = () => {
    console.log('Tentative de prise de photo...');
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      console.log('Dimensions de la vidéo:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      });
      
      // Définir les dimensions du canvas pour correspondre à la vidéo
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Dessiner l'image de la vidéo sur le canvas
      const context = canvas.getContext('2d');
      if (context) {
        try {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convertir le canvas en URL de données
          const photoUrl = canvas.toDataURL('image/jpeg', 0.8);
          console.log('Photo prise avec succès');
          setPhoto(photoUrl);
          
          // Arrêter la caméra
          stopCamera();
        } catch (err) {
          console.error('Erreur lors de la prise de photo:', err);
          alert('Erreur lors de la prise de photo');
        }
      }
    } else {
      console.error('Références manquantes:', {
        video: !!videoRef.current,
        canvas: !!canvasRef.current
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, 'products'), {
        name,
        brand,
        expiryDate: new Date(expiryDate).toISOString(),
        createdAt: new Date().toISOString(),
        imageUrl: photo
      });
      onClose();
    } catch (error) {
      console.error('Erreur lors de l\'ajout du produit:', error);
      alert('Erreur lors de l\'ajout du produit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Nom du produit
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2"
        />
      </div>

      <div>
        <label htmlFor="brand" className="block text-sm font-medium text-gray-700">
          Marque
        </label>
        <input
          type="text"
          id="brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2"
        />
      </div>

      <div>
        <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700">
          Date de péremption
        </label>
        <input
          type="date"
          id="expiryDate"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Photo du produit
        </label>
        
        {takingPhoto ? (
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)'
              }}
              className="rounded-lg"
            />
            <button
              type="button"
              onClick={takePhoto}
              className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-black text-white rounded-full shadow-lg"
            >
              Prendre la photo
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {photo ? (
              <div className="relative">
                <img
                  src={photo}
                  alt="Photo du produit"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null);
                    setError(null);
                    startCamera();
                  }}
                  className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 text-white rounded-full"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  startCamera();
                }}
                className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
              >
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M31 28h7a2 2 0 0 0 2-2V12a2 2 0 0 0-2-2h-7m-14 0H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m14-16l-5-5-5 5m5-5v16" />
                  </svg>
                  <span className="mt-2 block text-sm font-medium">
                    Prendre une photo
                  </span>
                </div>
              </button>
            )}
          </div>
        )}
        
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-black border border-transparent rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50"
        >
          {loading ? 'Ajout en cours...' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
};

export default ManualProductForm; 