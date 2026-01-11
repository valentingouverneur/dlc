import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { promosData } from '../data/promos-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ImportPromos: React.FC = () => {
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const handleImport = async () => {
    setImporting(true);
    setImported(0);
    setSkipped(0);
    setErrors([]);

    try {
      for (const promo of promosData) {
        try {
          // Vérifier si la promo existe déjà (par EAN et dates)
          const existingQuery = query(
            collection(db, 'promos'),
            where('ean', '==', promo.ean),
            where('dateDebut', '==', promo.dateDebut),
            where('dateFin', '==', promo.dateFin)
          );
          
          const existingDocs = await getDocs(existingQuery);
          
          if (existingDocs.empty) {
            // Ajouter createdAt et updatedAt
            const promoToAdd = {
              ...promo,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            await addDoc(collection(db, 'promos'), promoToAdd);
            setImported(prev => prev + 1);
          } else {
            setSkipped(prev => prev + 1);
          }
        } catch (error: any) {
          setErrors(prev => [...prev, `Erreur pour ${promo.designation}: ${error.message}`]);
        }
      }
    } catch (error: any) {
      setErrors(prev => [...prev, `Erreur générale: ${error.message}`]);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Import des Promos</CardTitle>
          <CardDescription>
            Importer {promosData.length} promotions de la semaine prochaine (12/01 - 25/01)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Total de promos à importer: <strong>{promosData.length}</strong>
            </p>
            <p className="text-sm text-gray-600">
              Les promos existantes (même EAN + dates) seront ignorées.
            </p>
          </div>

          <Button
            onClick={handleImport}
            disabled={importing}
            className="w-full"
          >
            {importing ? 'Import en cours...' : 'Importer les promos'}
          </Button>

          {(imported > 0 || skipped > 0 || errors.length > 0) && (
            <div className="space-y-2 pt-4 border-t">
              {imported > 0 && (
                <p className="text-sm text-green-600">
                  ✅ {imported} promos importées avec succès
                </p>
              )}
              {skipped > 0 && (
                <p className="text-sm text-yellow-600">
                  ⚠️ {skipped} promos ignorées (déjà existantes)
                </p>
              )}
              {errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-600">
                    ❌ {errors.length} erreur(s):
                  </p>
                  {errors.map((error, index) => (
                    <p key={index} className="text-xs text-red-500">{error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ImportPromos;
