import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Affiche } from '../types/Affiche';
import Modal from '../components/Modal';
import AfficheScanner from '../components/AfficheScanner';
import ConfirmModal from '../components/ConfirmModal';
import axios from 'axios';

const Affiches: React.FC = () => {
  const [affiches, setAffiches] = useState<Affiche[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [afficheToDelete, setAfficheToDelete] = useState<Affiche | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');

  useEffect(() => {
    const q = query(collection(db, 'affiches'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const affichesData = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Affiche chargée:', { id: doc.id, ean: data.ean, imageUrl: data.imageUrl });
        return {
          id: doc.id,
          ...data
        };
      }) as Affiche[];
      setAffiches(affichesData.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (afficheId: string) => {
    try {
      await deleteDoc(doc(db, 'affiches', afficheId));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Pas de modal, copie silencieuse
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  // Fonction pour mettre à jour les images manquantes depuis Open Food Facts
  const updateMissingImages = async () => {
    const affichesWithoutImage = affiches.filter(a => !a.imageUrl && a.ean);
    if (affichesWithoutImage.length === 0) {
      alert('Tous les produits ont déjà une image');
      return;
    }

    if (!confirm(`Mettre à jour ${affichesWithoutImage.length} produit(s) sans image ?`)) {
      return;
    }

    let updated = 0;
    let failed = 0;

    for (const affiche of affichesWithoutImage) {
      try {
        const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${affiche.ean}.json`);
        if (response.data.status === 1 && response.data.product) {
          const product = response.data.product;
          
          // Convertir vers haute résolution
          const convertToHighRes = (url: string | undefined): string => {
            if (!url) return '';
            return url.replace(/\/images\/products\/(\d+)\/(\d+)\/(\d+)\.jpg$/, '/images/products/$1/$2/full/$2.jpg');
          };
          
          let imageUrl = '';
          if (product.image_front_url) {
            imageUrl = convertToHighRes(product.image_front_url) || product.image_front_url;
          }
          else if (product.image_url) {
            imageUrl = convertToHighRes(product.image_url) || product.image_url;
          }
          else if (product.image_front_small_url) {
            imageUrl = convertToHighRes(product.image_front_small_url) || product.image_front_small_url;
          }
          else if (product.image_ingredients_url) {
            imageUrl = convertToHighRes(product.image_ingredients_url) || product.image_ingredients_url;
          }
          else if (product.image_nutrition_url) {
            imageUrl = convertToHighRes(product.image_nutrition_url) || product.image_nutrition_url;
          }
          else if (product.image_small_url) {
            imageUrl = convertToHighRes(product.image_small_url) || product.image_small_url;
          }
          
          if (imageUrl && affiche.id) {
            await updateDoc(doc(db, 'affiches', affiche.id), { imageUrl });
            updated++;
          }
        }
      } catch (err) {
        console.error(`Erreur pour ${affiche.ean}:`, err);
        failed++;
      }
    }

    alert(`Mise à jour terminée : ${updated} mis à jour, ${failed} échecs`);
  };

  const filteredAffiches = affiches.filter(affiche =>
    affiche.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    affiche.ean.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Affiches</h1>
        <div className="flex space-x-2">
          <button
            onClick={updateMissingImages}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            title="Mettre à jour les images manquantes depuis Open Food Facts"
          >
            Mettre à jour les images
          </button>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Scanner une étiquette
          </button>
        </div>
      </div>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Rechercher par désignation ou EAN..."
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">EAN</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Photo</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Désignation</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Poids</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prix</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prix/kg</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAffiches.map((affiche) => (
              <tr
                key={affiche.id}
                className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm">{affiche.ean}</span>
                    <button
                      onClick={() => copyToClipboard(affiche.ean)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      title="Copier l'EAN"
                    >
                      📋
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {affiche.imageUrl ? (
                    <img
                      src={affiche.imageUrl}
                      alt={affiche.designation}
                      className="w-12 h-12 object-cover rounded cursor-move hover:opacity-80 transition-opacity border border-gray-200"
                      onClick={() => {
                        setSelectedImageUrl(affiche.imageUrl!);
                        setImageModalOpen(true);
                      }}
                      draggable
                      onDragStart={async (e) => {
                        try {
                          // Télécharger l'image pour le drag and drop
                          const response = await fetch(affiche.imageUrl!);
                          const blob = await response.blob();
                          const file = new File([blob], `${affiche.ean}.jpg`, { type: 'image/jpeg' });
                          
                          // Utiliser DataTransfer pour le drag and drop de fichier
                          const dataTransfer = e.dataTransfer;
                          dataTransfer.effectAllowed = 'copy';
                          dataTransfer.setData('text/plain', affiche.imageUrl!);
                          dataTransfer.setData('text/uri-list', affiche.imageUrl!);
                          
                          // Ajouter le fichier pour le drag and drop
                          if (dataTransfer.items) {
                            dataTransfer.items.add(file);
                          }
                          
                          // Créer une image de prévisualisation pour le drag
                          const img = new Image();
                          img.src = affiche.imageUrl!;
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                              ctx.drawImage(img, 0, 0);
                              dataTransfer.setDragImage(canvas, img.width / 2, img.height / 2);
                            }
                          };
                        } catch (err) {
                          console.error('Erreur lors du drag:', err);
                          // Fallback simple
                          e.dataTransfer.setData('text/plain', affiche.imageUrl!);
                        }
                      }}
                      title="Cliquer pour agrandir ou glisser-déposer vers votre logiciel"
                    />
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{affiche.designation}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{affiche.weight || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{affiche.price || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{affiche.pricePerKg || '-'}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => {
                      setAfficheToDelete(affiche);
                      setDeleteModalOpen(true);
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Supprimer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAffiches.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {searchTerm ? 'Aucun résultat' : 'Aucune affiche enregistrée'}
        </div>
      )}

      <Modal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        title="Scanner une étiquette"
      >
        <AfficheScanner onClose={() => setIsScannerOpen(false)} />
      </Modal>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={() => {
          if (afficheToDelete?.id) {
            handleDelete(afficheToDelete.id);
          }
          setDeleteModalOpen(false);
        }}
        title="Supprimer l'affiche"
        message={`Êtes-vous sûr de vouloir supprimer ${afficheToDelete?.designation} ?`}
      />

      {/* Modale pour voir l'image en taille réelle */}
      {imageModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setImageModalOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-4">
            <img
              src={selectedImageUrl}
              alt="Produit"
              className="max-w-full max-h-[90vh] object-contain rounded-lg cursor-move"
              onClick={(e) => e.stopPropagation()}
              draggable
              onDragStart={async (e) => {
                try {
                  // Télécharger l'image pour le drag and drop
                  const response = await fetch(selectedImageUrl);
                  const blob = await response.blob();
                  const file = new File([blob], 'produit.jpg', { type: 'image/jpeg' });
                  
                  const dataTransfer = e.dataTransfer;
                  dataTransfer.effectAllowed = 'copy';
                  dataTransfer.setData('text/plain', selectedImageUrl);
                  dataTransfer.setData('text/uri-list', selectedImageUrl);
                  
                  if (dataTransfer.items) {
                    dataTransfer.items.add(file);
                  }
                  
                  // Prévisualisation
                  const img = new Image();
                  img.src = selectedImageUrl;
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.drawImage(img, 0, 0);
                      dataTransfer.setDragImage(canvas, img.width / 2, img.height / 2);
                    }
                  };
                } catch (err) {
                  console.error('Erreur lors du drag:', err);
                  e.dataTransfer.setData('text/plain', selectedImageUrl);
                }
              }}
              title="Glisser-déposer vers votre logiciel"
            />
            <button
              onClick={() => setImageModalOpen(false)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Affiches;

