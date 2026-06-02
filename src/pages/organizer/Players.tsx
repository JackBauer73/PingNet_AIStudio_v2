import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  X,
  Lock as LockIcon,
  Unlock,
  QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../supabase';
import { fetchPlayerByLicence } from '../../services/ffttApi';
import { assignDossard } from '../../services/dossardService';
import { sendPlayerCredentials } from '../../services/smsService';
import { sendPlayerEmail } from '../../services/emailService';
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
  const navigate = useNavigate();
  const { tournament } = useTournament();
  const { players, loading, addPlayer, deletePlayer, updatePlayerSerie, updatePlayerDetails, refresh } = usePlayers(tournament?.id);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');
  const [selectedSerie, setSelectedSerie] = useState<string | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'to_check' | 'checked'>('all');
  const [sendingSmsId, setSendingSmsId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const fetchCategories = async () => {
    if (!tournament?.id) return;
    try {
      const { data, error } = await supabase
        .from('table_categories')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('day_number', { ascending: true })
        .order('name', { ascending: true });
      if (!error && data) {
        // En cas de cache obsolète ou de colonne manquante, on complète à l’aide du localStorage local
        const localClosedRaw = localStorage.getItem(`closed_categories_${tournament.id}`);
        const localClosed: string[] = localClosedRaw ? JSON.parse(localClosedRaw) : [];

        const merged = data.map(cat => ({
          ...cat,
          is_closed: cat.is_closed || localClosed.includes(cat.name)
        }));

        setCategories(merged);
        if (merged.length > 0) {
          setFormData(prev => {
            // Uniquement si pas de série valide sélectionnée
            if (prev.serie === 'NC' || !merged.some(d => d.name === prev.serie)) {
              return { ...prev, serie: merged[0].name };
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    fetchCategories();
  }, [tournament?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error('Veuillez remplir le nom et le prénom du joueur.');
      return;
    }

    const targetCat = categories.find(c => c.name === formData.serie);
    if (targetCat && targetCat.is_closed) {
      toast.error(`Impossible d'ajouter un joueur car le tableau "${formData.serie}" est clôturé 🔒.`);
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

  // Basculer le statut fermé/ouvert d'un tableau pour le pointage
  const toggleCategoryClosure = async (category: any) => {
    const nextStatus = !category.is_closed;
    const toastId = toast.loading(`Mise à jour du statut du tableau ${category.name}...`);
    try {
      // 1. Essayer de sauvegarder en base de données Supabase
      const { error } = await supabase
        .from('table_categories')
        .update({ is_closed: nextStatus })
        .eq('id', category.id);

      if (error) {
        // En cas de cache obsolète ou de colonne manquante, on bascule de façon transparente en stockage local
        if (error.code === 'PGRST204' || error.message?.includes('is_closed')) {
          console.warn("La colonne 'is_closed' n'est pas encore dans le cache ou est absente. Utilisation du stockage local...");
          const key = `closed_categories_${tournament?.id}`;
          const localClosedRaw = localStorage.getItem(key);
          let localClosed: string[] = localClosedRaw ? JSON.parse(localClosedRaw) : [];
          if (nextStatus) {
            if (!localClosed.includes(category.name)) {
              localClosed.push(category.name);
            }
          } else {
            localClosed = localClosed.filter(name => name !== category.name);
          }
          localStorage.setItem(key, JSON.stringify(localClosed));

          toast.success(`Le tableau "${category.name}" est désormais ${nextStatus ? 'clôturé de secours 🔒' : 'réouvert 🔓'} ! (Stocké localement) ✓`, { id: toastId });
          await fetchCategories();
          return;
        }
        throw error;
      }

      // 2. Si l'enregistrement Supabase réussit, on synchronise également le localStorage par précaution
      const key = `closed_categories_${tournament?.id}`;
      const localClosedRaw = localStorage.getItem(key);
      let localClosed: string[] = localClosedRaw ? JSON.parse(localClosedRaw) : [];
      if (nextStatus) {
        if (!localClosed.includes(category.name)) {
          localClosed.push(category.name);
        }
      } else {
        localClosed = localClosed.filter(name => name !== category.name);
      }
      localStorage.setItem(key, JSON.stringify(localClosed));

      toast.success(`Le tableau "${category.name}" est désormais ${nextStatus ? 'clôturé 🔒' : 'réouvert 🔓'} ! ✓`, { id: toastId });
      await fetchCategories();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur lors de la modification : ${err.message}`, { id: toastId });
    }
  };

  // Pointage express jour J + assignation de dossard intelligente (par journée active uniquement)
  const handleTableCheckIn = async (player: any) => {
    // Déterminer le tableau ciblé
    const currentCategory = categories.find(c => c.name === player.serie);
    if (currentCategory?.is_closed) {
      toast.error(`Le tableau "${player.serie}" est clôturé 🔒. Le pointage/paiement n'est plus modifiable.`);
      return;
    }

    const toastId = toast.loading(`Pointage de ${player.first_name} ${player.last_name}...`);

    try {
      const targetDay = currentCategory?.day_number || 1;

      // 2. Trouver toutes les inscriptions de ce même joueur physique pour la MÊME journée
      const sameDayRegistrations = players.filter(p => {
        if (p.player_id !== player.player_id) return false;

        const pCat = categories.find(c => c.name === p.serie);
        const pDay = pCat?.day_number || 1;
        return pDay === targetDay;
      });

      // Filtrer pour exclure les inscriptions qui appartiendraient à des tableaux clôturés
      const allowedRegistrations = sameDayRegistrations.filter(p => {
        const pCat = categories.find(c => c.name === p.serie);
        return !pCat?.is_closed;
      });

      if (allowedRegistrations.length === 0) {
        toast.error(`Tous les tableaux de ce joueur pour la Journée ${targetDay} sont clôturés !`, { id: toastId });
        return;
      }

      // 3. Assigner ou récupérer un dossard via le service intelligent
      const result = await assignDossard({
        registrationId: player.id,
        tournamentId: tournament?.id!,
        onlyThisRegistration: true
      });

      const dossardId = result.dossard;

      // 4. Mettre à jour checked_in: true, paid: true et dossard uniquement pour les inscriptions autorisées
      const sameDayIds = allowedRegistrations.map(p => p.id);
      
      const { error: updateError } = await supabase
        .from('registrations')
        .update({
          checked_in: true,
          paid: true,
          status: 'validated',
          dossard: dossardId
        })
        .in('id', sameDayIds);

      if (updateError) {
        throw updateError;
      }

      toast.success(`Dossard n°${dossardId} attribué & présent pour ses tableaux ouverts de la Journée ${targetDay} ✓`, { id: toastId });

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
    const currentCategory = categories.find(c => c.name === player.serie);
    if (currentCategory?.is_closed) {
      toast.error(`Le tableau "${player.serie}" est clôturé 🔒. Pointage non modifiable.`);
      return;
    }

    const toastId = toast.loading(`Annulation du pointage de ${player.serie}...`);
    try {
      // On dépointe et annule le paiement et le dossard UNIQUEMENT pour cette inscription dans registrations
      const { error: updateError } = await supabase
        .from('registrations')
        .update({
          checked_in: false,
          paid: false,
          status: 'pending',
          dossard: null
        })
        .eq('id', player.id);

      if (updateError) throw updateError;

      // Un joueur physique peut avoir plusieurs inscriptions. Regardons s'il en a d'autres encore pointées.
      const hasOtherCheckedIn = players.some(p => p.id !== player.id && p.checked_in && p.player_id === player.player_id);

      if (!hasOtherCheckedIn) {
        // S'il n'a plus aucun pointage nulle part, on libère le dossard de toutes ses inscriptions
        const sameRegs = players.filter(p => p.player_id === player.player_id);
        const sameIds = sameRegs.map(p => p.id);

        await supabase
          .from('registrations')
          .update({
            dossard: null
          })
          .in('id', sameIds);
      }

      toast.success(`Pointage annulé pour le tableau ${player.serie} ✓`, { id: toastId });
      await refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur: ${err.message}`, { id: toastId });
    }
  };

  // Ré-envoi manuel des identifiants (SMS et/ou E-mail)
  const handleResendSms = async (player: any) => {
    if (!player.phone && !player.email) {
      toast.error("Aucun canal de contact (téléphone ou e-mail) configuré.");
      return;
    }
    
    setSendingSmsId(player.id);
    const media: string[] = [];
    if (player.phone) media.push("SMS");
    if (player.email) media.push("E-mail");
    
    const toastId = toast.loading(`Envoi des identifiants par ${media.join(' & ')} à ${player.first_name}...`);
    
    try {
      let smsSuccess = false;
      let emailSuccess = false;

      // 1. Envoi par SMS s'il y a un numéro
      if (player.phone) {
        const smsResult = await sendPlayerCredentials({
          playerId: player.player_id || player.id,
          firstName: player.first_name,
          lastName: player.last_name,
          phone: player.phone,
          dossard: player.dossard || undefined
        });
        smsSuccess = smsResult.success;
      }

      // 2. Envoi par E-mail s'il y a une adresse e-mail
      if (player.email) {
        const directUrl = `${window.location.origin}/player/${player.token || ''}`;
        const emailResult = await sendPlayerEmail({
          playerId: player.player_id || player.id,
          firstName: player.first_name,
          lastName: player.last_name,
          email: player.email,
          token: player.token || '',
          tournamentName: tournament?.name || 'Tournoi de Tennis de Table',
          directUrl: directUrl,
          dossard: player.dossard || undefined
        });
        emailSuccess = emailResult.success;
      }

      // Message de confirmation combiné
      if (player.phone && player.email) {
        if (smsSuccess && emailSuccess) {
          toast.success(`Identifiants renvoyés par SMS et E-mail !`, { id: toastId });
        } else if (smsSuccess) {
          toast.success(`SMS envoyé, mais échec sur l'E-mail.`, { id: toastId });
        } else if (emailSuccess) {
          toast.success(`E-mail de confirmation envoyé, mais échec sur le SMS.`, { id: toastId });
        } else {
          toast.error(`Échec d'envoi (SMS & E-mail).`, { id: toastId });
        }
      } else if (player.phone) {
        if (smsSuccess) {
          toast.success(`SMS envoyé avec succès !`, { id: toastId });
        } else {
          toast.error(`Échec d'envoi du SMS.`, { id: toastId });
        }
      } else if (player.email) {
        if (emailSuccess) {
          toast.success(`E-mail de confirmation envoyé avec succès !`, { id: toastId });
        } else {
          toast.error(`Échec d'envoi de l'E-mail.`, { id: toastId });
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur lors du renvoi: ${err.message}`, { id: toastId });
    } finally {
      setSendingSmsId(null);
    }
  };

  // Réinitialiser le pointage global du joueur (remettre en non-pointé et enlever le dossard sur toutes ses inscriptions)
  const handleResetCheckIn = async (player: any) => {
    const sameRegs = players.filter(p => p.player_id === player.player_id);
    const hasClosedCategory = sameRegs.some(p => {
      const cat = categories.find(c => c.name === p.serie);
      return cat?.is_closed;
    });

    if (hasClosedCategory) {
      toast.error(`Certains tableaux de ce joueur sont clôturés 🔒. Réinitialisation globale impossible (annulez individuellement les tableaux ouverts).`);
      return;
    }

    const toastId = toast.loading("Réinitialisation complète du pointage...");
    try {
      const sameIds = sameRegs.map(p => p.id);

      const { error } = await supabase
        .from('registrations')
        .update({
          checked_in: false,
          dossard: null,
          paid: false,
          status: 'pending'
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

  const displayedPlayers = React.useMemo(() => {
    if (selectedSerie !== 'all') {
      return filteredPlayers.map(p => ({
        ...p,
        registrations: [p]
      }));
    }

    const groups = new Map<string, any>();

    filteredPlayers.forEach(p => {
      const key = p.licence_number && p.licence_number.trim() !== '' 
        ? `lic:${p.licence_number.trim()}` 
        : `name:${p.first_name?.toLowerCase().trim()}_${p.last_name?.toLowerCase().trim()}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          ...p,
          registrations: []
        });
      }
      groups.get(key).registrations.push(p);
    });

    return Array.from(groups.values());
  }, [filteredPlayers, selectedSerie]);

  if (!tournament) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-4 border border-indigo-100 shadow-sm">
          <Trophy className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Aucun tournoi actif</h3>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          Vous n'avez pas encore créé ou sélectionné de tournoi. Créez ou sélectionnez-en un dans le Tableau de Bord pour gérer le pointage des joueurs.
        </p>
        <button
          onClick={() => navigate('/organizer')}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition active:scale-95 duration-100"
        >
          Aller au Tableau de Bord
        </button>
      </div>
    );
  }

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
            onClick={() => navigate(`/organizer/checkin-scan/${tournament?.current_day || 1}`)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0f1f3d] hover:bg-[#1f355c] text-white rounded-xl font-medium transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            <QrCode className="w-5 h-5" />
            Scanner QR
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
                {cat.name} {cat.day_number && selectedDay === 'all' ? `(J${cat.day_number})` : ''} {cat.is_closed ? '🔒' : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bannière de contrôle du tableau sélectionné */}
      {selectedSerie !== 'all' && (() => {
        const cat = categories.find(c => c.name === selectedSerie);
        if (!cat) return null;
        
        const presents = players.filter(p => p.serie === cat.name && p.checked_in).length;
        const inscrits = players.filter(p => p.serie === cat.name).length;

        return (
          <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-all ${
            cat.is_closed 
              ? 'bg-rose-50/70 border-rose-150 text-rose-950 animate-fade-in' 
              : 'bg-emerald-50/50 border-emerald-150 text-emerald-950 animate-fade-in'
          }`}>
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 ${cat.is_closed ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {cat.is_closed ? <LockIcon className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold flex items-center gap-1.5 flex-wrap">
                  Pointage du Tableau - <strong className="font-extrabold uppercase">{cat.name}</strong>
                  {cat.is_closed ? (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-600 text-white inline-flex items-center gap-1">
                      🔒 Clôturé
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-600 text-white inline-flex items-center gap-1">
                      🔓 Ouvert
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                  {cat.is_closed 
                    ? "Le pointage et les inscriptions sont verrouillés pour ce tableau. Vous pouvez maintenant configurer et générer les poules en toute sérénité."
                    : "Le pointage en direct est ouvert aux joueurs. Une fois tout le monde pointé présent, clôturez ce tableau pour débloquer la génération des poules."
                  }
                </p>
                <div className="flex gap-4 text-[11px] font-bold text-slate-450 pt-1">
                  <span>Inscrits total : <strong className="text-slate-800">{inscrits}</strong></span>
                  <span>Pointés présents : <strong className={cat.is_closed ? "text-rose-650" : "text-emerald-650"}>{presents}</strong></span>
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleCategoryClosure(cat)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer shrink-0 ${
                cat.is_closed
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 hover:border-slate-300'
                  : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-100'
              }`}
            >
              {cat.is_closed ? (
                <>
                  <Unlock className="w-4 h-4" />
                  Réouvrir le Pointage
                </>
              ) : (
                <>
                  <LockIcon className="w-4 h-4" />
                  Clôturer & Bloquer le Pointage
                </>
              )}
            </button>
          </div>
        );
      })()}

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
              ) : displayedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-450 font-medium italic">
                    Aucun joueur correspondant à vos filtres.
                  </td>
                </tr>
              ) : (
                displayedPlayers.map((player) => {
                  const linkedDossard = players.find(p => (
                    (p.licence_number && player.licence_number && p.licence_number === player.licence_number) ||
                    ((!p.licence_number || !player.licence_number) && 
                     p.first_name?.toLowerCase().trim() === player.first_name?.toLowerCase().trim() && 
                     p.last_name?.toLowerCase().trim() === player.last_name?.toLowerCase().trim())
                  ) && p.dossard)?.dossard || player.dossard;

                  const isSomeCheckedIn = player.registrations.some((r: any) => r.checked_in);

                  return (
                    <tr key={player.player_id || player.id} className={`hover:bg-slate-50/70 transition-colors group ${isSomeCheckedIn ? 'bg-emerald-50/5' : ''}`}>
                      
                      {/* Colonne JOUEUR / DOSSARD */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {linkedDossard ? (
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
                          )}
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
                        <div className="flex flex-col gap-2">
                          {player.registrations.map((reg: any) => {
                            const currentCat = categories.find(c => c.name === reg.serie);
                            const isOriginalClosed = currentCat?.is_closed;

                            return (
                              <div key={reg.id} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                <select
                                  id={`player-serie-select-${reg.id}`}
                                  value={reg.serie}
                                  disabled={isOriginalClosed}
                                  onChange={async (e) => {
                                    const newSerieName = e.target.value;
                                    const newCat = categories.find(c => c.name === newSerieName);
                                    if (newCat?.is_closed) {
                                      toast.error(`Le tableau de destination "${newSerieName}" est clôturé 🔒. Impossible d'y transférer un joueur.`);
                                      return;
                                    }
                                    updatePlayerSerie(reg.id, newSerieName, reg.first_name, reg.last_name);
                                  }}
                                  className={`font-black border text-[11px] px-2.5 py-1.5 rounded-xl outline-none transition-all shadow-sm max-w-[155px] truncate ${
                                    isOriginalClosed 
                                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                                      : 'bg-indigo-50/60 hover:bg-slate-100 text-indigo-700 border-indigo-100/50 cursor-pointer focus:ring-2 focus:ring-indigo-400'
                                  }`}
                                  title={isOriginalClosed ? "Tableau clôturé" : "Modifier la série"}
                                >
                                  {categories.map((c) => (
                                    <option key={c.id} value={c.name} className="text-slate-800 bg-white font-medium" disabled={c.is_closed}>
                                      {c.name} (J{c.day_number}) {c.is_closed ? '🔒 [CLOS]' : ''}
                                    </option>
                                  ))}
                                  {!categories.some((c) => c.name === reg.serie) && (
                                    <option value={reg.serie} className="text-slate-850 bg-white font-medium">
                                      {reg.serie}
                                    </option>
                                  )}
                                </select>

                                {/* Action individuelle de corbeille 🗑️ à côté de chaque tableau */}
                                {confirmDeleteId === reg.id ? (
                                  <div className="flex items-center gap-1 animate-fade-in scale-90">
                                    <button
                                      onClick={async () => {
                                        await deletePlayer(reg.id);
                                        setConfirmDeleteId(null);
                                      }}
                                      className="px-2 py-1 text-[9px] font-black bg-rose-600 text-white rounded-lg hover:bg-rose-700 active:scale-95 transition-all cursor-pointer shadow-sm animate-pulse"
                                    >
                                      Confirmer 🗑️
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      if (isOriginalClosed) {
                                        toast.error(`Le tableau "${reg.serie}" est clôturé 🔒. Impossible de supprimer cette inscription.`);
                                        return;
                                      }
                                      setConfirmDeleteId(reg.id);
                                      setTimeout(() => {
                                        setConfirmDeleteId(prev => prev === reg.id ? null : prev);
                                      }, 4000);
                                    }}
                                    disabled={isOriginalClosed}
                                    className={`p-1 rounded-lg transition-all ${
                                      isOriginalClosed 
                                        ? 'text-slate-200 cursor-not-allowed opacity-30' 
                                        : 'text-slate-350 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                                    }`}
                                    title={isOriginalClosed ? "Tableau clôturé d'origine" : "Supprimer cette inscription"}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Colonne CLASSEMENT (POINTS) */}
                      <td className="px-6 py-4">
                        <span className="inline-flex text-[11px] font-bold tracking-wider font-mono px-2 py-1 bg-slate-50 border border-slate-150 rounded-lg text-slate-600">
                          {player.points ?? '500'} pts
                        </span>
                      </td>

                      {/* Colonne POINTAGE J-J (RÈGLEMENT & DOSSARD) */}
                      <td className="px-6 py-4 text-center">
                        {(() => {
                          const uncheckedRegs = player.registrations.filter((r: any) => !r.checked_in);
                          const checkedRegs = player.registrations.filter((r: any) => r.checked_in);

                          if (uncheckedRegs.length > 0) {
                            const regToCheckIn = uncheckedRegs[0];
                            const currentCat = categories.find(c => c.name === regToCheckIn.serie);
                            const isOriginalClosed = currentCat?.is_closed;

                            if (isOriginalClosed) {
                              return (
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-400 border border-slate-200/60 text-xs font-bold rounded-lg justify-center shadow-inner">
                                  <LockIcon className="w-3.5 h-3.5" /> Clôturé 🔒 (Absent)
                                </span>
                              );
                            }

                            return (
                              <div className="flex flex-col items-center gap-1.5 justify-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    id={`checkin-cb-btn-${regToCheckIn.id}`}
                                    onClick={() => handleTableCheckIn(regToCheckIn)}
                                    className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm rounded-lg active:scale-95 transition-all cursor-pointer"
                                  >
                                    Pointer (CB)
                                  </button>
                                  <button
                                    id={`checkin-pay-btn-${regToCheckIn.id}`}
                                    onClick={() => handleTableCheckIn(regToCheckIn)}
                                    className="px-3.5 py-1.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <BadgeEuro className="w-4 h-4" /> Encaisser
                                  </button>
                                </div>
                                {checkedRegs.length > 0 && (
                                  <span className="text-[10px] text-emerald-600 font-bold">
                                    {checkedRegs.length} série(s) déjà pointée(s)
                                  </span>
                                )}
                              </div>
                            );
                          } else {
                            const firstReg = player.registrations[0] || player;
                            const isAnyClosed = player.registrations.some((r: any) => categories.find(c => c.name === r.serie)?.is_closed);

                            return (
                              <div className="flex items-center justify-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-700 border border-emerald-500/10 text-xs font-bold rounded-lg justify-center shadow-inner">
                                  <CheckCircle className="w-4 h-4 text-emerald-600" /> Pointé (Dossard #{linkedDossard})
                                </span>
                                {!isAnyClosed ? (
                                  <button
                                    id={`forfait-single-btn-${firstReg.id}`}
                                    onClick={() => handleCancelSingleCheckIn(firstReg)}
                                    className="p-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                                    title="Annuler le pointage / Forfait"
                                  >
                                    <X className="w-3.5 h-3.5" /> Forfait
                                  </button>
                                ) : (
                                  <span className="p-1.5 px-2 bg-slate-50 text-slate-400 border border-slate-200/50 rounded-lg text-[10px] font-semibold inline-flex items-center gap-1 cursor-not-allowed" title="Le tableau est clôturé">
                                    <LockIcon className="w-3 h-3 text-slate-300" /> Clôturé 🔒
                                  </span>
                                )}
                              </div>
                            );
                          }
                        })()}
                      </td>

                      {/* Colonne IDENTIFIANTS SMS ET/OU EMAIL DE SCORE */}
                      <td className="px-6 py-4 text-center">
                        {isSomeCheckedIn ? (
                          (player.phone || player.email) ? (
                            <button
                              onClick={() => handleResendSms(player.registrations[0] || player)}
                              disabled={sendingSmsId === player.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                              title={
                                player.phone && player.email ? "Envoyer par SMS et E-mail/SMTP" :
                                player.phone ? "Envoyer par SMS uniquement" : "Envoyer par E-mail/SMTP uniquement"
                              }
                            >
                              <Send className={`w-3.5 h-3.5 ${sendingSmsId === player.id ? 'animate-pulse text-indigo-500' : 'text-slate-400'}`} />
                              Renvoyer identifiants
                            </button>
                          ) : (
                            <span className="text-[10px] text-rose-500 font-semibold bg-rose-50 border border-rose-100 px-2 py-1 rounded-md inline-flex items-center gap-1 leading-none">
                              <AlertCircle className="w-3.5 h-3.5" /> Pas de contact
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium italic flex items-center gap-1 justify-center">
                            <Clock className="w-3.5 h-3.5" /> En attente du pointage
                          </span>
                        )}
                      </td>

                      {/* Colonne ACTIONS (PROPRE ET DISCRETE) */}
                      <td className="px-6 py-4 text-right">
                        <span className="text-slate-300 font-mono text-[9px] select-none">—</span>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
