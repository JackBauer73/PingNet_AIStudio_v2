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
    <div className="p-2 sm:p-4 w-full max-w-[1600px] 2xl:max-w-[1850px] mx-auto space-y-5 animate-fade-in pb-10" id="archives-view-main">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white border-l-4 border-[#f97316] pl-4">
            Historique des Tournois
          </h1>
          <p className="text-slate-400 mt-1 pl-4 text-xs sm:text-sm font-semibold">
            Consultez les bilans, d’anciens podiums et statistiques d’événements clôturés du club.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full pl-11 pr-4 py-2.5 bg-[#152031] border border-[#2a3548] focus:border-[#f97316]/50 rounded-xl outline-none text-white text-xs sm:text-sm font-semibold shadow-md transition-all placeholder-slate-500"
            placeholder="Rechercher un tournoi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm font-bold font-mono">Chargement des événements archivés...</div>
      ) : filteredArchives.length === 0 ? (
        <div className="text-center py-16 bg-[#152031]/40 border border-dashed border-[#20324e] rounded-2xl text-slate-400">
          <Calendar className="w-10 h-10 stroke-[1.5] mx-auto mb-3 text-slate-600" />
          <p className="font-extrabold text-sm text-slate-300">Aucun tournoi archivé</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            Archivez un tournoi depuis le tableau de bord ou l'administration une fois tous les matchs terminés.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredArchives.map((archive) => (
            <div
              key={archive.id}
              className="bg-[#152031] p-4 sm:p-5 rounded-2xl border border-[#2a3548] shadow-lg flex flex-col justify-between group transition-all duration-300 hover:border-[#f97316]/30"
            >
              <div>
                <div className="flex justify-between items-start gap-4">
                  <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-[#f97316] transition-colors">
                    {archive.name}
                  </h3>
                  <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#0e1726]/80 text-slate-300 text-[10px] font-extrabold uppercase rounded-lg border border-[#20324e] tracking-wider font-mono">
                    <Calendar className="w-3 h-3 text-[#f97316]" />
                    {new Date(archive.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {archive.location && (
                  <p className="flex items-center gap-1.5 text-[11px] text-[#38bdf8] mt-2 italic font-semibold">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {archive.location}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-3 mt-4 bg-[#0e1726]/60 p-3 rounded-xl border border-[#20324e]">
                  <div className="text-center">
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Joueurs</span>
                    <p className="text-base font-black text-white mt-0.5">{archive.nb_joueurs_total}</p>
                  </div>
                  <div className="text-center border-x border-[#20324e]">
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Matchs</span>
                    <p className="text-base font-black text-[#f97316] mt-0.5">{archive.nb_matchs_total}</p>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Tables</span>
                    <p className="text-base font-black text-emerald-400 mt-0.5">{archive.nb_tables}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#20324e]/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-semibold italic">Bilan final disponible</span>
                <button
                  onClick={() => setSelectedArchive(archive)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#20324e]/50 hover:bg-[#20324e]/90 text-slate-200 hover:text-white border border-[#2a3548] hover:border-[#f97316]/50 rounded-lg transition-all active:scale-95 cursor-pointer shadow-sm select-none"
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
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#152031] rounded-2xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[90vh] border border-[#2a3548]"
            >
              <div className="flex justify-between items-start gap-4 mb-6">
                <div>
                  <span className="inline-flex items-center gap-1 text-[9px] uppercase font-black bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-lg border border-emerald-500/20 tracking-wider mb-2">
                    <Award className="w-3 h-3" /> Archive Validée
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{selectedArchive.name}</h2>
                  <p className="text-slate-400 text-xs mt-1">
                    Bilan du {new Date(selectedArchive.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {selectedArchive.location ? ` au ${selectedArchive.location}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedArchive(null)}
                  className="p-2 bg-[#20324e]/60 hover:bg-[#20324e]/90 text-slate-400 hover:text-white rounded-lg transition-all border border-[#20324e] text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {selectedArchive.tableaux && selectedArchive.tableaux.map((tab: any, index: number) => (
                <div key={index} className="space-y-5">
                  {/* Visual Podium representation */}
                  {tab.podium && (
                    <div className="bg-[#0e1726]/90 border border-[#20324e] text-white rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
                      <h4 className="font-bold text-amber-400 uppercase tracking-widest text-[10px] sm:text-xs mb-4 text-center">🏆 PODIUM DE LA COMPÉTITION 🏆</h4>
                      
                      <div className="grid grid-cols-3 items-end gap-1.5 max-w-sm mx-auto relative z-10 pt-2">
                        {/* 2ème place */}
                        <div className="flex flex-col items-center">
                          {tab.podium.deuxieme ? (
                            <div className="text-center mb-1.5 px-1 max-w-full">
                              <p className="font-extrabold text-[11px] text-slate-200 truncate max-w-[85px] sm:max-w-[100px]">{tab.podium.deuxieme.first_name} {tab.podium.deuxieme.last_name}</p>
                              <p className="text-[9px] text-slate-400 truncate max-w-[85px] sm:max-w-[100px] italic">{tab.podium.deuxieme.club || '—'}</p>
                            </div>
                          ) : (
                            <p className="text-slate-600 text-[9px] mb-1.5">—</p>
                          )}
                          <div className="w-full bg-[#152031]/80 border-t-2 border-slate-400 rounded-t-lg h-20 flex flex-col items-center justify-center">
                            <span className="text-xl font-black text-slate-300 italic">2</span>
                            <span className="text-[7px] uppercase tracking-wider font-extrabold text-slate-400">Argent</span>
                          </div>
                        </div>

                        {/* 1ère place */}
                        <div className="flex flex-col items-center">
                          {tab.podium.premier ? (
                            <div className="text-center mb-2 px-1 max-w-full">
                              <span className="inline-block bg-amber-400 text-slate-950 text-[7px] font-black uppercase px-1.5 py-0.5 rounded mb-0.5">Vainqueur</span>
                              <p className="font-black text-xs text-yellow-300 truncate max-w-[105px] sm:max-w-[120px]">{tab.podium.premier.first_name} {tab.podium.premier.last_name}</p>
                              <p className="text-[9px] text-slate-400 truncate max-w-[105px] sm:max-w-[120px] italic">{tab.podium.premier.club || '—'}</p>
                            </div>
                          ) : (
                            <p className="text-slate-600 text-[9px] mb-2">—</p>
                          )}
                          <div className="w-full bg-[#152031] border-2 border-b-0 border-amber-400/50 rounded-t-xl h-26 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
                            <span className="text-3xl font-black text-amber-400 italic">1</span>
                            <span className="text-[7px] uppercase tracking-wider font-extrabold text-amber-400 font-mono">Or</span>
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-300 to-amber-550" />
                          </div>
                        </div>

                        {/* 3ème place */}
                        <div className="flex flex-col items-center">
                          {tab.podium.troisieme && tab.podium.troisieme.length > 0 ? (
                            <div className="text-center mb-1.5 px-1 max-w-full">
                              <p className="font-extrabold text-[11px] text-slate-200 truncate max-w-[85px] sm:max-w-[100px]">
                                {tab.podium.troisieme[0].first_name} {tab.podium.troisieme[0].last_name}
                              </p>
                              <p className="text-[9px] text-slate-400 truncate max-w-[85px] sm:max-w-[100px] italic">{tab.podium.troisieme[0].club || '—'}</p>
                            </div>
                          ) : (
                            <p className="text-slate-600 text-[9px] mb-1.5">—</p>
                          )}
                          <div className="w-full bg-[#152031]/80 border-t-2 border-amber-700/50 rounded-t-lg h-16 flex flex-col items-center justify-center">
                            <span className="text-lg font-black text-amber-600 italic">3</span>
                            <span className="text-[7px] uppercase tracking-wider font-extrabold text-slate-400">Bronze</span>
                          </div>
                        </div>
                      </div>

                      <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                    </div>
                  )}

                  <div className="space-y-3">
                    <h5 className="font-extrabold text-white text-xs uppercase tracking-wider border-b border-[#20324e] pb-1.5">Statistiques de Participation</h5>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#0e1726]/50 p-3 rounded-lg border border-[#20324e]">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Effectif Global</span>
                        <p className="text-sm font-extrabold mt-0.5 text-slate-100">{tab.nb_joueurs} joueurs ayant validé leur présence</p>
                      </div>
                      <div className="bg-[#0e1726]/50 p-3 rounded-lg border border-[#20324e]">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Activité Arbitrage</span>
                        <p className="text-sm font-extrabold mt-0.5 text-[#f97316]">{tab.nb_matchs} matchs disputés et reportés</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="mt-6 pt-4 border-t border-[#20324e] flex justify-end">
                <button
                  onClick={() => setSelectedArchive(null)}
                  className="px-5 py-2 bg-[#f97316] hover:bg-[#ea580c] text-[#0c1624] font-black rounded-lg transition-all text-xs cursor-pointer shadow-md"
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
