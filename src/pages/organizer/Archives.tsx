import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Trophy, Calendar, MapPin, Search, ChevronRight, Hash, Eye, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ArchiveItem {
  id: string;
  name: string;
  date: string;
  location: string | null;
  nb_tables: number;
  nb_joueurs_total: number;
  nb_matchs_total: number;
  tableaux: any[];
  created_at: string;
}

export default function Archives() {
  const [archives, setArchives] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArchive, setSelectedArchive] = useState<ArchiveItem | null>(null);

  useEffect(() => {
    fetchArchives();
  }, []);

  const fetchArchives = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tournament_archives')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setArchives(data || []);
    } catch (err) {
      console.error("Erreur lors de la récupération des archives :", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredArchives = archives.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.location && item.location.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Historique des Tournois</h1>
          <p className="text-slate-500 mt-2">Consultez les bilans, d’anciens podiums et statistiques d’événements clôturés.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold shadow-sm"
            placeholder="Rechercher un tournoi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Chargement des événements archivés...</div>
      ) : filteredArchives.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 border border-dashed border-slate-200 rounded-[2rem] text-slate-400">
          <Calendar className="w-12 h-12 stroke-[1.5] mx-auto mb-4 text-slate-300" />
          <p className="font-semibold text-slate-500">Aucun tournoi archivé</p>
          <p className="text-xs mt-1">Archivez un tournoi depuis le tableau de bord une fois tous les matchs terminés.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredArchives.map((archive) => (
            <div
              key={archive.id}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex justify-between items-start gap-4">
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {archive.name}
                  </h3>
                  <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-600 text-[10px] font-black uppercase rounded-lg border border-slate-100 tracking-wider">
                    <Calendar className="w-3 h-3" />
                    {new Date(archive.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {archive.location && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-2 italic">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {archive.location}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-4 mt-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Joueurs</span>
                    <p className="text-lg font-black text-slate-800 mt-0.5">{archive.nb_joueurs_total}</p>
                  </div>
                  <div className="text-center border-x border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Matchs</span>
                    <p className="text-lg font-black text-slate-800 mt-0.5">{archive.nb_matchs_total}</p>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tables</span>
                    <p className="text-lg font-black text-slate-800 mt-0.5">{archive.nb_tables}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Bilan disponible</span>
                <button
                  onClick={() => setSelectedArchive(archive)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-xl border border-slate-200 hover:border-indigo-100 transition-all active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Consulter le Bilan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal / Bilan détaillé de l'archive */}
      <AnimatePresence>
        {selectedArchive && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[90vh] border border-slate-150"
            >
              <div className="flex justify-between items-start gap-4 mb-8">
                <div>
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 tracking-widest mb-2">
                    <Award className="w-3 h-3" /> Archive Validée
                  </span>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedArchive.name}</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Bilan du {new Date(selectedArchive.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {selectedArchive.location ? ` au ${selectedArchive.location}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedArchive(null)}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-full transition-all border border-slate-100 text-sm font-black"
                >
                  ✕
                </button>
              </div>

              {selectedArchive.tableaux && selectedArchive.tableaux.map((tab: any, index: number) => (
                <div key={index} className="space-y-6">
                  {/* Visual Podium representation */}
                  {tab.podium && (
                    <div className="bg-slate-950 text-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                      <h4 className="font-bold text-amber-400 uppercase tracking-widest text-xs mb-6 text-center">🏆 PODIUM DE LA COMPÉTITION 🏆</h4>
                      
                      <div className="grid grid-cols-3 items-end gap-2 max-w-md mx-auto relative z-10">
                        {/* 2ème place */}
                        <div className="flex flex-col items-center">
                          {tab.podium.deuxieme ? (
                            <div className="text-center mb-2 px-1">
                              <p className="font-bold text-xs truncate max-w-[100px]">{tab.podium.deuxieme.first_name} {tab.podium.deuxieme.last_name}</p>
                              <p className="text-[10px] text-slate-400 truncate max-w-[100px] italic">{tab.podium.deuxieme.club || '—'}</p>
                            </div>
                          ) : (
                            <p className="text-slate-600 text-[10px] mb-2">—</p>
                          )}
                          <div className="w-full bg-slate-800 border-t-2 border-slate-300 rounded-t-xl h-24 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black text-slate-300 italic">2</span>
                            <span className="text-[8px] uppercase tracking-widest font-black text-slate-400">Argent</span>
                          </div>
                        </div>

                        {/* 1ère place */}
                        <div className="flex flex-col items-center">
                          {tab.podium.premier ? (
                            <div className="text-center mb-3 px-1">
                              <span className="inline-block bg-amber-400 text-slate-950 text-[8px] font-black uppercase px-2 py-0.5 rounded mb-1">Vainqueur</span>
                              <p className="font-black text-sm text-yellow-300 truncate max-w-[130px]">{tab.podium.premier.first_name} {tab.podium.premier.last_name}</p>
                              <p className="text-[10px] text-slate-400 truncate max-w-[130px] italic">{tab.podium.premier.club || '—'}</p>
                            </div>
                          ) : (
                            <p className="text-slate-600 text-[10px] mb-2">—</p>
                          )}
                          <div className="w-full bg-slate-900 border-2 border-b-0 border-amber-400/50 rounded-t-2xl h-32 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
                            <span className="text-4xl font-black text-amber-400 italic">1</span>
                            <span className="text-[8px] uppercase tracking-widest font-black text-amber-400">Or</span>
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-300 to-amber-500" />
                          </div>
                        </div>

                        {/* 3ème place */}
                        <div className="flex flex-col items-center">
                          {tab.podium.troisieme && tab.podium.troisieme.length > 0 ? (
                            <div className="text-center mb-2 px-1">
                              <p className="font-bold text-xs truncate max-w-[100px]">
                                {tab.podium.troisieme[0].first_name} {tab.podium.troisieme[0].last_name}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate max-w-[100px] italic">{tab.podium.troisieme[0].club || '—'}</p>
                            </div>
                          ) : (
                            <p className="text-slate-600 text-[10px] mb-2">—</p>
                          )}
                          <div className="w-full bg-slate-800 border-t-2 border-amber-700/50 rounded-t-xl h-20 flex flex-col items-center justify-center">
                            <span className="text-xl font-black text-amber-600 italic">3</span>
                            <span className="text-[8px] uppercase tracking-widest font-black text-slate-400">Bronze</span>
                          </div>
                        </div>
                      </div>

                      <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
                    </div>
                  )}

                  <div className="space-y-4">
                    <h5 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">Statistiques de Participation</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Effectif Global</span>
                        <p className="text-xl font-bold mt-1 text-slate-800">{tab.nb_joueurs} joueurs ayant validé leur présence</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Activité Arbitrage</span>
                        <p className="text-xl font-bold mt-1 text-slate-800">{tab.nb_matchs} matchs disputés et reportés</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedArchive(null)}
                  className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all text-xs"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
