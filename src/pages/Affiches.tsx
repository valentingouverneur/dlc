import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Affiche } from '../types/Affiche';
import Modal from '../components/Modal';
import AfficheScanner from '../components/AfficheScanner';
import ConfirmModal from '../components/ConfirmModal';
import axios from 'axios';
import { ImageSearchService } from '../services/ImageSearchService';

const Affiches: React.FC = () => {
  const [affiches, setAffiches] = useState<Affiche[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [afficheToDelete, setAfficheToDelete] = useState<Affiche | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(''); // Format: 'YYYY-MM-DD' ou '' pour toutes
  const [selectedAffiches, setSelectedAffiches] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

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

  const handleSelectAll = () => {
    if (selectAll) {
      // Désélectionner toutes les affiches filtrées
      setSelectedAffiches(new Set());
      setSelectAll(false);
    } else {
      // Sélectionner toutes les affiches filtrées
      const allIds = new Set(filteredAffiches.map(a => a.id!).filter(Boolean));
      setSelectedAffiches(allIds);
      setSelectAll(true);
    }
  };

  const handleSelectAffiche = (afficheId: string) => {
    const newSelected = new Set(selectedAffiches);
    if (newSelected.has(afficheId)) {
      newSelected.delete(afficheId);
    } else {
      newSelected.add(afficheId);
    }
    setSelectedAffiches(newSelected);
    // Mettre à jour selectAll si toutes les affiches filtrées sont sélectionnées
    const allFilteredIds = filteredAffiches.map(a => a.id!).filter(Boolean);
    setSelectAll(newSelected.size === allFilteredIds.length && allFilteredIds.length > 0);
  };

  const handleDeleteSelected = async () => {
    if (selectedAffiches.size === 0) return;
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedAffiches.size} affiche(s) ?`)) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedAffiches).map(id => 
        deleteDoc(doc(db, 'affiches', id))
      );
      await Promise.all(deletePromises);
      setSelectedAffiches(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleExportEANs = async () => {
    if (selectedAffiches.size === 0) return;

    const selectedAffichesList = affiches.filter(a => a.id && selectedAffiches.has(a.id));
    const eanList = selectedAffichesList.map(a => a.ean).join(',');
    
    try {
      await navigator.clipboard.writeText(eanList);
      // Copie silencieuse, pas de modal
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
      alert('Erreur lors de la copie');
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
        // Rechercher uniquement depuis Google Images (packshots professionnels)
        console.log(`Recherche packshot pour ${affiche.ean}...`);
        const googleImage = await ImageSearchService.searchImage(affiche.ean, affiche.designation);
        if (googleImage && affiche.id) {
          await updateDoc(doc(db, 'affiches', affiche.id), { imageUrl: googleImage });
          updated++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error(`Erreur pour ${affiche.ean}:`, err);
        failed++;
      }
    }

    alert(`Mise à jour terminée : ${updated} mis à jour, ${failed} échecs`);
  };

  // Filtrer par date et recherche
  const filteredAffiches = affiches.filter(affiche => {
    // Filtre par date
    if (selectedDate) {
      const afficheDate = new Date(affiche.createdAt).toISOString().split('T')[0];
      if (afficheDate !== selectedDate) {
        return false;
      }
    }
    
    // Filtre par recherche
    return (
      affiche.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      affiche.ean.includes(searchTerm)
    );
  });

  // Récupérer les dates uniques pour le sélecteur
  const uniqueDates = Array.from(
    new Set(
      affiches.map(a => new Date(a.createdAt).toISOString().split('T')[0])
    )
  ).sort((a, b) => b.localeCompare(a)); // Plus récentes en premier

  // Synchroniser selectAll avec la sélection actuelle
  useEffect(() => {
    const allFilteredIds = filteredAffiches.map(a => a.id!).filter(Boolean);
    setSelectAll(selectedAffiches.size === allFilteredIds.length && allFilteredIds.length > 0);
  }, [selectedAffiches, filteredAffiches]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-2 sm:px-6 py-4 w-full">
        <div className="flex justify-between items-center">
          <h1 className="text-xl sm:text-3xl font-semibold text-gray-900">Affiches</h1>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportEANs}
              disabled={selectedAffiches.size === 0}
              className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2"
            >
              <span className="hidden sm:inline">EXPORT</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center space-x-1 sm:space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">SCANNER</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="border-b border-gray-200 bg-white px-2 sm:px-6 py-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par désignation ou EAN..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm cursor-pointer"
            >
              <option value="">Toutes les dates</option>
              {uniqueDates.map(date => {
                const dateObj = new Date(date);
                const formattedDate = dateObj.toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
                return (
                  <option key={date} value={date}>
                    {formattedDate}
                  </option>
                );
              })}
            </select>
            <button
              onClick={updateMissingImages}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>Plus de filtres</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="border-b border-gray-200 bg-white px-2 sm:px-6 py-3">
        <div className="flex items-center space-x-6">
          <span className="text-sm font-medium text-green-600 border-b-2 border-green-600 pb-1">
            TOUTES {affiches.length}
          </span>
          <span className="text-sm font-medium text-gray-600">
            FILTRÉES {filteredAffiches.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="px-0 sm:px-6 py-2 sm:py-4 w-full max-w-full">
        <div className="overflow-x-auto bg-white sm:rounded-lg border-0 sm:border border-gray-200 w-full">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    title="Sélectionner tout"
                  />
                </th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">EAN</th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Photo</th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Désignation</th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Poids</th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Prix</th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Prix/kg</th>
                <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAffiches.map((affiche) => (
                <tr
                  key={affiche.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    selectedAffiches.has(affiche.id!) ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-2 sm:px-4 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={affiche.id ? selectedAffiches.has(affiche.id) : false}
                      onChange={() => affiche.id && handleSelectAffiche(affiche.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 sm:px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-900 font-mono">{affiche.ean}</span>
                      <button
                        onClick={() => copyToClipboard(affiche.ean)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        title="Copier l'EAN"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-4 whitespace-nowrap">
                    {affiche.imageUrl ? (
                      <img
                        src={affiche.imageUrl}
                        alt={affiche.designation}
                        className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded cursor-move hover:opacity-80 transition-opacity border border-gray-200"
                        onClick={() => {
                          setSelectedImageUrl(affiche.imageUrl!);
                          setImageModalOpen(true);
                        }}
                        draggable
                        onDragStart={async (e) => {
                          try {
                            const response = await fetch(affiche.imageUrl!);
                            const blob = await response.blob();
                            const file = new File([blob], `${affiche.ean}.jpg`, { type: 'image/jpeg' });
                            
                            const dataTransfer = e.dataTransfer;
                            dataTransfer.effectAllowed = 'copy';
                            dataTransfer.setData('text/plain', affiche.imageUrl!);
                            dataTransfer.setData('text/uri-list', affiche.imageUrl!);
                            
                            if (dataTransfer.items) {
                              dataTransfer.items.add(file);
                            }
                            
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
                            e.dataTransfer.setData('text/plain', affiche.imageUrl!);
                          }
                        }}
                        title="Cliquer pour agrandir ou glisser-déposer"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-4">
                    <div className="text-xs sm:text-sm text-gray-900">{affiche.designation}</div>
                  </td>
                  <td className="px-2 sm:px-4 py-4 whitespace-nowrap">
                    <span className="text-xs sm:text-sm text-gray-600">{affiche.weight || '-'}</span>
                  </td>
                  <td className="px-2 sm:px-4 py-4 whitespace-nowrap">
                    <span className="text-xs sm:text-sm text-gray-600">{affiche.price || '-'}</span>
                  </td>
                  <td className="px-2 sm:px-4 py-4 whitespace-nowrap">
                    <span className="text-xs sm:text-sm text-gray-600">{affiche.pricePerKg || '-'}</span>
                  </td>
                  <td className="px-2 sm:px-4 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => {
                        setAfficheToDelete(affiche);
                        setDeleteModalOpen(true);
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors"
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
      </div>

      {/* Pagination and Results Info */}
      <div className="border-t border-gray-200 bg-white px-2 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Affichage de <span className="font-medium">1</span> à <span className="font-medium">{filteredAffiches.length}</span> sur <span className="font-medium">{filteredAffiches.length}</span> résultats
          </div>
          {selectedAffiches.size > 0 && (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">{selectedAffiches.size} sélectionné(s)</span>
              <button
                onClick={handleExportEANs}
                className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
              >
                Exporter
              </button>
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
              >
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      {filteredAffiches.length === 0 && (
        <div className="px-2 sm:px-6 py-12">
          <div className="text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm ? 'Aucun résultat trouvé' : 'Aucune affiche enregistrée'}
            </p>
          </div>
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

