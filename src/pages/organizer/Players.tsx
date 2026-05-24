import React, { useState } from 'react';
import { usePlayers } from '../../hooks/usePlayers';
import { useTournament } from '../../hooks/useTournament';
import { Plus, Search, Trash2, UserPlus, Filter, Calendar as CalendIcon, Trophy, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../supabase';
import { fetchPlayerByLicence } from '../../services/ffttApi';
import toast from 'react-hot-toast';

const SERIES = ['NC', 'P12', 'P11', 'P10', 'D9', 'D8', 'D7', 'R6', 'R5', 'R4', 'N3', 'N2', 'N1'];

function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#ffffff';
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#0f172a' : '#ffffff';
}

export default function Players() {
  const { tournament } = useTournament();
  const { players, loading, addPlayer, deletePlayer, toggleCheckin, updatePlayerSerie, updatePlayerDetails } = usePlayers(tournament?.id);
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');
  const [selectedSerie, setSelectedSerie] = useState<string | 'all'>('all');

  React.useEffect(() => {
    if (tournament?.current_day) {
      setSelectedDay(tournament.current_day);
    }
  }, [tournament?.current_day]);
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    club: '',
    serie: 'NC',
    phone: '',
    licence_number: '',
    pts_phase1: '',
    pts_phase2: ''
  });

  React.useEffect(() => {
    if (!tournament?.id) return;
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('table_categories')
          .select('*')
          .eq('tournament_id', tournament.id)
          .order('day_number', { ascending: true })
          .order('name', { ascending: true });
        if (!error && data) {
          setCategories(data);
          if (data.length > 0) {
            setFormData(prev => ({ ...prev, serie: data[0].name }));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCategories();
  }, [tournament?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error('Veuillez remplir le nom et le prénom du joueur.');
      return;
    }

    let finalPtsPhase1: number | null = formData.pts_phase1 ? parseInt(formData.pts_phase1, 10) : null;
    let finalPtsPhase2: number | null = formData.pts_phase2 ? parseInt(formData.pts_phase2, 10) : null;
    let finalClub = formData.club;

    const lic = formData.licence_number?.trim();
    if (lic) {
      const toastId = toast.loading("Recherche et récupération des points FFTT...");
      try {
        const ffttData: any = await fetchPlayerByLicence(lic);
        if (ffttData) {
          toast.success(`Profil FFTT trouvé : ${ffttData.prenom} ${ffttData.nom}`, { id: toastId });
          if (!finalClub) finalClub = ffttData.club || '';
          
          // Phase 1 : initial ou classement ou 500
          finalPtsPhase1 = ffttData.initial || ffttData.classement || 500;
          // Phase 2 : classement ou mensuel ou 500
          finalPtsPhase2 = ffttData.classement || ffttData.mensuel || 500;
        } else {
          toast.dismiss(toastId);
        }
      } catch (err: any) {
        toast.dismiss(toastId);
        console.warn("Erreur auto-fetch licence:", err);
      }
    }
    
    const success = await addPlayer({
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      club: finalClub?.trim() || null,
      serie: formData.serie,
      phone: formData.phone || null,
      licence_number: lic || null,
      pts_phase1: finalPtsPhase1,
      pts_phase2: finalPtsPhase2,
      tournament_id: tournament.id,
    });

    if (success) {
      setFormData({ 
        first_name: '', 
        last_name: '', 
        club: '', 
        serie: categories[0]?.name || 'NC', 
        phone: '',
        licence_number: '',
        pts_phase1: '',
        pts_phase2: ''
      });
      setShowAddForm(false);
    }
  };

  const uniqueDays = Array.from(new Set(categories.map(c => Number(c.day_number) || 1))).sort((a: number, b: number) => a - b);

  const filteredPlayers = players.filter(p => {
    // Filtrage recherche textuelle (Nom/Prénom)
    const matchesSearch = `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      p.club?.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    // Filtrage par journée
    if (selectedDay !== 'all') {
      const catOfPlayer = categories.find(c => c.name === p.serie);
      if (!catOfPlayer || catOfPlayer.day_number !== selectedDay) {
        return false;
      }
    }

    // Filtrage par série/tableau
    if (selectedSerie !== 'all') {
      if (p.serie !== selectedSerie) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end items-stretch gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 border-l-4 border-indigo-500 pl-4">
            Gestion des Joueurs
          </h1>
          <p className="text-slate-500 mt-1 pl-4 text-xs sm:text-sm">
            Inscrivez les participants et gérez la liste des inscrits ({players.length}).
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <UserPlus className="w-5 h-5" />
          Nouveau Joueur
        </button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-8"
          >
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Prénom</label>
                <input
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  value={formData.first_name}
                  onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nom</label>
                <input
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  value={formData.last_name}
                  onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Série / Classement</label>
                <select
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all appearance-none"
                  value={formData.serie}
                  onChange={e => setFormData({ ...formData, serie: e.target.value })}
                >
                  {categories.length > 0 ? (
                    categories.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name} (Jour {c.day_number})
                      </option>
                    ))
                  ) : (
                    SERIES.map(s => <option key={s} value={s}>{s}</option>)
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Club</label>
                <input
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  value={formData.club}
                  onChange={e => setFormData({ ...formData, club: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Téléphone (Optionnel)</label>
                <input
                  type="tel"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">N° de Licence (Optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: 012345"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
                  value={formData.licence_number}
                  onChange={e => setFormData({ ...formData, licence_number: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all shadow-md active:scale-[0.98]"
                >
                  Ajouter le joueur
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sélecteurs dynamiques d'onglets (Journées & Tableaux / Séries) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 space-y-5">
        {/* Onglets de Journées */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 flex-wrap">
          <span className="text-xs font-black uppercase text-slate-400 tracking-wider mr-2 flex items-center gap-1 shrink-0">
            <CalendIcon className="w-4 h-4 text-indigo-500" /> Filtrer par Journée :
          </span>
          <button
            onClick={() => {
              setSelectedDay('all');
              setSelectedSerie('all');
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              selectedDay === 'all'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
            }`}
          >
            Tous les Jours 📅
          </button>
          {uniqueDays.map(dayNum => {
            const isToday = tournament?.current_day === dayNum;
            return (
              <button
                key={dayNum}
                onClick={() => {
                  setSelectedDay(dayNum);
                  setSelectedSerie('all');
                }}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                  selectedDay === dayNum
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                Journée {dayNum}
                {isToday && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-500 text-white border border-indigo-400">
                    Actif ⚡
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Onglets de Tableaux */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black uppercase text-slate-400 tracking-wider mr-2 flex items-center gap-1 shrink-0">
            <Trophy className="w-4 h-4 text-amber-500" /> Filtrer par Tableau :
          </span>
          <button
            onClick={() => {
              setSelectedSerie('all');
            }}
            className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
              selectedSerie === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-150 border border-slate-200/60'
            }`}
          >
            Tous les Tableaux 👥
          </button>

          {(selectedDay === 'all' ? categories : categories.filter(c => c.day_number === selectedDay)).map(cat => {
            const isActive = selectedSerie === cat.name;
            const bgCol = cat.color_code || '#4f46e5';
            const textCol = isActive ? getContrastColor(bgCol) : '';
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedSerie(cat.name)}
                className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 border border-slate-200/60 ${
                  isActive
                    ? ''
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
                style={isActive ? { backgroundColor: bgCol, borderColor: bgCol, color: textCol } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? textCol : bgCol }} />
                {cat.name} {cat.day_number && selectedDay === 'all' ? `(J${cat.day_number})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Chercher un nom ou un club..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 italic bg-slate-50">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Joueur</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Club</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Série</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Licence</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Début Phase 1</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Début Phase 2</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 text-center">Pointage (Présence)</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">Chargement...</td>
                </tr>
              ) : filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">Aucun joueur inscrit.</td>
                </tr>
              ) : (
                filteredPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {player.first_name} {player.last_name}
                        </div>
                        {player.phone && <div className="text-xs text-slate-400 mt-0.5">{player.phone}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 italic">
                      {player.club || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={player.serie}
                        onChange={(e) => updatePlayerSerie(player.id, e.target.value, player.first_name, player.last_name)}
                        className="bg-indigo-50/70 hover:bg-slate-100 text-indigo-700 font-extrabold border border-indigo-100/60 text-[11px] px-2.5 py-1.5 rounded-xl outline-none transition-all cursor-pointer shadow-sm focus:ring-2 focus:ring-indigo-400 max-w-[150px] truncate"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.name} className="text-slate-800 bg-white font-medium">
                            {c.name} (J{c.day_number})
                          </option>
                        ))}
                        {!categories.some((c) => c.name === player.serie) && (
                          <option value={player.serie} className="text-slate-850 bg-white font-medium">
                            {player.serie}
                          </option>
                        )}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-slate-700 font-medium bg-slate-100/50 px-2 py-1.5 rounded-lg border border-slate-100">
                        {player.licence_number || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-700 font-semibold bg-slate-100/60 px-2.5 py-1.5 rounded-lg">
                        {player.pts_phase1 ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-700 font-semibold bg-slate-100/60 px-2.5 py-1.5 rounded-lg">
                        {player.pts_phase2 ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <select
                        value={player.checked_in === null || player.checked_in === undefined ? 'inscrit' : player.checked_in ? 'present' : 'absent'}
                        onChange={(e) => {
                          const val = e.target.value;
                          const checkedInValue = val === 'present' ? true : val === 'absent' ? false : null;
                          updatePlayerDetails(player.id, { checked_in: checkedInValue });
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer outline-none shadow-sm ${
                          player.checked_in === null || player.checked_in === undefined
                            ? 'bg-sky-100 text-sky-950 border-sky-300 hover:bg-sky-200/85'
                            : player.checked_in === true
                            ? 'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200/85'
                            : 'bg-rose-100 text-rose-950 border-rose-300 hover:bg-rose-200/85'
                        }`}
                      >
                        <option value="inscrit" className="text-sky-950 bg-white font-bold">Inscrit 🔄</option>
                        <option value="present" className="text-emerald-950 bg-white font-bold">Présent ✓</option>
                        <option value="absent" className="text-rose-950 bg-white font-bold">Absent ✗</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deletePlayer(player.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
