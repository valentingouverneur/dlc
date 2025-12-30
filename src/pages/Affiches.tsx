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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Pas de modal, copie silencieuse
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
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

      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">EAN</th>
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
    </div>
  );
};

export default Affiches;

