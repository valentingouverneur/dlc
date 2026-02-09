import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Product } from '../types/Product';
import { SafeImage } from '../components/SafeImage';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [newImage, setNewImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    expiryDate: ''
  });

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        if (!id) return;
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as Product;
          setProduct({ ...data, id: docSnap.id });
          setFormData({
            name: data.name,
            brand: data.brand,
            expiryDate: new Date(data.expiryDate).toISOString().split('T')[0]
          });
        } else {
          setError('Produit non trouvé');
        }
      } catch (err) {
        setError('Erreur lors du chargement du produit');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Erreur lors de l\'accès à la caméra:', err);
      alert('Impossible d\'accéder à la caméra');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        setNewImage(imageDataUrl);
        stopCamera();
        setIsCameraOpen(false);
      }
    }
  };

  useEffect(() => {
    if (isCameraOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isCameraOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !product) return;

    try {
      const docRef = doc(db, 'products', id);
      const expiryDate = new Date(formData.expiryDate);
      const updateData: Partial<Product> = {
        name: formData.name,
        brand: formData.brand,
        expiryDate,
        ...(newImage && { imageUrl: newImage })
      };

      await updateDoc(docRef, {
        ...updateData,
        expiryDate: expiryDate.toISOString()
      });

      setProduct({
        ...product,
        ...updateData
      });
      
      setIsEditing(false);
      setNewImage(null);
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
      alert('Erreur lors de la mise à jour du produit');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="bg-gray-100 p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
          <div className="text-red-600">{error || 'Produit non trouvé'}</div>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-black text-white rounded-lg"
          >
            Retour au calendrier
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Modifier le produit' : 'Détails du produit'}
            </h1>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800"
            >
              {isEditing ? 'Annuler' : 'Modifier'}
            </button>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  {isCameraOpen ? (
                    <div className="relative w-full max-w-sm">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={takePhoto}
                        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-black text-white rounded-full"
                      >
                        Prendre la photo
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      {newImage ? (
                        <div className="relative inline-block">
                          <SafeImage
                            src={newImage}
                            alt="Nouvelle photo"
                            className="w-32 h-32 object-contain rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => setIsCameraOpen(true)}
                            className="mt-2 px-4 py-2 text-sm bg-black text-white rounded-lg"
                          >
                            Reprendre la photo
                          </button>
                        </div>
                      ) : (
                        <div>
                          {product.imageUrl && (
                            <SafeImage
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-32 h-32 object-contain rounded-lg mx-auto mb-2"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setIsCameraOpen(true)}
                            className="px-4 py-2 text-sm bg-black text-white rounded-lg"
                          >
                            {product.imageUrl ? 'Changer la photo' : 'Ajouter une photo'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nom du produit
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Marque
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Date de péremption
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-black border border-transparent rounded-md hover:bg-gray-800"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                {product.imageUrl && (
                  <SafeImage
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-32 h-32 object-contain rounded-lg"
                  />
                )}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{product.name}</h2>
                  <p className="text-gray-500">{product.brand}</p>
                  <p className="text-gray-600 mt-2">
                    Date de péremption : {new Date(product.expiryDate).toLocaleDateString('fr-FR')}
                  </p>
                  {product.barcode && (
                    <div className="flex items-center space-x-2 mt-2">
                      <p className="text-gray-600">
                        EAN : <span className="font-mono text-sm">{product.barcode}</span>
                      </p>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(product.barcode);
                          } catch (err) {
                            console.error('Erreur lors de la copie:', err);
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        title="Copier l'EAN"
                      >
                        📋
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {product.nutrition && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Informations nutritionnelles</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Calories</p>
                      <p className="text-lg font-medium">{product.nutrition.calories} kcal</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Protéines</p>
                      <p className="text-lg font-medium">{product.nutrition.proteins}g</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Glucides</p>
                      <p className="text-lg font-medium">{product.nutrition.carbohydrates}g</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Lipides</p>
                      <p className="text-lg font-medium">{product.nutrition.fat}g</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Retour au calendrier
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetails; 