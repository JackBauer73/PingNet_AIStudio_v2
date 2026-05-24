import React, { useState } from 'react';
import { usePlayers } from '../../hooks/usePlayers';
import { useTournament } from '../../hooks/useTournament';
import { 
  Plus, 
  Search, 
  Trash2, 
  UserPlus, 
  Filter, 
  Calendar as CalendIcon, 
  Trophy, 
  Sparkles,
  Smartphone,
  CheckCircle,
  BadgeEuro,
  RefreshCw,
  Send,
  AlertCircle,
  Clock,
  UserX,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../supabase';
import { fetchPlayerByLicence } from '../../services/ffttApi';
import { assignDossard } from '../../services/dossardService';
import { sendPlayerCredentials } from '../../services/smsService';
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
  const { players, loading, addPlayer, deletePlayer, updatePlayerSerie, updatePlayerDetails, refresh } = usePlayers(tournament?.id);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');
  const [selectedSerie, setSelectedSerie] = useState<string | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'to_check' | 'checked'>('all');
  const [sendingSmsId, setSendingSmsId] = useState<string | null>(null);

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
    points: ''
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

    let finalPoints: number | null = formData.points ? parseInt(formData.points, 10) : null;
    let finalClub = formData.club;

    const lic = formData.licence_number?.trim();
    if (lic) {
      const toastId = toast.loading("Recherche et récupération des points FFTT...");
      try {
        const ffttData: any = await fetchPlayerByLicence(lic);
        if (ffttData) {
          toast.success(`Profil FFTT trouvé : ${ffttData.prenom} ${ffttData.nom}`, { id: toastId });
          if (!finalClub) finalClub = ffttData.club || '';
          
          finalPoints = ffttData.classement || ffttData.mensuel || ffttData.initial || 500;
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
      points: finalPoints,
      tournament_id: tournament.id,
      checked_in: false,
      paid: false,
      dossard: null
    });

    if (success) {
      setFormData({ 
        first_name: '', 
        last_name: '', 
        club: '', 
        serie: categories[0]?.name || 'NC', 
        phone: '',
        licence_number: '',
        points: ''
      });
      setShowAddForm(false);
      refresh();
    }
  };

  // Pointage express jour J + assignation de dossard intelligente (par journée active uniquement)
  const handleTableCheckIn = async (player: any) => {
    const toastId = toast.loading(`Pointage de ${player.first_name} ${player.last_name}...`);

    try {
      // 1. Déterminer la journée du tableau ciblé (celui auquel appartient l'inscription)
      const currentCategory = categories.find(c => c.name === player.serie);
      const targetDay = currentCategory?.day_number || 1;

      // 2. Trouver toutes les inscriptions de ce même joueur physique pour la MÊME journée
      const sameDayRegistrations = players.filter(p => {
        const isSamePlayer = (p.licence_number && player.licence_number && p.licence_number === player.licence_number) ||
          ((!p.licence_number || !player.licence_number) && 
           p.first_name?.toLowerCase().trim() === player.first_name?.toLowerCase().trim() && 
           p.last_name?.toLowerCase().trim() === player.last_name?.toLowerCase().trim());
        if (!isSamePlayer) return false;

        const pCat = categories.find(c => c.name === p.serie);
        const pDay = pCat?.day_number || 1;
        return pDay === targetDay;
      });

      // 3. Assigner ou récupérer un dossard via le service intelligent
      const result = await assignDossard({
        registrationId: player.id,
        tournamentId: tournament?.id!,
        onlyThisRegistration: true // Nous allons appliquer le pointage finement nous-mêmes pour respecter les journées
      });

      const dossardId = result.dossard;

      // 4. Mettre à jour checked_in: true et paid: true uniquement pour les inscriptions de la MÊME journée
      // Note : on n'associe pas le dossard à toutes les lignes pour respecter strictement l'index unique de Supabase
      const sameDayIds = sameDayRegistrations.map(p => p.id);
      
      const { error: updateError } = await supabase
        .from('players')
        .update({
          checked_in: true,
          paid: true
        })
        .in('id', sameDayIds);

      if (updateError) {
        throw updateError;
      }

      toast.success(`Dossard n°${dossardId} attribué & présent pour tous ses tableaux de la Journée ${targetDay} ✓`, { id: toastId });

      // 5. Si le joueur n'était pas déjà pointé sur un autre tableau, on envoie ses identifiants uniques par SMS
      if (!result.dejaPointe && player.phone) {
        const smsResult = await sendPlayerCredentials({
          playerId: player.id,
          firstName: player.first_name,
          lastName: player.last_name,
          phone: player.phone,
          dossard: dossardId
        });
        
        if (!smsResult.success) {
          console.warn("SMS d'activation non envoyé :", smsResult.reason);
        }
      }

      // Recharger l'état
      await refresh();

    } catch (err: any) {
      console.error(err);
      toast.error(`Une erreur est survenue lors du pointage : ${err.message}`, { id: toastId });
    }
  };

  // Annuler le pointage pour un tableau donné individuellement
  const handleCancelSingleCheckIn = async (player: any) => {
    const confirm = window.confirm(`Voulez-vous annuler le pointage de ${player.first_name} ${player.last_name} uniquement pour le tableau ${player.serie} ?`);
    if (!confirm) return;

    const toastId = toast.loading(`Annulation du pointage de ${player.serie}...`);
    try {
      // On dépointe et annule le paiement UNIQUEMENT pour cette ligne (cette inscription au tableau)
      const { error: updateError } = await supabase
        .from('players')
        .update({
          checked_in: false,
          paid: false
        })
        .eq('id', player.id);

      if (updateError) throw updateError;

      // Si le joueur physique n'a plus AUCUN tableau pointé dans TOUT le tournoi,
      // on peut libérer son numéro de dossard pour qu'il soit propre.
      const hasOtherCheckedIn = players.some(p => p.id !== player.id && p.checked_in && (
        (p.licence_number && player.licence_number && p.licence_number === player.licence_number) ||
        ((!p.licence_number || !player.licence_number) && 
         p.first_name?.toLowerCase().trim() === player.first_name?.toLowerCase().trim() && 
         p.last_name?.toLowerCase().trim() === player.last_name?.toLowerCase().trim())
      ));

      if (!hasOtherCheckedIn) {
        // Optionnel : s'il n'a plus aucun pointage nul part, on libère le dossard des inscriptions restantes
        const samePlayers = players.filter(p => 
          (p.licence_number && player.licence_number && p.licence_number === player.licence_number) ||
          ((!p.licence_number || !player.licence_number) && 
           p.first_name?.toLowerCase().trim() === player.first_name?.toLowerCase().trim() && 
           p.last_name?.toLowerCase().trim() === player.last_name?.toLowerCase().trim())
        );

        const sameIds = samePlayers.map(p => p.id);
        await supabase
          .from('players')
          .update({ dossard: null })
          .in('id', sameIds);
      }

      toast.success(`Pointage annulé pour le tableau ${player.serie} ✓`, { id: toastId });
      await refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur: ${err.message}`, { id: toastId });
    }
  };

  // Ré-envoi manuel des identifiants par SMS
  const handleResendSms = async (player: any) => {
    if (!player.phone) {
      toast.error("Aucun numéro de téléphone configuré pour ce joueur.");
      return;
    }
    
    setSendingSmsId(player.id);
    const toastId = toast.loading(`Envoi du SMS contenant les identifiants de score à ${player.first_name}...`);
    
    try {
      const smsResult = await sendPlayerCredentials({
        playerId: player.id,
        firstName: player.first_name,
        lastName: player.last_name,
        phone: player.phone,
        dossard: player.dossard || undefined
      });

      if (smsResult.success) {
        toast.success(`SMS envoyé avec succès !`, { id: toastId });
      } else {
        toast.error(`Échec d’envoi : ${smsResult.reason || 'Erreur lors de la transmission'}`, { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur d’envoi de SMS: ${err.message}`, { id: toastId });
    } finally {
      setSendingSmsId(null);
    }
  };

  // Réinitialiser le pointage global du joueur (remettre en non-pointé et enlever le dossard sur toutes les lignes)
  const handleResetCheckIn = async (player: any) => {
    const confirm = window.confirm(`Voulez-vous annuler le pointage global de ${player.first_name} ${player.last_name} (tous tableaux) et libérer son dossard ?`);
    if (!confirm) return;

    const toastId = toast.loading("Réinitialisation complète du pointage...");
    try {
      // Trouver tous les enregistrements correspondants au même joueur physique
      const samePlayers = players.filter(p => 
        (p.licence_number && player.licence_number && p.licence_number === player.licence_number) ||
        ((!p.licence_number || !player.licence_number) && 
         p.first_name?.toLowerCase().trim() === player.first_name?.toLowerCase().trim() && 
         p.last_name?.toLowerCase().trim() === player.last_name?.toLowerCase().trim())
      );

      const sameIds = samePlayers.map(p => p.id);
      const { error } = await supabase
        .from('players')
        .update({
          checked_in: false,
          dossard: null,
          paid: false
        })
        .in('id', sameIds);

      if (error) throw error;

      toast.success("Pointage global réinitialisé et dossard libéré ✓", { id: toastId });
      await refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur: ${err.message}`, { id: toastId });
    }
  };

  const uniqueDays = Array.from(new Set(categories.map(c => Number(c.day_number) || 1))).sort((a: number, b: number) => a - b);

  const filteredPlayers = players.filter(p => {
    // Filtrage recherche textuelle (Nom/Prénom)
    const matchesSearch = `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      p.club?.toLowerCase().includes(search.toLowerCase()) ||
      p.licence_number?.includes(search) ||
      p.dossard?.toString().includes(search);
    
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

    // Filtrage par onglet de présence / pointage J-J
    if (activeTab === 'to_check') {
      return !p.checked_in;
    } else if (activeTab === 'checked') {
      return !!p.checked_in;
    }

    return true;
  });

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header Unifié J-J */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 border-l-4 border-indigo-500 pl-4 flex items-center gap-2">
            Pointage J-J & Joueurs
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm pl-4">
            Gérez la table de pointage en direct ({players.length} inscriptions au total), attribuez les dossards et suivez les règlements.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={refresh}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Actualiser la liste"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-200/50"
          >
            <UserPlus className="w-5 h-5" />
            Ajouter un Joueur
          </button>
        </div>
      </div>

      {/* Formulaire d'ajout rapide de joueur (collapsable) */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-750 mb-2">Prénom *</label>
                <input
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  value={formData.first_name}
                  onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-750 mb-2">Nom *</label>
                <input
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  value={formData.last_name}
                  onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-750 mb-2">Série / Classement *</label>
                <select
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm cursor-pointer"
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
                <label className="block text-sm font-semibold text-slate-750 mb-2">Club / Association</label>
                <input
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  value={formData.club}
                  onChange={e => setFormData({ ...formData, club: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-750 mb-2">Numéro de Téléphone (SMS de scores)</label>
                <input
                  type="tel"
                  placeholder="Ex: 0612345678"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-mono"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-750 mb-2">N° de Licence FFTT (Optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: 5912345"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-mono"
                  value={formData.licence_number}
                  onChange={e => setFormData({ ...formData, licence_number: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-750 mb-2">Points (Calculé si licence renseignée)</label>
                <input
                  type="number"
                  placeholder="Ex: 752"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-mono"
                  value={formData.points}
                  onChange={e => setFormData({ ...formData, points: e.target.value })}
                />
              </div>
              <div className="flex items-end md:col-span-2">
                <button
                  type="submit"
                  className="w-full px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer"
                >
                  Valider l'Inscription du Joueur
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtres de Tableaux & Multi-onglets de Pointage */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
        
        {/* Filtres par présence globale J-J */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-max">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer
              ${activeTab === 'all' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'}`}
          >
            Tous les Joueurs ({players.length})
          </button>
          <button
            onClick={() => setActiveTab('to_check')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer
              ${activeTab === 'to_check' 
                ? 'bg-amber-600/10 text-amber-900 shadow-sm border border-amber-500/15' 
                : 'text-slate-500 hover:text-amber-700'}`}
          >
            <UserX className="w-3.5 h-3.5 text-amber-600" />
            À pointer ({players.filter(p => !p.checked_in).length})
          </button>
          <button
            onClick={() => setActiveTab('checked')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer
              ${activeTab === 'checked' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'text-slate-500 hover:text-emerald-700'}`}
          >
            <Check className="w-3.5 h-3.5" />
            Pointés ({players.filter(p => p.checked_in).length})
          </button>
        </div>

        {/* Onglets de Journées */}
        <div className="flex items-center gap-2 border-t border-slate-100/70 pt-4 flex-wrap">
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
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                Journée {dayNum}
                {isToday && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-500 text-white">
                    Actif ⚡
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Onglets de Tableaux / Séries */}
        <div className="flex items-center gap-2 border-t border-slate-100/70 pt-4 flex-wrap">
          <span className="text-xs font-black uppercase text-slate-400 tracking-wider mr-1.5 flex items-center gap-1 shrink-0">
            <Trophy className="w-4 h-4 text-amber-500" /> Filtrer par Tableau :
          </span>
          <button
            onClick={() => {
              setSelectedSerie('all');
            }}
            className={`px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-all ${
              selectedSerie === 'all'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
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
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 border border-slate-200/60 ${
                  isActive ? '' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
                style={isActive ? { backgroundColor: bgCol, borderColor: bgCol, color: textCol } : {}}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? textCol : bgCol }} />
                {cat.name} {cat.day_number && selectedDay === 'all' ? `(J${cat.day_number})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tableau interactif principal */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Barre de Recherche rapide */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Chercher un nom, licence, n° de dossard..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Structure du Tableau */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 italic bg-slate-50">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Joueur</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Club</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Tableau</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Points</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 text-center">Pointage J-J (Règlement & Dossard)</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 text-center">Identifiants Saisie Scores</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="w-6 h-6 mx-auto animate-spin text-indigo-500 mb-2" />
                    Chargement des participants en cours...
                  </td>
                </tr>
              ) : filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-450 font-medium italic">
                    Aucun joueur correspondant à vos filtres.
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player) => (
                  <tr key={player.id} className={`hover:bg-slate-50/70 transition-colors group ${player.checked_in ? 'bg-emerald-50/5' : ''}`}>
                    
                    {/* Colonne JOUEUR / DOSSARD */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const linkedDossard = players.find(p => (
                            (p.licence_number && player.licence_number && p.licence_number === player.licence_number) ||
                            ((!p.licence_number || !player.licence_number) && 
                             p.first_name?.toLowerCase().trim() === player.first_name?.toLowerCase().trim() && 
                             p.last_name?.toLowerCase().trim() === player.last_name?.toLowerCase().trim())
                          ) && p.dossard)?.dossard;

                          return player.checked_in && linkedDossard ? (
                            <button 
                              id={`player-dossard-badge-${player.id}`}
                              onClick={() => handleResetCheckIn(player)}
                              className="inline-flex items-center justify-center w-7 h-7 bg-emerald-100 text-emerald-800 font-mono font-black border border-emerald-250 rounded-lg text-xs shadow-sm shadow-emerald-100 cursor-pointer hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all"
                              title="Cliquez pour réinitialiser le pointage complet de ce joueur"
                            >
                              {linkedDossard}
                            </button>
                          ) : (
                            <div className="w-7 h-7 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 font-bold text-[10px]">
                              —
                            </div>
                          );
                        })()}
                        <div>
                          <p className="font-extrabold text-slate-900 leading-tight">
                            {player.last_name.toUpperCase()} {player.first_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-medium font-mono">
                            {player.licence_number && (
                              <span>Licence: {player.licence_number}</span>
                            )}
                            {player.phone && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5 text-slate-500">
                                  <Smartphone className="w-3 h-3" /> {player.phone}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Colonne CLUB */}
                    <td className="px-6 py-4 text-xs font-semibold text-slate-550 italic">
                      {player.club || 'Sans club / Non licencié'}
                    </td>

                    {/* Colonne TABLEAU (SERIE) */}
                    <td className="px-6 py-4">
                      <select
                        id={`player-serie-select-${player.id}`}
                        value={player.serie}
                        onChange={(e) => updatePlayerSerie(player.id, e.target.value, player.first_name, player.last_name)}
                        className="bg-indigo-50/60 hover:bg-slate-100 text-indigo-700 font-black border border-indigo-100/50 text-[11px] px-2.5 py-1.5 rounded-xl outline-none transition-all cursor-pointer shadow-sm focus:ring-2 focus:ring-indigo-400 max-w-[155px] truncate"
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

                    {/* Colonne CLASSEMENT (POINTS) */}
                    <td className="px-6 py-4">
                      <span className="inline-flex text-[11px] font-bold tracking-wider font-mono px-2 py-1 bg-slate-50 border border-slate-150 rounded-lg text-slate-600">
                        {player.points ?? '500'} pts
                      </span>
                    </td>

                    {/* Colonne POINTAGE J-J (RÈGLEMENT & DOSSARD) */}
                    <td className="px-6 py-4 text-center">
                      {!player.checked_in ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            id={`checkin-cb-btn-${player.id}`}
                            onClick={() => handleTableCheckIn(player)}
                            className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm rounded-lg active:scale-95 transition-all cursor-pointer"
                          >
                            Pointer (CB)
                          </button>
                          <button
                            id={`checkin-pay-btn-${player.id}`}
                            onClick={() => handleTableCheckIn(player)}
                            className="px-3.5 py-1.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <BadgeEuro className="w-4 h-4" /> Encaisser
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-700 border border-emerald-500/10 text-xs font-bold rounded-lg justify-center shadow-inner">
                            <CheckCircle className="w-4 h-4 text-emerald-600" /> Pointé (Dossard #{
                              players.find(p => (
                                (p.licence_number && player.licence_number && p.licence_number === player.licence_number) ||
                                ((!p.licence_number || !player.licence_number) && 
                                 p.first_name?.toLowerCase().trim() === player.first_name?.toLowerCase().trim() && 
                                 p.last_name?.toLowerCase().trim() === player.last_name?.toLowerCase().trim())
                              ) && p.dossard)?.dossard || player.dossard
                            })
                          </span>
                          <button
                            id={`forfait-single-btn-${player.id}`}
                            onClick={() => handleCancelSingleCheckIn(player)}
                            className="p-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                            title="Annuler le pointage / Forfait de ce tableau spécifique"
                          >
                            <X className="w-3.5 h-3.5" /> Forfait
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Colonne IDENTIFIANTS SMS DE SCORE */}
                    <td className="px-6 py-4 text-center">
                      {player.checked_in ? (
                        player.phone ? (
                          <button
                            onClick={() => handleResendSms(player)}
                            disabled={sendingSmsId === player.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                          >
                            <Send className={`w-3.5 h-3.5 ${sendingSmsId === player.id ? 'animate-pulse text-indigo-500' : 'text-slate-400'}`} />
                            Renvoyer identifiants
                          </button>
                        ) : (
                          <span className="text-[10px] text-rose-500 font-semibold bg-rose-50 border border-rose-100 px-2 py-1 rounded-md inline-flex items-center gap-1 leading-none">
                            <AlertCircle className="w-3.5 h-3.5" /> Pas de téléphone
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium italic flex items-center gap-1 justify-center">
                          <Clock className="w-3.5 h-3.5" /> En attente du pointage
                        </span>
                      )}
                    </td>

                    {/* Colonne ACTIONS */}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deletePlayer(player.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Supprimer l'inscription"
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
