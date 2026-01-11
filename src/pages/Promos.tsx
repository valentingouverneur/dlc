import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Promo } from '../types/Promo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { BarChart, DonutChart } from '@tremor/react';
import { Search, Filter, Calendar as CalendarIcon, TrendingUp, Package, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

const Promos: React.FC = () => {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewMode, setViewMode] = useState<'current' | 'upcoming' | 'history'>('current');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    const q = query(
      collection(db, 'promos'),
      orderBy('dateDebut', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const promosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Promo[];
      setPromos(promosData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filtrer les promos selon le mode de vue
  const getFilteredPromos = () => {
    let filtered = promos;

    // Filtre par mode de vue
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (viewMode === 'current') {
      filtered = filtered.filter(promo => {
        if (!promo.dateDebut || !promo.dateFin) return false;
        const debut = new Date(promo.dateDebut);
        const fin = new Date(promo.dateFin);
        return debut <= today && fin >= today;
      });
    } else if (viewMode === 'upcoming') {
      filtered = filtered.filter(promo => {
        if (!promo.dateDebut) return false;
        const debut = new Date(promo.dateDebut);
        return debut > today;
      });
    } else if (viewMode === 'history') {
      filtered = filtered.filter(promo => {
        if (!promo.dateFin) return false;
        const fin = new Date(promo.dateFin);
        return fin < today;
      });
    }

    // Filtre par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(promo =>
        promo.designation?.toLowerCase().includes(term) ||
        promo.ean?.includes(term) ||
        promo.fournisseur?.toLowerCase().includes(term)
      );
    }

    // Filtre par catégorie
    if (selectedCategory) {
      filtered = filtered.filter(promo => promo.activite?.includes(selectedCategory));
    }

    // Filtre par date sélectionnée
    if (selectedDate) {
      filtered = filtered.filter(promo => {
        if (!promo.dateDebut || !promo.dateFin) return false;
        const debut = new Date(promo.dateDebut);
        const fin = new Date(promo.dateFin);
        const selected = new Date(selectedDate);
        return selected >= debut && selected <= fin;
      });
    }

    return filtered;
  };

  const filteredPromos = getFilteredPromos();

  // Statistiques
  const totalPromos = filteredPromos.length;
  const totalValue = filteredPromos.reduce((sum, promo) => sum + (promo.srpTTC || 0), 0);
  const avgDiscount = filteredPromos
    .filter(p => p.promoValue)
    .reduce((sum, promo) => {
      const discount = parseFloat(promo.promoValue?.replace('%', '') || '0');
      return sum + discount;
    }, 0) / filteredPromos.filter(p => p.promoValue).length || 0;

  // Données pour les graphiques
  const chartData = filteredPromos.slice(0, 10).map(promo => ({
    name: promo.designation?.substring(0, 20) || 'Produit',
    value: promo.srpTTC || 0,
    discount: parseFloat(promo.promoValue?.replace('%', '') || '0'),
  }));

  // Catégories uniques
  const categories = Array.from(new Set(promos.map(p => p.activite).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Promotions</h1>
          <p className="text-sm text-gray-500 mt-1">Gestion des promotions en cours et à venir</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link to="/promos/import">
            <Button variant="outline" className="w-full sm:w-auto">
              <Upload className="w-4 h-4 mr-2" />
              Importer
            </Button>
          </Link>
          <Button className="w-full sm:w-auto">
            <Package className="w-4 h-4 mr-2" />
            Nouvelle promotion
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promos actives</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPromos}</div>
            <p className="text-xs text-muted-foreground">
              {viewMode === 'current' ? 'En cours' : viewMode === 'upcoming' ? 'À venir' : 'Historique'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valeur totale</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalValue.toFixed(2)} €</div>
            <p className="text-xs text-muted-foreground">Prix de vente total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Réduction moyenne</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDiscount.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">Sur les promos avec réduction</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Rechercher et filtrer les promotions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs pour les modes de vue */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={viewMode === 'current' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('current')}
            >
              En cours
            </Button>
            <Button
              variant={viewMode === 'upcoming' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('upcoming')}
            >
              À venir
            </Button>
            <Button
              variant={viewMode === 'history' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('history')}
            >
              Historique
            </Button>
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Rechercher par désignation, EAN ou fournisseur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtres supplémentaires */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Catégorie</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Toutes les catégories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Date</label>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                onClick={() => setSelectedDate(undefined)}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? selectedDate.toLocaleDateString('fr-FR') : "Sélectionner une date"}
              </Button>
              {selectedDate && (
                <div className="mt-2">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Graphiques - Masqués sur mobile pour économiser l'espace */}
      {filteredPromos.length > 0 && (
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 produits</CardTitle>
              <CardDescription>Prix de vente par produit</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={chartData}
                index="name"
                categories={["value"]}
                colors={["blue"]}
                yAxisWidth={60}
                showLegend={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Réductions</CardTitle>
              <CardDescription>Distribution des réductions</CardDescription>
            </CardHeader>
            <CardContent>
              <DonutChart
                data={chartData.filter(d => d.discount > 0)}
                category="discount"
                index="name"
                colors={["blue", "cyan", "indigo", "violet"]}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Liste des promos */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des promotions ({filteredPromos.length})</CardTitle>
          <CardDescription>
            {viewMode === 'current' && 'Promotions actuellement en cours'}
            {viewMode === 'upcoming' && 'Promotions à venir'}
            {viewMode === 'history' && 'Historique des promotions'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPromos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune promotion trouvée</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPromos.map((promo) => (
                <Card key={promo.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Image */}
                      {promo.imageUrl && (
                        <div className="flex-shrink-0">
                          <img
                            src={promo.imageUrl}
                            alt={promo.designation}
                            className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-lg border"
                          />
                        </div>
                      )}

                      {/* Informations principales */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-base sm:text-lg mb-1 truncate">{promo.designation}</h3>
                              <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-gray-600 mb-2">
                                {promo.ean && (
                                  <span className="font-mono break-all">EAN: {promo.ean}</span>
                                )}
                                {promo.fournisseur && (
                                  <span className="break-all">• {promo.fournisseur}</span>
                                )}
                              </div>

                              {/* Dates */}
                              {promo.dateDebut && promo.dateFin && (
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mb-2">
                                  <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                  <span className="break-words">
                                    {new Date(promo.dateDebut).toLocaleDateString('fr-FR')} - {new Date(promo.dateFin).toLocaleDateString('fr-FR')}
                                  </span>
                                </div>
                              )}

                              {/* Prix */}
                              <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
                                {promo.srpTTC && (
                                  <div>
                                    <span className="text-gray-500">Prix TTC: </span>
                                    <span className="font-semibold">{promo.srpTTC.toFixed(2)} €</span>
                                  </div>
                                )}
                                {promo.pvh && (
                                  <div>
                                    <span className="text-gray-500">PVH: </span>
                                    <span className="font-semibold">{promo.pvh.toFixed(2)} €</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Badge promotion */}
                            {promo.promoType && (
                              <div className="flex-shrink-0">
                                <div className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                                  promo.promoIcon === 'rouge' ? 'bg-red-100 text-red-800' :
                                  promo.promoIcon === 'bleu' ? 'bg-blue-100 text-blue-800' :
                                  promo.promoIcon === 'jaune' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {promo.promoType}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Informations supplémentaires */}
                          <div className="mt-3 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500">
                            {promo.activite && (
                              <div className="break-words">
                                <span className="font-medium">Activité: </span>
                                <span>{promo.activite}</span>
                              </div>
                            )}
                            {promo.commande && (
                              <div>
                                <span className="font-medium">Commande: </span>
                                <span>{promo.commande}</span>
                              </div>
                            )}
                            {promo.qteUVC && (
                              <div>
                                <span className="font-medium">Quantité: </span>
                                <span>{promo.qteUVC} UVC</span>
                              </div>
                            )}
                            {promo.liv && (
                              <div>
                                <span className="font-medium">Livraison: </span>
                                <span>{promo.liv}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Promos;
