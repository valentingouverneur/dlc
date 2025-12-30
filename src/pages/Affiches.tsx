import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Affiche } from '../types/Affiche';
import Modal from '../components/Modal';
import AfficheScanner from '../components/AfficheScanner';
import ConfirmModal from '../components/ConfirmModal';

const Affiches: React.FC = () => {
  const [affiches, setAffiches] = useState<Affiche[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [afficheToDelete, setAfficheToDelete] = useState<Affiche | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'affiches'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const affichesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Affiche[];
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copié dans le presse-papier !');
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
        <button
          onClick={() => setIsScannerOpen(true)}
          className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
        >
          Scanner une étiquette
        </button>
      </div>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Rechercher par désignation ou EAN..."
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
      />

      <div className="space-y-4">
        {filteredAffiches.map((affiche) => (
          <div
            key={affiche.id}
            className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-2">{affiche.designation}</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">EAN:</span>
                    <span className="font-mono">{affiche.ean}</span>
                    <button
                      onClick={() => copyToClipboard(affiche.ean)}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                      title="Copier l'EAN"
                    >
                      📋
                    </button>
                  </div>
                  {affiche.weight && (
                    <div>
                      <span className="font-medium">Poids:</span> {affiche.weight}
                    </div>
                  )}
                  {affiche.price && (
                    <div>
                      <span className="font-medium">Prix:</span> {affiche.price}
                    </div>
                  )}
                  {affiche.pricePerKg && (
                    <div>
                      <span className="font-medium">Prix/kg:</span> {affiche.pricePerKg}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setAfficheToDelete(affiche);
                  setDeleteModalOpen(true);
                }}
                className="ml-4 p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Supprimer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
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
    </div>
  );
};

export default Affiches;

