import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  React.useEffect(() => {
    const target = document.getElementById('operations-header-actions');
    if (target) {
      setPortalTarget(target);
    }
  }, []);

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

  const [isSearchingLicence, setIsSearchingLicence] = useState(false);

  const handleLookupLicence = async (forcedLicence?: string) => {
    const lic = (forcedLicence || formData.licence_number)?.trim();
    if (!lic) {
      toast.error('Veuillez saisir un numéro de licence d’abord.');
      return;
    }
    
    setIsSearchingLicence(true);
    const toastId = toast.loading("Interrogation de la base de données FFTT...");
    try {
      const ffttData = await fetchPlayerByLicence(lic);
      if (ffttData) {
        toast.success(`👤 Profil FFTT importé : ${ffttData.prenom} ${ffttData.nom} (${ffttData.classement || 500} pts)`, { id: toastId });
        
        let formattedPrenom = ffttData.prenom || '';
        if (formattedPrenom && formattedPrenom === formattedPrenom.toUpperCase()) {
          formattedPrenom = formattedPrenom.charAt(0) + formattedPrenom.slice(1).toLowerCase();
        }

        setFormData(prev => ({
          ...prev,
          first_name: formattedPrenom,
          last_name: ffttData.nom || '',
          club: ffttData.club || '',
          points: (ffttData.classement || ffttData.mensuel || ffttData.initial || 500).toString(),
        }));
      } else {
        toast.error("Aucune information trouvée pour ce numéro de licence.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Licence introuvable ou service FFTT indisponible.", { id: toastId });
      console.warn("Erreur auto-lookup licence:", err);
    } finally {
      setIsSearchingLicence(false);
    }
  };

  React.useEffect(() => {
    const lic = formData.licence_number?.trim();
    if (lic && lic.length === 7 && /^\d+$/.test(lic) && !isSearchingLicence) {
      if (!formData.first_name && !formData.last_name) {
        handleLookupLicence(lic);
      }
    }
  }, [formData.licence_number]);

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
      <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center animate-in fade-in duration-300" id="no-tournament-active">
        <div className="w-16 h-16 bg-[#152031] rounded-2xl flex items-center justify-center text-[#f97316] mb-4 border border-[#20324e] shadow-lg shadow-orange-500/5">
          <Trophy className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2 font-display">Aucun tournoi actif</h3>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          Vous n'avez pas encore créé ou sélectionné de tournoi. Créez ou sélectionnez-en un dans le Tableau de Bord pour gérer le pointage des joueurs.
        </p>
        <button
          onClick={() => navigate('/organizer')}
          className="px-5 py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-xl text-sm font-extrabold shadow-md hover:shadow-orange-500/10 transition active:scale-95 duration-100 cursor-pointer flex items-center gap-2"
        >
          Aller au Tableau de Bord
        </button>
      </div>
    );
  }

  const checkedInCount = players.filter(p => p.checked_in).length;
  const progressPercent = players.length > 0 ? Math.round((checkedInCount / players.length) * 100) : 0;

  return (
    <div className="w-full max-w-[1600px] 2xl:max-w-[1850px] mx-auto space-y-6 animate-fade-in text-[#d8e3fb]">
      {portalTarget && createPortal(
        <>
          <button 
            onClick={refresh}
            disabled={loading}
            className="p-2.5 rounded-xl border border-[#2a3548] text-slate-300 hover:bg-[#111c2d] transition-colors disabled:opacity-50 cursor-pointer h-10 w-10 flex items-center justify-center shrink-0"
            title="Actualiser la liste"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate(`/organizer/checkin-scan/${tournament?.current_day || 1}`)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#f97316] hover:bg-orange-600 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 cursor-pointer text-xs uppercase tracking-wider h-10 shrink-0"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">Scanner QR</span>
            <span className="sm:hidden">Scanner</span>
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1f2a3c] hover:bg-[#2a3548] text-white rounded-xl font-bold transition-all border border-[#2a3548] shadow-lg active:scale-95 cursor-pointer text-xs uppercase tracking-wider h-10 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Ajouter un Joueur</span>
            <span className="sm:hidden">Ajouter</span>
          </button>
        </>,
        portalTarget
      )}

      {/* Formulaire d'ajout rapide de joueur (collapsable) */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#152031] rounded-2xl border border-[#2a3548] my-4 shadow-2xl"
          >
            <form onSubmit={handleSubmit} className="p-6">
              {/* --- ULTRA SIMPLIFIED FFTT LICENCE FLOW --- */}
              <div className="max-w-xl mx-auto space-y-5 py-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2 flex justify-between items-center">
                      <span>Numéro de Licence (7 chiffres)</span>
                      <span className="text-[10px] text-[#f97316] font-extrabold lowercase flex items-center gap-1 animate-pulse">
                        <span>détection auto</span> 🏓
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Ex: 5912345"
                        maxLength={7}
                        className="w-full px-4 py-2.5 bg-[#081425] border border-[#1a3056] rounded-xl focus:border-[#f97316] outline-none text-white transition-all text-xs font-mono font-black tracking-widest"
                        value={formData.licence_number}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 7);
                          setFormData({ ...formData, licence_number: val });
                        }}
                      />
                      {isSearchingLicence && (
                        <div className="absolute right-3 top-3">
                          <RefreshCw className="w-4 h-4 text-[#f97316] animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLookupLicence()}
                    disabled={isSearchingLicence || !formData.licence_number}
                    className="w-full py-2.5 bg-[#1f2a3c] hover:bg-[#2a3548] text-white border border-[#2a3548] rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 h-[38px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <span>Rechercher</span>
                  </button>
                </div>

                {/* FFTT Profile Preview Card */}
                {formData.first_name && formData.last_name ? (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-4 bg-emerald-950/25 border-2 border-emerald-500/30 rounded-xl relative overflow-hidden"
                  >
                    <div className="absolute right-3 top-3 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/30 text-[9px] font-black text-emerald-400 uppercase tracking-wider">
                      Licencié FFTT ✓
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-white uppercase tracking-wide">
                          {formData.first_name} {formData.last_name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">
                          Club: <span className="text-white font-bold">{formData.club || "Indépendant"}</span>
                          <span className="mx-2 text-slate-600">•</span>
                          Points: <span className="text-[#f97316] font-extrabold">{formData.points || 500} pts</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-emerald-500/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">
                          Téléphone (optionnel - alertes SMS de match)
                        </label>
                        <input
                          type="tel"
                          placeholder="Ex: 0612345678"
                          className="w-full px-3 py-1.5 bg-[#081425] border border-emerald-500/10 rounded-lg focus:border-[#f97316] outline-none text-white text-xs font-mono"
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">
                          Tableau / Série d'affectation *
                        </label>
                        <select
                          className="w-full px-3 py-1.5 bg-[#081425] border border-emerald-500/10 rounded-lg focus:border-[#f97316] outline-none text-white text-xs font-bold cursor-pointer"
                          value={formData.serie}
                          onChange={e => setFormData({ ...formData, serie: e.target.value })}
                        >
                          {categories.length > 0 ? (
                            categories.map(c => (
                              <optgroup key={c.id} label={`Jour ${c.day_number}`} className="bg-[#081425] text-slate-400 text-[10px]">
                                <option value={c.name} className="bg-[#081425] text-white text-xs font-bold">
                                  {c.name}
                                </option>
                              </optgroup>
                            ))
                          ) : (
                            SERIES.map(s => <option key={s} value={s} className="bg-[#081425]">{s}</option>)
                          )}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="p-6 bg-[#081425]/40 border border-[#1a3056]/40 rounded-xl text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                    <span className="text-xl">🏓</span>
                    <p className="font-medium">Saisissez un numéro de licence valide ci-dessus.</p>
                    <p className="text-[10px] text-slate-500">Les coordonnées, club et points officiels seront importés en 1 seconde et affichés sous forme de carte.</p>
                  </div>
                )}

                {/* Validation du joueur FFTT */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!formData.first_name || !formData.last_name}
                    className={`w-full py-3 rounded-xl font-black transition-all shadow-md active:scale-[0.98] cursor-pointer text-xs uppercase flex items-center justify-center gap-2
                      ${(formData.first_name && formData.last_name) 
                        ? 'bg-[#f97316] hover:bg-orange-600 text-white animate-fade-in' 
                        : 'bg-[#1a3056] text-slate-500 cursor-not-allowed border border-[#101b2c]'}`}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Valider l'Inscription du Joueur</span>
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid Filtres & Progression Active */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Filtres et recherche intégrés */}
        <div className="lg:col-span-3 bg-[#152031] p-4 rounded-xl border border-[#2a3548] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex bg-[#081425] p-1 rounded-xl border border-[#1a3056] shrink-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg flex items-center gap-2 transition-all cursor-pointer
                ${activeTab === 'all' 
                  ? 'bg-[#152031] text-white shadow-md border border-[#2a3548]' 
                  : 'text-slate-400 hover:text-white'}`}
            >
              Tous les Joueurs
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#0c1827] text-slate-300 font-bold border border-[#1a3056]">
                {players.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('to_check')}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg flex items-center gap-2 transition-all cursor-pointer
                ${activeTab === 'to_check' 
                  ? 'bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20' 
                  : 'text-slate-400 hover:text-[#f97316]'}`}
            >
              <UserX className="w-3.5 h-3.5 text-[#f97316]" />
              À pointer
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#0c1827] text-slate-300 font-bold border border-[#1a3056]">
                {players.filter(p => !p.checked_in).length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('checked')}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg flex items-center gap-2 transition-all cursor-pointer
                ${activeTab === 'checked' 
                  ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/20' 
                  : 'text-slate-400 hover:text-[#10b981]'}`}
            >
              <Check className="w-3.5 h-3.5 text-[#10b981]" />
              Pointés
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#0c1827] text-[#10b981] font-bold border border-[#1a3056]">
                {players.filter(p => p.checked_in).length}
              </span>
            </button>
          </div>

          {/* Sélecteur de Journée compact (remplace l'input de recherche) */}
          <div className="flex bg-[#081425] p-1 rounded-xl border border-[#1a3056] shrink-0 items-center gap-1.5 flex-wrap">
            {uniqueDays.map(dayNum => {
              const isToday = tournament?.current_day === dayNum;
              const isActive = selectedDay === dayNum;
              return (
                <button
                  key={dayNum}
                  onClick={() => {
                    setSelectedDay(dayNum);
                    setSelectedSerie('all');
                  }}
                  className={`px-3 py-1.5 text-[11px] font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-[#f97316] text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Journée {dayNum}
                  {isToday && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-black/30 text-white animate-pulse">
                      Actif
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel Progression active */}
        <div className="bg-[#152031] p-4 rounded-xl border border-[#2a3548] flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse shrink-0" />
            <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">Suivi du pointage en direct</span>
          </div>
          <div className="text-right">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">PROGRESSION</span>
            <span className="text-xl sm:text-2xl font-black text-[#10b981] tracking-tight">{progressPercent}%</span>
          </div>
        </div>
      </div>

      {/* Barre de Recherche & Filtres Tableaux de Pointage Intégrés */}
      <div className="bg-[#152031] p-3 rounded-xl border border-[#2a3548] flex flex-wrap items-center gap-3">
        {/* Recherche réduite */}
        <div className="relative w-full max-w-[150px] shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="w-full pl-8 pr-2.5 py-1.5 bg-[#081425] border border-[#1a3056] rounded-lg text-xs font-bold focus:border-[#f97316] outline-none text-white transition-all placeholder:text-slate-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Séries de Tableaux à côté */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setSelectedSerie('all');
            }}
            className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all border border-[#1a3056] cursor-pointer ${
              selectedSerie === 'all'
                ? 'bg-white text-[#081425] shadow-md border-white'
                : 'bg-[#081425] text-slate-300 hover:bg-[#111c2d]'
            }`}
          >
            Tous les Tableaux
          </button>
          {(selectedDay === 'all' ? categories : categories.filter(c => c.day_number === selectedDay)).map(cat => {
            const isActive = selectedSerie === cat.name;
            const bgCol = cat.color_code || '#4f46e5';
            const textCol = isActive ? getContrastColor(bgCol) : '';
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedSerie(isActive ? 'all' : cat.name)}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 border border-[#1a3056] cursor-pointer ${
                  isActive ? '' : 'bg-[#081425] text-slate-300 hover:bg-[#111c2d]'
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
      {selectedSerie !== 'all' && (() => {
        const cat = categories.find(c => c.name === selectedSerie);
        if (!cat) return null;
        
        const presents = players.filter(p => p.serie === cat.name && p.checked_in).length;
        const inscrits = players.filter(p => p.slice === cat.name || p.serie === cat.name).length;

        return (
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-all ${
            cat.is_closed 
              ? 'bg-rose-950/10 border-rose-500/20 text-rose-200 animate-fade-in' 
              : 'bg-emerald-950/10 border-emerald-500/20 text-emerald-200 animate-fade-in'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg shrink-0 ${cat.is_closed ? 'bg-rose-500/10 text-rose-450' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {cat.is_closed ? <LockIcon className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold flex items-center gap-1.5 flex-wrap">
                  Pointage du Tableau - <strong className="font-extrabold uppercase text-white">{cat.name}</strong>
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
                <p className="text-xs text-slate-405 leading-relaxed">
                  {cat.is_closed 
                    ? "Le pointage et les inscriptions sont verrouillés pour ce tableau. Vous pouvez maintenant configurer et générer les poules en toute sérénité."
                    : "Le pointage en direct est ouvert aux joueurs. Une fois tout le monde pointé présent, clôturez ce tableau pour débloquer la génération des poules."
                  }
                </p>
                <div className="flex gap-4 text-[10px] font-bold text-slate-350 pt-1">
                  <span>Inscrits total : <strong className="text-white">{inscrits}</strong></span>
                  <span>Pointés présents : <strong className={cat.is_closed ? "text-rose-400" : "text-[#10b981]"}>{presents}</strong></span>
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleCategoryClosure(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer shrink-0 ${
                cat.is_closed
                  ? 'bg-[#152031] hover:bg-[#1f2a3c] text-white border border-[#2a3548]'
                  : 'bg-[#991b1b] hover:bg-rose-800 text-white'
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
                  Clôturer & Bloquer
                </>
              )}
            </button>
          </div>
        );
      })()}

      {/* Tableau interactif principal */}
      <div className="bg-[#152031] rounded-2xl border border-[#2a3548] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2a3548] bg-[#0e1b30]">
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">#</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Joueur</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Licence / Tél</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Tableau / Journée</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Points</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Statut Pointage</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Identifiants Saisie Scores</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a3056]/40">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium bg-[#152031]">
                    <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[#f97316] mb-2" />
                    Chargement des participants en cours...
                  </td>
                </tr>
              ) : displayedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-medium italic bg-[#152031]">
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
                    <tr key={player.player_id || player.id} className={`hover:bg-[#0c1827] transition-colors border-b border-[#1a3056]/30 bg-[#152031] ${isSomeCheckedIn ? 'bg-[#10b981]/5' : ''}`}>
                      
                      {/* Numéro de dossard ou placeholder */}
                      <td className="px-5 py-4">
                        {linkedDossard ? (
                          <button 
                            id={`player-dossard-badge-${player.id}`}
                            onClick={() => handleResetCheckIn(player)}
                            className="inline-flex items-center justify-center w-8 h-8 bg-[#10b981]/15 text-[#10b981] font-mono font-black border border-[#10b981]/30 rounded-xl text-xs hover:bg-rose-950/20 hover:text-rose-450 hover:border-rose-900/40 transition-all duration-150 cursor-pointer"
                            title="Cliquez pour réinitialiser le pointage complet de ce joueur"
                          >
                            {linkedDossard}
                          </button>
                        ) : (
                          <div className="w-8 h-8 bg-[#081425] border border-[#1a3056] rounded-xl flex items-center justify-center text-slate-500 font-bold text-xs">
                            —
                          </div>
                        )}
                      </td>

                      {/* Joueur */}
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-extrabold text-white leading-tight text-sm">
                            {player.last_name.toUpperCase()} {player.first_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-bold italic">
                            <span>{player.club || 'Sans club / Non licencié'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Licence / Tél */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 text-[11px] font-bold font-mono text-slate-450">
                          {player.licence_number ? (
                            <span className="bg-[#081425] border border-[#1a3056]/40 px-1.5 py-0.5 rounded w-fit text-slate-300">
                              LIC: {player.licence_number}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic font-medium">Pas de licence</span>
                          )}
                          {player.phone ? (
                            <span className="flex items-center gap-1 bg-[#081425] border border-[#1a3056]/40 px-1.5 py-0.5 rounded w-fit text-slate-350">
                              <Smartphone className="w-3 h-3 text-[#f97316]" /> {player.phone}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Tableau / Journée */}
                      <td className="px-5 py-4">
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
                                      ? 'bg-[#081425] text-slate-500 border-[#1a3056] cursor-not-allowed opacity-60' 
                                      : 'bg-[#0e1b30] hover:bg-[#13223a] text-[#f97316] border-[#1a3056] cursor-pointer focus:border-[#f97316]'
                                  }`}
                                  title={isOriginalClosed ? "Tableau clôturé d'origine" : "Modifier la série"}
                                >
                                  {categories.map((c) => (
                                    <option key={c.id} value={c.name} className="text-white bg-[#0f1f3d] font-bold" disabled={c.is_closed}>
                                      {c.name} (J{c.day_number}) {c.is_closed ? '🔒' : ''}
                                    </option>
                                  ))}
                                  {!categories.some((c) => c.name === reg.serie) && (
                                    <option value={reg.serie} className="text-white bg-[#0f1f3d] font-bold">
                                      {reg.serie}
                                    </option>
                                  )}
                                </select>

                                {/* Action individuelle de suppression */}
                                {confirmDeleteId === reg.id ? (
                                  <div className="flex items-center gap-1 animate-fade-in scale-90 shrink-0">
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
                                      className="p-1 text-slate-400 hover:text-slate-300 rounded-lg cursor-pointer"
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
                                    className={`p-1 rounded-lg transition-all shrink-0 ${
                                      isOriginalClosed 
                                        ? 'text-slate-500 cursor-not-allowed opacity-30' 
                                        : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50/10 cursor-pointer'
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

                      {/* Points */}
                      <td className="px-5 py-4">
                        <span className="text-sm sm:text-base font-black tracking-wider font-mono text-slate-200">
                          {player.points ?? '500'}
                        </span>
                      </td>

                      {/* Statut Pointage */}
                      <td className="px-5 py-4 text-center">
                        {(() => {
                          const uncheckedRegs = player.registrations.filter((r: any) => !r.checked_in);
                          const checkedRegs = player.registrations.filter((r: any) => r.checked_in);

                          if (uncheckedRegs.length > 0) {
                            const regToCheckIn = uncheckedRegs[0];
                            const currentCat = categories.find(c => c.name === regToCheckIn.serie);
                            const isOriginalClosed = currentCat?.is_closed;

                            if (isOriginalClosed) {
                              return (
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#081425] text-slate-500 border border-[#1a3056] text-xs font-bold rounded-lg justify-center shadow-inner">
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
                                    className="px-3 py-1.5 text-xs font-bold bg-[#1f2a3c] hover:bg-[#2a3548] text-slate-200 border border-[#2a3548] rounded-xl active:scale-95 transition-all cursor-pointer"
                                  >
                                    Pointer (CB)
                                  </button>
                                  <button
                                    id={`checkin-pay-btn-${regToCheckIn.id}`}
                                    onClick={() => handleTableCheckIn(regToCheckIn)}
                                    className="px-3.5 py-1.5 text-xs font-black bg-[#f97316] hover:bg-orange-600 text-white rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <BadgeEuro className="w-4 h-4" /> Encaisser
                                  </button>
                                </div>
                                {checkedRegs.length > 0 && (
                                  <span className="text-[10px] text-[#10b981] font-bold">
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
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 text-xs font-bold rounded-lg justify-center shadow-inner">
                                  <CheckCircle className="w-4 h-4 text-[#10b981]" /> Pointé (Dossard #{linkedDossard})
                                </span>
                                {!isAnyClosed ? (
                                  <button
                                    id={`forfait-single-btn-${firstReg.id}`}
                                    onClick={() => handleCancelSingleCheckIn(firstReg)}
                                    className="p-1 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                                    title="Annuler le pointage / Forfait"
                                  >
                                    <X className="w-3.5 h-3.5" /> Forfait
                                  </button>
                                ) : (
                                  <span className="p-1.5 px-2 bg-[#081425] text-slate-500 border border-[#1a3056] rounded-lg text-[10px] font-semibold inline-flex items-center gap-1 cursor-not-allowed" title="Le tableau est clôturé">
                                    <LockIcon className="w-3 h-3 text-slate-400" /> Clôturé 🔒
                                  </span>
                                )}
                              </div>
                            );
                          }
                        })()}
                      </td>

                      {/* Identifiant SMS/Email */}
                      <td className="px-5 py-4 text-center">
                        {isSomeCheckedIn ? (
                          (player.phone || player.email) ? (
                            <button
                              onClick={() => handleResendSms(player.registrations[0] || player)}
                              disabled={sendingSmsId === player.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-350 bg-[#0e1b30] hover:bg-[#14233c] border border-[#1a3056] rounded-lg transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                              title={
                                player.phone && player.email ? "Envoyer par SMS et E-mail/SMTP" :
                                player.phone ? "Envoyer par SMS uniquement" : "Envoyer par E-mail/SMTP uniquement"
                              }
                            >
                              <Send className={`w-3.5 h-3.5 ${sendingSmsId === player.id ? 'animate-pulse text-[#f97316]' : 'text-slate-400'}`} />
                              Renvoyer id
                            </button>
                          ) : (
                            <span className="text-[10px] text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/15 px-2 py-1 rounded-md inline-flex items-center gap-1 leading-none">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-450" /> Pas de contact
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium italic flex items-center gap-1 justify-center">
                            <Clock className="w-3.5 h-3.5 text-slate-500" /> Attente pointage
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <span className="text-slate-600 font-mono text-[9px] select-none">—</span>
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
