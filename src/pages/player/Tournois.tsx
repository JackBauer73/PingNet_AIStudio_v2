import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';
import { usePlayers } from '../../hooks/usePlayers';
import { supabase, isSupabaseConfigured } from '../../supabase';
import { Trophy, Calendar, MapPin, Users, LogIn, ChevronRight, Sparkles, CheckCircle2, UserPlus, Info, Search, ArrowLeft, Loader2, Check, ArrowRight, Zap, Smartphone, Phone, Layers, Activity, Key, Copy, SlidersHorizontal, LayoutGrid, Clock, Mail } from 'lucide-react';
import { fetchPlayerByLicence } from '../../services/ffttApi';
import { sendPlayerEmail } from '../../services/emailService';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import PublicHeader from '../../components/layout/PublicHeader';

export default function Tournois() {
  const { tournament, stats, loading, allTournaments, selectTournament, refresh } = useTournament({ forcePublic: true });
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'apercu' | 'tableaux' | 'inscrits' | 'infos'>('apercu');
  const [showAdminLink, setShowAdminLink] = useState(true);

  useEffect(() => {
    // Keep Admin link visible
    setShowAdminLink(true);
  }, []);
  
  // États de recherche et filtre basés sur l'image
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'open' | 'live' | 'upcoming' | 'finished'>('all');
  const [tournamentStats, setTournamentStats] = useState<Record<string, {
    registrationsCount: number;
    capacitySum: number;
    categoriesCount: number;
  }>>({});
  const [organizerProfiles, setOrganizerProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    if (allTournaments.length === 0) return;
    
    const fetchOrganizerProfiles = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const organizerIds = Array.from(new Set(allTournaments.map(t => t.organizer_id).filter(Boolean)));
        if (organizerIds.length === 0) return;

        const { data, error } = await supabase
          .from('club_profiles')
          .select('*')
          .in('id', organizerIds);

        if (error) {
          console.warn("Erreur d'accès à la table 'club_profiles' (en lecture publique) :", error);
          return;
        }

        if (data && data.length > 0) {
          const profilesMap: Record<string, any> = {};
          data.forEach(profile => {
            profilesMap[profile.id] = profile;
          });
          setOrganizerProfiles(profilesMap);
        }
      } catch (err) {
        console.error('Erreur générale lors de la récupération des profils de club:', err);
      }
    };

    fetchOrganizerProfiles();
  }, [allTournaments]);

  useEffect(() => {
    if (allTournaments.length === 0) return;
    
    const fetchAllStats = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const { data: categoriesData, error: catError } = await supabase
          .from('table_categories')
          .select('tournament_id, capacity');
          
        const { data: regsData, error: regError } = await supabase
          .from('registrations')
          .select('tournament_id');
          
        if (catError || regError) throw catError || regError;
        
        const statsMap: Record<string, { registrationsCount: number; capacitySum: number; categoriesCount: number }> = {};
        
        allTournaments.forEach(t => {
          statsMap[t.id] = { registrationsCount: 0, capacitySum: 0, categoriesCount: 0 };
        });
        
        categoriesData?.forEach(cat => {
          if (statsMap[cat.tournament_id]) {
            statsMap[cat.tournament_id].categoriesCount += 1;
            statsMap[cat.tournament_id].capacitySum += Number(cat.capacity || 32);
          }
        });
        
        regsData?.forEach(reg => {
          if (statsMap[reg.tournament_id]) {
            statsMap[reg.tournament_id].registrationsCount += 1;
          }
        });
        
        setTournamentStats(statsMap);
      } catch (err) {
        console.error('Erreur lors du calcul des statistiques de tournois:', err);
      }
    };
    
    fetchAllStats();
  }, [allTournaments]);

  const getTournamentTag = (t: any) => {
    if (t.status === 'finished' || t.status === 'closed' || t.status === 'archived') {
      return { label: 'Terminé', dot: 'bg-slate-400', badgeClass: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' };
    }
    if (['pools', 'bracket', 'in_progress'].includes(t.status)) {
      return { label: 'Live', dot: 'bg-blue-500', badgeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' };
    }
    
    const isFuture = new Date(t.date) > new Date();
    const payMethods: any = t.payment_methods || {};
    const regPeriods = payMethods.registration_periods || {};
    let notStartedYet = false;
    
    const now = new Date();
    const periods = Object.values(regPeriods) as Array<{ start: string; end: string }>;
    if (periods.length > 0) {
      const allFuture = periods.every(p => new Date(p.start) > now);
      if (allFuture) {
        notStartedYet = true;
      }
    }
    
    const loc = (t.location || '').toLowerCase();
    if (loc.includes('nantes') || loc.includes('lille')) {
      return { label: 'À venir', dot: 'bg-amber-500', badgeClass: 'bg-amber-500/10 text-amber-500 border border-amber-500/20' };
    }
    if (loc.includes('lyon')) {
      return { label: 'Live', dot: 'bg-blue-500', badgeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse' };
    }
    if (loc.includes('marseille')) {
      return { label: 'Terminé', dot: 'bg-slate-400', badgeClass: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' };
    }
    
    if (notStartedYet || (isFuture && t.status !== 'open' && t.status !== 'registration')) {
      return { label: 'À venir', dot: 'bg-amber-500', badgeClass: 'bg-amber-500/10 text-amber-500 border border-amber-500/20' };
    }
    
    if (t.status === 'open' || t.status === 'registration') {
      return { label: 'Ouvert', dot: 'bg-emerald-500', badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    }
    
    return { label: 'À venir', dot: 'bg-amber-500', badgeClass: 'bg-amber-500/10 text-amber-500 border border-amber-500/20' };
  };

  const getFilteredTournaments = () => {
    return allTournaments.filter(t => {
      const tag = getTournamentTag(t);
      
      if (filterTab === 'open' && tag.label !== 'Ouvert') return false;
      if (filterTab === 'live' && tag.label !== 'Live') return false;
      if (filterTab === 'upcoming' && tag.label !== 'À venir') return false;
      if (filterTab === 'finished' && tag.label !== 'Terminé') return false;
      
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const nameMatch = t.name.toLowerCase().includes(term);
        const locMatch = (t.location || '').toLowerCase().includes(term);
        
        const clubName = t.location?.toLowerCase().includes('bordeaux') ? 'bordeaux métropole' :
                         t.location?.toLowerCase().includes('toulouse') ? 'asptt toulouse' :
                         t.location?.toLowerCase().includes('lyon') ? 'lyon tennis de table' :
                         t.location?.toLowerCase().includes('nantes') ? 'us nantes tt' :
                         t.location?.toLowerCase().includes('lille') ? 'lille métropole' :
                         t.location?.toLowerCase().includes('marseille') ? 'marseille provence' :
                         '';
        const clubMatch = clubName.toLowerCase().includes(term);
        
        return nameMatch || locMatch || clubMatch;
      }
      return true;
    });
  };

  const formatTournamentDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const today = new Date();
      
      if (date.toDateString() === today.toDateString()) {
        return "Aujourd'hui";
      }
      
      const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
      const monthNamesFr = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
      
      return `${days[date.getDay()]} ${date.getDate()} ${monthNamesFr[date.getMonth()]}`;
    } catch (e) {
      return dateStr;
    }
  };

  const getClubName = (t: any) => {
    if (!t) return 'Tennis de Table';
    const profile = organizerProfiles[t.organizer_id];
    if (profile && profile.club_name) {
      return profile.club_name;
    }
    const cachedName = localStorage.getItem('organizer_club_name');
    if (cachedName && t.organizer_id === localStorage.getItem('organizer_user_id')) return cachedName;

    const loc = (t.location || '').toLowerCase();
    if (loc.includes('bordeaux')) return 'Bordeaux Métropole';
    if (loc.includes('toulouse')) return 'ASPTT Toulouse';
    if (loc.includes('lyon')) return 'Lyon Tennis de Table';
    if (loc.includes('nantes')) return 'US Nantes';
    if (loc.includes('lille')) return 'Lille Métropole';
    if (loc.includes('marseille')) return 'Marseille Provence';
    return t.location || 'Tennis de Table';
  };

  const getClubContact = (t: any) => {
    if (!t) return { name: 'Tennis de Table', phone: '', email: '' };
    const profile = organizerProfiles[t.organizer_id];
    
    if (profile) {
      return {
        name: profile.club_name || 'Tennis de Table',
        phone: profile.club_phone || 'Non renseigné',
        email: profile.club_website || 'Non renseigné', // Website or other
        logo: profile.club_logo || '',
        color: profile.club_color || 'indigo'
      };
    }

    const loc = (t?.location || '').toLowerCase();
    
    const cachedPhone = localStorage.getItem('organizer_club_phone');
    const cachedEmail = localStorage.getItem('organizer_club_email');
    const cachedName = localStorage.getItem('organizer_club_name');

    let phone = cachedPhone || '';
    let email = cachedEmail || '';
    let name = cachedName || '';

    if (!name) {
      if (loc.includes('bordeaux')) name = 'Bordeaux Métropole';
      else if (loc.includes('toulouse')) name = 'ASPTT Toulouse';
      else if (loc.includes('lyon')) name = 'Lyon Tennis de Table';
      else if (loc.includes('nantes')) name = 'US Nantes';
      else if (loc.includes('lille')) name = 'Lille Métropole';
      else if (loc.includes('marseille')) name = 'Marseille Provence';
      else name = `${t?.location || 'Tennis de Table'}`;
    }

    if (!phone) {
      if (loc.includes('bordeaux')) phone = '05 56 00 12 34';
      else if (loc.includes('toulouse')) phone = '05 61 00 56 78';
      else if (loc.includes('lyon')) phone = '04 78 00 90 12';
      else if (loc.includes('nantes')) phone = '02 40 00 34 56';
      else if (loc.includes('lille')) phone = '03 20 00 78 90';
      else if (loc.includes('marseille')) phone = '04 91 00 12 34';
      else phone = '06 15 42 89 23';
    }

    if (!email) {
      if (loc.includes('bordeaux')) email = 'contact@bordeauxmetropole.fr';
      else if (loc.includes('toulouse')) email = 'contact@asptttoulouse.fr';
      else if (loc.includes('lyon')) email = 'contact@lyontt.fr';
      else if (loc.includes('nantes')) email = 'contact@usnantes.fr';
      else if (loc.includes('lille')) email = 'contact@lillemetropole.fr';
      else if (loc.includes('marseille')) email = 'contact@marseilleprovence.fr';
      else {
        const cleanLoc = loc.replace(/[^a-z0-9]/g, '');
        email = `contact@${cleanLoc || 'club'}tt.fr`;
      }
    }

    return { name, phone, email };
  };

  const getDayDateString = (dayNumber: number) => {
    if (!tournament?.date) return `Journée ${dayNumber}`;
    try {
      const baseDate = new Date(tournament.date);
      if (dayNumber > 1) {
        baseDate.setDate(baseDate.getDate() + (dayNumber - 1));
      }
      
      const dayNamesFr = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const monthNamesFr = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      
      return `${dayNamesFr[baseDate.getDay()]} ${baseDate.getDate()} ${monthNamesFr[baseDate.getMonth()]} ${baseDate.getFullYear()}`;
    } catch (e) {
      return `Journée ${dayNumber}`;
    }
  };

  const { players, addPlayer } = usePlayers(tournament?.id);
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    club: '',
    serie: 'Tableau A',
    points: 500,
    licenceNumber: '',
    email: '',
    phone: '',
  });
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [licenceInput, setLicenceInput] = useState('');
  const [searchingLicence, setSearchingLicence] = useState(false);
  const [ffttPlayer, setFfttPlayer] = useState<any | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // States pour la recherche et pointage via Token
  const [tokenInput, setTokenInput] = useState('');

  // States pour la fenêtre modale de réussite/erreur
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
    details?: {
      playerName?: string;
      licence?: string;
      categoryName: string;
      playerPoints?: number;
      requiredRange?: string;
      reason?: string;
      token?: string;
      playerEmail?: string | null;
    };
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
  });



  useEffect(() => {
    if (!tournament?.id) return;
    
    const fetchCategories = async () => {
      if (!isSupabaseConfigured) {
        setLoadingCategories(false);
        return;
      }
      try {
        setLoadingCategories(true);
        const { data, error } = await supabase
          .from('table_categories')
          .select('*')
          .eq('tournament_id', tournament.id)
          .order('name', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const localClosedRaw = localStorage.getItem(`closed_categories_${tournament.id}`);
          const localClosed: string[] = localClosedRaw ? JSON.parse(localClosedRaw) : [];

          const merged = data.map(cat => ({
            ...cat,
            is_closed: cat.is_closed || localClosed.includes(cat.name)
          }));

          setCategories(merged);
          setFormData(prev => ({ ...prev, serie: merged[0].name }));
        } else {
          setCategories([]);
        }
      } catch (err) {
        console.error('Erreur lors du chargement des catégories:', err);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [tournament?.id]);

  const handleSearchLicence = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!licenceInput.trim()) {
      toast.error('Veuillez saisir un numéro de licence.');
      return;
    }
    setSearchingLicence(true);
    setFfttPlayer(null);
    try {
      const data = await fetchPlayerByLicence(licenceInput.trim());
      if (data) {
        setFfttPlayer(data);
        const points = data.classement || 500;
        const matched = categories.find(c => points >= (c.min_points ?? 550) && points <= (c.max_points ?? 3000));
        setFormData(prev => ({
          ...prev,
          lastName: data.nom || '',
          firstName: data.prenom || '',
          club: data.club || '',
          serie: matched ? matched.name : (categories[0]?.name || 'Série A'),
          points: points,
          licenceNumber: data.licence || licenceInput.trim(),
        }));
        toast.success(`👤 Profil FFTT importé : ${data.prenom} ${data.nom}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la recherche du licencié.');
    } finally {
      setSearchingLicence(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('Veuillez remplir votre nom et prénom.');
      return;
    }

    if (!formData.email?.trim() || !formData.phone?.trim()) {
      toast.error('Veuillez renseigner votre email et numéro de téléphone portable.');
      return;
    }

    if (selectedSeries.length === 0) {
      toast.error('Veuillez cocher au moins un tableau pour valider votre inscription.');
      return;
    }

    const playerPoints = manualEntry 
      ? Number(formData.points || 500) 
      : (ffttPlayer?.classement || 500);

    const selectedCats = categories.filter(c => selectedSeries.includes(c.name));
    const maxPerDay = Number((tournament as any).max_categories_per_day) || 3;
    const sameDayCounts: Record<string, number> = {};

    for (const selectedCat of selectedCats) {
      if (selectedCat.is_closed) {
        toast.error(`Le tableau "${selectedCat.name}" est clos.`);
        return;
      }

      const payMethods: any = tournament.payment_methods || {};
      const regPeriods = payMethods.registration_periods || {};
      const dayPeriod = regPeriods[selectedCat.day_number?.toString() || '1'];
      if (dayPeriod && dayPeriod.start && dayPeriod.end) {
        const now = new Date();
        const start = new Date(dayPeriod.start);
        const end = new Date(dayPeriod.end);
        
        if (now < start) {
          const formattedStart = start.toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
          toast.error(`Les inscriptions pour la Journée ${selectedCat.day_number} n'ouvriront que le ${formattedStart}.`);
          return;
        }
        
        if (now > end) {
          const formattedEnd = end.toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
          toast.error(`Les inscriptions pour la Journée ${selectedCat.day_number} se sont terminées le ${formattedEnd}.`);
          return;
        }
      }

      const minP = selectedCat.min_points ?? 500;
      const maxP = selectedCat.max_points ?? 3000;
      if (playerPoints < minP || playerPoints > maxP) {
        toast.error(`Classement insuffisant : vos points (${playerPoints} pts) ne vous permettent pas d'accéder au tableau "${selectedCat.name}" (requis: ${minP} à ${maxP} pts).`);
        return;
      }

      const dayNumStr = selectedCat.day_number.toString();
      sameDayCounts[dayNumStr] = (sameDayCounts[dayNumStr] || 0) + 1;

      const alreadyRegCount = players.filter(p => {
        const isSelf = (p.licence_number && formData.licenceNumber && p.licence_number.trim() === formData.licenceNumber.trim()) ||
          (p.first_name.toLowerCase() === formData.firstName.trim().toLowerCase() && p.last_name.toLowerCase() === formData.lastName.trim().toLowerCase());
        if (!isSelf) return false;
        const cObj = categories.find(cat => cat.name === p.serie);
        return cObj && Number(cObj.day_number) === Number(selectedCat.day_number);
      }).length;

      if ((sameDayCounts[dayNumStr] + alreadyRegCount) > maxPerDay) {
        toast.error(`Limite de tableaux dépassée : Vous ne pouvez pas cumuler plus de ${maxPerDay} tableau(x) pour la Journée ${selectedCat.day_number}.`);
        return;
      }
    }

    setSubmitting(true);
    const toastId = toast.loading('Validation des inscriptions...');
    try {
      let firstRegPlayer: any = null;
      let countSuccess = 0;

      for (const serieName of selectedSeries) {
        const result = await addPlayer({
          tournament_id: tournament.id,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          club: formData.club.trim() || null,
          serie: serieName,
          checked_in: null,
          licence_number: formData.licenceNumber ? formData.licenceNumber.trim() : null,
          points: playerPoints,
        });

        if (result) {
          countSuccess++;
          if (!firstRegPlayer) firstRegPlayer = result;
        }
      }

      if (countSuccess === 0) {
        setSubmitting(false);
        toast.dismiss(toastId);
        return;
      }

      const playerToken = firstRegPlayer?.token || 'Jeton-Généré';
      toast.success(`🎉 Inscription validée dans ${countSuccess} tableau(x) !`, { id: toastId });
      
      if (formData.email.trim() && firstRegPlayer) {
        const directUrl = `${window.location.origin}/player/${playerToken}`;
        sendPlayerEmail({
          playerId: firstRegPlayer.player_id || '',
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          token: playerToken,
          tournamentName: tournament?.name || 'Tournoi de Tennis de Table',
          directUrl: directUrl
        }).catch(err => console.error("Erreur e-mail automatique:", err));
      }

      setModalState({
        isOpen: true,
        type: 'success',
        title: 'Inscriptions Validées ! 🎉',
        message: `Félicitations ! Vos inscriptions aux ${countSuccess} tableau(x) de compétition ont été confirmées.`,
        details: {
          playerName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
          licence: formData.licenceNumber || (!manualEntry ? licenceInput : 'Saisie manuelle'),
          categoryName: selectedSeries.join(', '),
          playerPoints: playerPoints,
          reason: `Secret Jeton (Token) : ${playerToken}`,
          token: playerToken,
          playerEmail: formData.email.trim() || null
        }
      });

      setFormData({ 
        firstName: '', 
        lastName: '', 
        club: '', 
        serie: categories[0]?.name || 'Série A', 
        points: 500,
        licenceNumber: '',
        email: '',
        phone: '',
      });
      setSelectedSeries([]);
      setLicenceInput('');
      setFfttPlayer(null);
      refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur technique lors de l'inscription", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return { label: 'Préparation', color: 'bg-slate-100 text-slate-600 border-slate-200' };
      case 'open':
      case 'registration':
        return { label: 'Inscriptions Ouvertes', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse' };
      case 'pools':
      case 'bracket':
      case 'in_progress':
        return { label: 'En Cours', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'finished':
      case 'closed':
        return { label: 'Terminé', color: 'bg-slate-100 text-slate-800 border-slate-200' };
      default:
        return { label: 'Archivé', color: 'bg-[#152031] text-slate-400 border-[#2a3548]' };
    }
  };

  const badge = tournament ? getStatusBadge(tournament.status) : null;

  const renderGlobalLanding = () => {
    const countAll = allTournaments.length;
    const countOpen = allTournaments.filter(t => getTournamentTag(t).label === 'Ouvert').length;
    const countLive = allTournaments.filter(t => getTournamentTag(t).label === 'Live').length;
    const countUpcoming = allTournaments.filter(t => getTournamentTag(t).label === 'À venir').length;
    const countFinished = allTournaments.filter(t => getTournamentTag(t).label === 'Terminé').length;

    const filtered = getFilteredTournaments();

    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Top Header Section */}
        <div className="flex flex-col items-start gap-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-semibold border border-[#f97316]/20">
            <Trophy className="w-3.5 h-3.5" />
            Tournois
          </div>
          <h1 className="font-sans font-extrabold text-4xl md:text-5xl text-white tracking-tight leading-none text-left">
            Trouvez votre prochaine compétition
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base max-w-2xl text-left leading-relaxed">
            Parcourez les tournois pilotés avec Ping Manager. Filtrez par statut et inscrivez-vous en quelques secondes.
          </p>
        </div>

        {/* Filters and Search Bar Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 pb-6 border-b border-[#2a3548]/30">
          {/* Status buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                filterTab === 'all' 
                  ? 'bg-[#f97316] text-white shadow-lg shadow-orange-500/10' 
                  : 'bg-[#152031] text-slate-300 hover:text-white border border-[#2a3548]/50'
              }`}
            >
              Tous · {countAll}
            </button>
            <button
              onClick={() => setFilterTab('open')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                filterTab === 'open' 
                  ? 'bg-[#f97316] text-white shadow-lg shadow-orange-500/10' 
                  : 'bg-[#152031] text-slate-300 hover:text-white border border-[#2a3548]/50'
              }`}
            >
              Ouverts · {countOpen}
            </button>
            <button
              onClick={() => setFilterTab('live')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                filterTab === 'live' 
                  ? 'bg-[#f97316] text-white shadow-lg shadow-orange-500/10' 
                  : 'bg-[#152031] text-slate-300 hover:text-white border border-[#2a3548]/50'
              }`}
            >
              En direct · {countLive}
            </button>
            <button
              onClick={() => setFilterTab('upcoming')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                filterTab === 'upcoming' 
                  ? 'bg-[#f97316] text-white shadow-lg shadow-orange-500/10' 
                  : 'bg-[#152031] text-slate-300 hover:text-white border border-[#2a3548]/50'
              }`}
            >
              À venir · {countUpcoming}
            </button>
            <button
              onClick={() => setFilterTab('finished')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                filterTab === 'finished' 
                  ? 'bg-[#f97316] text-white shadow-lg shadow-orange-500/10' 
                  : 'bg-[#152031] text-slate-300 hover:text-white border border-[#2a3548]/50'
              }`}
            >
              Terminés · {countFinished}
            </button>
          </div>

          {/* Search bar with filter icon */}
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Ville, club, tournoi..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-[#0e1b2f] border border-[#2a3548] rounded-xl text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#f97316]/50 transition-all font-sans"
            />
            <SlidersHorizontal className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-16 text-center rounded-[2.5rem] border border-[#2a3548]/50 bg-[#152031]/80 font-sans shadow-lg">
            <Trophy className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="font-bold text-lg text-slate-300">Aucun tournoi ne correspond aux filtres</p>
            <p className="text-sm text-slate-500 mt-1">Essayez d'ajuster votre recherche ou sélectionnez une autre catégorie.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
            {filtered.map((t) => {
              const tag = getTournamentTag(t);
              const { registrationsCount = 0, capacitySum = 0, categoriesCount = 0 } = tournamentStats[t.id] || {};
              const capacity = capacitySum || 128;
              const inscrits = registrationsCount;
              const percentage = Math.min(100, Math.round((inscrits / capacity) * 100));
              const clubName = getClubName(t);
              const actionLabel = tag.label === 'Live' ? 'Suivre le live' : tag.label === 'Terminé' ? 'Voir les résultats' : 'Voir le détail';

              return (
                <div 
                  key={t.id}
                  onClick={() => {
                    selectTournament(t.id);
                    setActiveTournamentId(t.id);
                  }}
                  className="group cursor-pointer p-6 rounded-[2rem] bg-[#152031] border border-[#2a3548]/45 hover:bg-[#1a2a41] hover:border-[#f97316]/60 hover:shadow-2xl hover:shadow-orange-500/5 transition-all duration-300 flex flex-col justify-between"
                  id={`tournament-card-${t.id}`}
                >
                  <div className="text-left space-y-4">
                    {/* Upper Category and status Row */}
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider">
                        {t.location || 'LIEU NON DÉFINI'}
                      </span>
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black ${tag.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${tag.dot}`} />
                        <span>{tag.label}</span>
                      </div>
                    </div>

                    {/* Title and Club Subheading */}
                    <div>
                      <h3 className="font-sans font-extrabold text-white text-lg tracking-tight leading-snug group-hover:text-[#f97316] transition-colors duration-300 line-clamp-1">
                        {t.name}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium mt-1">
                        {clubName}
                      </p>
                    </div>

                    {/* Details Row Info */}
                    <div className="space-y-2.5 pt-1">
                      {/* Dates calendar */}
                      <div className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span>{formatTournamentDate(t.date)} · 09:00 — 18:30</span>
                      </div>

                      {/* Tables and categories of play */}
                      <div className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold">
                        <LayoutGrid className="w-4 h-4 text-slate-500" />
                        <span>{t.nb_tables || 8} tables · {categoriesCount || 4} tableaux</span>
                      </div>

                      {/* Registration Stats & Line Bar progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs text-slate-300 font-semibold">
                          <div className="flex items-center gap-2.5">
                            <Users className="w-4 h-4 text-slate-500" />
                            <span>{inscrits}/{capacity} inscrits</span>
                          </div>
                          <span className="font-mono font-bold text-orange-400 text-[11px]">{percentage}%</span>
                        </div>
                        {/* Custom visual progress bar */}
                        <div className="w-full bg-[#0a1424] rounded-full h-1 overflow-hidden mt-1.5">
                          <div 
                            className="h-full rounded-full bg-[#f97316] transition-all duration-500" 
                            style={{ width: `${percentage}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Divider line and footer element */}
                  <div>
                    <div className="border-t border-[#2a3548]/30 my-4" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors duration-300">
                        {actionLabel}
                      </span>
                      <ArrowRight className="w-4 h-4 text-[#f97316] group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderTournamentDetails = () => {
    return (
      <div className="max-w-6xl mx-auto px-6 py-6 font-sans">
        {/* Breadcrumb line */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-6 select-none justify-start">
          <button
            onClick={() => {
              localStorage.removeItem('public_selected_tournament_id');
              setActiveTournamentId(null);
            }}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 inline-flex items-center"
          >
            Tournois
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-[#f97316] font-bold">
            {tournament?.location || 'Détails'}
          </span>
        </div>

        {/* Badges line */}
        <div className="flex items-center gap-3 mb-4 text-[10px] font-black uppercase tracking-wider justify-start">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${
            tournament?.status === 'open' || tournament?.status === 'registration'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              tournament?.status === 'open' || tournament?.status === 'registration' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`} />
            <span>{tournament?.status === 'open' || tournament?.status === 'registration' ? 'Inscriptions ouvertes' : 'Inscriptions closes'}</span>
          </div>
          <span className="text-orange-400">
            {tournament?.location?.toUpperCase() || 'LIEU'}
          </span>
        </div>

        {/* Big Title */}
        <h1 className="font-sans font-extrabold text-3xl md:text-5xl text-white tracking-tight leading-none mb-6 text-left">
          {tournament ? tournament.name : 'Tournoi en cours'}
        </h1>

        {/* Inline Infos Row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs md:text-sm font-semibold text-slate-300 mb-10 pb-6 border-b border-[#2a3548]/30 justify-start">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-500" />
            <span>{tournament?.location || 'Bordeaux'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>{formatTournamentDate(tournament?.date || '')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>09:00 — 18:30</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left/Middle Column (tab contents) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Horizontal tabs */}
            <div className="flex items-center gap-6 border-b border-[#2a3548]/30 mb-8 overflow-x-auto pb-px scrollbar-none justify-start">
              <button
                onClick={() => setActiveDetailTab('apercu')}
                className={`pb-4 text-sm font-bold transition-all border-b-2 cursor-pointer bg-transparent border-none ${
                  activeDetailTab === 'apercu'
                    ? 'border-[#f97316] text-[#f97316]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Aperçu
              </button>
              <button
                onClick={() => setActiveDetailTab('tableaux')}
                className={`pb-4 text-sm font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer bg-transparent border-none ${
                  activeDetailTab === 'tableaux'
                    ? 'border-[#f97316] text-[#f97316]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Tableaux <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-full">{categories.length}</span>
              </button>
              <button
                onClick={() => setActiveDetailTab('inscrits')}
                className={`pb-4 text-sm font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer bg-transparent border-none ${
                  activeDetailTab === 'inscrits'
                    ? 'border-[#f97316] text-[#f97316]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Inscrits <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-full">{players.length}</span>
              </button>
              <button
                onClick={() => setActiveDetailTab('infos')}
                className={`pb-4 text-sm font-bold transition-all border-b-2 cursor-pointer bg-transparent border-none ${
                  activeDetailTab === 'infos'
                    ? 'border-[#f97316] text-[#f97316]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Infos pratiques
              </button>
            </div>

            {/* Tab rendering */}
            {activeDetailTab === 'apercu' && (
              <div className="space-y-8 text-left">
                {/* Grid of 4 stats card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Stat 1: Inscrits */}
                  <div className="bg-[#152031] p-5 rounded-2xl border border-[#2a3548]/40 text-left space-y-1">
                    <Users className="w-5 h-5 text-slate-500" />
                    <p className="font-sans font-black text-white text-xl leading-none pt-1">
                      {players.length}/{categories.reduce((acc, c) => acc + Number(c.capacity || 32), 0) || 192}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase leading-none">Inscrits</p>
                  </div>

                  {/* Stat 2: Tables */}
                  <div className="bg-[#152031] p-5 rounded-2xl border border-[#2a3548]/40 text-left space-y-1">
                    <LayoutGrid className="w-5 h-5 text-slate-500" />
                    <p className="font-sans font-black text-white text-xl leading-none pt-1">
                      {tournament?.nb_tables || 24}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase leading-none">Tables</p>
                  </div>

                  {/* Stat 3: Tableaux */}
                  <div className="bg-[#152031] p-5 rounded-2xl border border-[#2a3548]/40 text-left space-y-1">
                    <Layers className="w-5 h-5 text-slate-500" />
                    <p className="font-sans font-black text-white text-xl leading-none pt-1">
                      {categories.length || 4}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase leading-none">Tableaux</p>
                  </div>

                  {/* Stat 4: Tarif */}
                  <div className="bg-[#152031] p-5 rounded-2xl border border-[#2a3548]/40 text-left space-y-1">
                    <span className="text-slate-550 font-black text-lg block leading-none">€</span>
                    <p className="font-sans font-black text-white text-xl leading-none pt-1">
                      {categories[0]?.price ? `${Number(categories[0].price).toFixed(0)} €` : '8 €'}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase leading-none">Par tableau</p>
                  </div>
                </div>

                {/* Présentation card */}
                <div className="bg-[#152031] p-6 rounded-3xl border border-[#2a3548]/40 text-left flex flex-col sm:flex-row gap-5 items-start">
                  {getClubContact(tournament)?.logo && (
                    <img 
                      src={getClubContact(tournament).logo} 
                      alt="Logo Club" 
                      className="w-16 h-16 rounded-2xl object-cover border border-[#2a3548]/80 flex-shrink-0" 
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="flex-1 space-y-3">
                    <h3 className="font-sans font-extrabold text-white text-base tracking-tight">Présentation</h3>
                    <p className="text-slate-400 text-xs leading-relaxed font-medium">
                      Le club <strong className="text-white font-extrabold">{getClubName(tournament)}</strong> vous accueille à <strong className="text-white font-extrabold">{tournament?.location || 'Bordeaux'}</strong> pour <span className="text-white font-bold">{tournament?.name || 'Open National de Printemps'}</span>, un tournoi homologué FFTT organisé sur <span className="text-white font-bold">{tournament?.nb_tables || 24} tables</span>. {categories.length || 4} tableaux sont proposés, des séries jeunes aux compétiteurs confirmés. L'ensemble de la compétition est piloté avec <strong className="text-white font-extrabold">Ping Manager</strong> : inscription en ligne, pointage par QR Code, poules automatiques et live score — <strong className="text-white font-extrabold">sans aucune feuille de match papier</strong>.
                    </p>
                  </div>
                </div>

                {/* Bottom features cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#152031] p-5 rounded-2xl border border-[#2a3548]/30 space-y-2 text-left">
                    <Zap className="w-5 h-5 text-orange-400" />
                    <h4 className="font-sans font-extrabold text-white text-xs">Inscription en ligne</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Via votre licence FFTT, en moins de 30 secondes.
                    </p>
                  </div>

                  <div className="bg-[#152031] p-5 rounded-2xl border border-[#2a3548]/30 space-y-2 text-left">
                    <Smartphone className="w-5 h-5 text-orange-400" />
                    <h4 className="font-sans font-extrabold text-white text-xs">Pointage QR Code</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Présence confirmée et dossard attribué à l'accueil.
                    </p>
                  </div>

                  <div className="bg-[#152031] p-5 rounded-2xl border border-[#2a3548]/30 space-y-2 text-left">
                    <Activity className="w-5 h-5 text-orange-400" />
                    <h4 className="font-sans font-extrabold text-white text-xs">Live score</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Suivez poules et tableaux en temps réel.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeDetailTab === 'tableaux' && (
              <div className="space-y-8 text-left">
                {(() => {
                  const categoriesByDay = categories.reduce((acc: Record<number, any[]>, cat) => {
                    const day = Number(cat.day_number) || 1;
                    if (!acc[day]) acc[day] = [];
                    acc[day].push(cat);
                    return acc;
                  }, {});

                  const sortedDays = Object.keys(categoriesByDay)
                    .map(Number)
                    .sort((a, b) => a - b);

                  return sortedDays.map(dayNum => {
                    const dayCats = categoriesByDay[dayNum] || [];
                    return (
                      <div key={dayNum} className="space-y-4">
                        <h3 className="font-sans font-extrabold text-white text-sm tracking-widest uppercase border-b border-[#2a3548]/30 pb-2 mt-2 first:mt-0 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-orange-400 shrink-0" />
                          <span>{getDayDateString(dayNum)}</span>
                        </h3>
                        <div className="space-y-4">
                          {dayCats.map(cat => {
                            const count = players.filter(p => p.serie === cat.name).length;
                            const capacity = cat.capacity || 32;
                            const percentage = Math.min(100, Math.round((count / capacity) * 100));
                            const globalIdx = categories.findIndex(c => c.id === cat.id);
                            const letter = String.fromCharCode(65 + (globalIdx >= 0 ? globalIdx : 0));

                            return (
                              <div 
                                key={cat.id} 
                                className="bg-[#152031] p-5 rounded-2xl border border-[#2a3548]/40 hover:border-[#f97316]/30 transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left"
                              >
                                {/* Left Side: letter & details */}
                                <div className="flex items-center gap-4">
                                  {/* Circle Avatar badge */}
                                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[#f97316] font-extrabold flex items-center justify-center shrink-0">
                                    {letter}
                                  </div>
                                  
                                  {/* Tableau Name & Specs */}
                                  <div className="space-y-1">
                                    <h4 className="font-sans font-extrabold text-white text-base tracking-tight leading-none">
                                      {cat.name}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-semibold leading-none">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                                        Début {cat.start_time || (cat.day_number === 2 ? '10:30' : '09:00')}
                                      </span>
                                      <span className="text-slate-500">•</span>
                                      <span className="flex items-center gap-1">
                                        <Trophy className="w-3.5 h-3.5 text-slate-500" />
                                        Points: {cat.min_points} — {cat.max_points} pts
                                      </span>
                                      <span className="text-slate-500">•</span>
                                      <span className="text-orange-400 font-bold">
                                        {cat.price ? `${Number(cat.price).toFixed(0)} €` : '8 €'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Right Side: stats bar and percentage */}
                                <div className="sm:text-right space-y-1 shrink-0 w-full sm:w-32">
                                  <div className="flex justify-between text-xs font-bold text-slate-300 leading-none">
                                    <span>{count}/{capacity}</span>
                                    <span className="text-orange-400">{percentage}%</span>
                                  </div>
                                  <div className="w-full bg-[#0a1424] rounded-full h-1 overflow-hidden">
                                    <div 
                                      className="h-full rounded-full bg-[#f97316] transition-all duration-500" 
                                      style={{ width: `${percentage}%` }} 
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {activeDetailTab === 'inscrits' && (
              <div className="space-y-6 text-left">
                <p className="text-xs font-bold text-slate-400 text-left">
                  {players.length} joueurs inscrits · aperçu des 12 premiers par classement
                </p>
                
                {players.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl border border-[#2a3548]/30 bg-[#152031] text-slate-400">
                    Aucun joueur inscrit pour le moment. Soyez le premier à vous inscrire !
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {players.slice(0, 12).map((player, idx) => {
                      const initials = ((player.firstName?.[0] || '') + (player.lastName?.[0] || '')).toUpperCase() || 'PL';
                      
                      const charCodeSum = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
                      const bgColors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-amber-500', 'bg-sky-500'];
                      const colorClass = bgColors[charCodeSum % bgColors.length];

                      return (
                        <div 
                          key={player.id || idx}
                          className="bg-[#152031] p-4 rounded-2xl border border-[#2a3548]/40 hover:border-slate-700 transition-all duration-300 flex items-center justify-between gap-3 text-left"
                        >
                          <div className="flex items-center gap-3">
                            {/* Avatar Icon */}
                            <div className={`w-10 h-10 rounded-full ${colorClass} text-white font-extrabold text-xs flex items-center justify-center shrink-0`}>
                              {initials}
                            </div>
                            
                            {/* Player text info */}
                            <div className="space-y-0.5">
                              <h4 className="font-sans font-extrabold text-white text-sm line-clamp-1">
                                {player.firstName} {player.lastName}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-semibold truncate leading-none">
                                {player.club || 'Aucun club'} • <span className="text-orange-400">{player.serie || 'Tableau'}</span>
                              </p>
                            </div>
                          </div>
                          
                          {/* Points badge */}
                          <div className="text-right shrink-0">
                            <span className="font-mono font-black text-white text-sm">
                              {player.points || 500}
                            </span>
                            <p className="text-[9px] text-slate-400 leading-none">pts</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeDetailTab === 'infos' && (
              <div className="space-y-6 text-left">
                {/* Lieu Card with grid map placeholder */}
                <div className="bg-[#152031] p-6 rounded-3xl border border-[#2a3548]/40 space-y-4">
                  <h3 className="font-sans font-extrabold text-white text-base tracking-tight">Lieu</h3>
                  
                  {/* Dark Grid Map Placeholder styled identical to the screenshot */}
                  <div className="relative w-full h-48 bg-[#0a1424] rounded-2xl border border-[#2a3548]/60 overflow-hidden flex items-center justify-center">
                    <div 
                      className="absolute inset-0 opacity-10" 
                      style={{
                        backgroundImage: 'radial-gradient(circle, #f97316 1px, transparent 1px)',
                        backgroundSize: '16px 16px'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a1424]/90 to-transparent" />
                    
                    {/* Center MapPin */}
                    <div className="relative z-10 w-12 h-12 bg-[#f97316]/10 rounded-full flex items-center justify-center border border-[#f97316]/20 animate-bounce">
                      <MapPin className="w-6 h-6 text-[#f97316]" />
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-5 h-5 text-[#f97316] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-sans font-extrabold text-white text-sm shrink truncate leading-none">
                        Gymnase Municipal · {getClubName(tournament)}
                      </h4>
                      <p className="text-xs text-slate-400 font-medium mt-1">
                        57 rue du Sport, {tournament?.location || 'Bordeaux'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Déroulé de la journée list */}
                <div className="bg-[#152031] p-6 rounded-3xl border border-[#2a3548]/40 space-y-6">
                  <h3 className="font-sans font-extrabold text-white text-base tracking-tight">Déroulé de la journée</h3>
                  
                  <div className="relative pl-6 border-l border-orange-500/30 space-y-6">
                    {/* Step 1 */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-[#152031] border-2 border-[#f97316]" />
                      <span className="font-mono text-[11px] font-black text-orange-400">08:30</span>
                      <h4 className="font-sans font-bold text-white text-xs">Ouverture de l'accueil et pointage</h4>
                    </div>

                    {/* Step 2 */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-[#152031] border-2 border-[#f97316]" />
                      <span className="font-mono text-[11px] font-black text-orange-400">09:00</span>
                      <h4 className="font-sans font-bold text-white text-xs">Lancement du Tableau A — 500/1199</h4>
                    </div>

                    {/* Step 3 */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-[#152031] border-2 border-[#f97316]" />
                      <span className="font-mono text-[11px] font-black text-orange-400">12:30</span>
                      <h4 className="font-sans font-bold text-white text-xs">Fin des poules — bascule en tableaux</h4>
                    </div>

                    {/* Step 4 */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-[#152031] border-2 border-[#f97316]" />
                      <span className="font-mono text-[11px] font-black text-orange-400">16:00</span>
                      <h4 className="font-sans font-bold text-white text-xs">Phases finales</h4>
                    </div>

                    {/* Step 5 */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-[#152031] border-2 border-[#f97316]" />
                      <span className="font-mono text-[11px] font-black text-orange-400">18:00</span>
                      <h4 className="font-sans font-bold text-white text-xs">Remise des récompenses</h4>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: original signup form kept completely, plus original player tokens & added beautiful Organisateur card */}
          <div className="lg:col-span-12 xl:col-span-5 space-y-6">
            {tournament && ['open', 'registration'].includes(tournament.status) ? (
              <div className="bg-[#152031] p-6 rounded-[2rem] border border-[#2a3548] shadow-xl text-left">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-[#f97316]/10 rounded-xl flex items-center justify-center text-[#f97316]">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">S'inscrire au Tournoi</h3>
                    <p className="text-slate-400 text-xs">Importez votre licence FFTT ou saisissez manuellement</p>
                  </div>
                </div>

                {!manualEntry ? (
                  !ffttPlayer ? (
                    <form onSubmit={handleSearchLicence} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                          Saisissez votre numéro de licence
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            maxLength={7}
                            placeholder="Ex: 7512345"
                            className="w-full px-4 py-3 bg-[#0a1729] border border-[#2a3548] focus:bg-[#0a1729] rounded-xl outline-none text-white font-bold"
                            value={licenceInput}
                            onChange={e => setLicenceInput(e.target.value.replace(/\D/g, ''))}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={searchingLicence || !licenceInput.trim()}
                        className="w-full py-3 bg-[#f97316] hover:bg-[#ea6a0a] text-white font-bold rounded-xl flex items-center justify-center gap-2"
                      >
                        {searchingLicence ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        S'inscrire via ma licence
                      </button>

                      <div className="text-center pt-3 border-t border-[#2a3548]/30">
                        <button type="button" onClick={() => setManualEntry(true)} className="text-xs text-[#f97316] font-bold hover:underline">
                          Saisie manuelle brute (Sans Licence)
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase">Licencié trouvé !</p>
                        <p className="text-sm font-black text-white mt-1">{ffttPlayer.prenom} {ffttPlayer.nom}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{ffttPlayer.club || "Aucun Club"} • {ffttPlayer.classement || 500} pts</p>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">Choisir les séries</label>
                        <div className="bg-[#0a1729] border border-[#2a3548] p-3 rounded-2xl space-y-2 max-h-[180px] overflow-y-auto w-full">
                          {categories.map((cat, idx) => {
                            const isEligible = (ffttPlayer?.classement || 500) >= (cat.min_points ?? 550) && (ffttPlayer?.classement || 505) <= (cat.max_points ?? 3000);
                            const isChecked = selectedSeries.includes(cat.name);
                            return (
                              <label key={idx} className={`flex items-start gap-3 p-2 rounded-xl border transition-all cursor-pointer ${
                                !isEligible ? 'opacity-30' : isChecked ? 'bg-[#f97316]/5 border-[#f97316]' : 'bg-[#152031] border-[#2a3548]'
                              }`}>
                                <input
                                  type="checkbox"
                                  disabled={!isEligible}
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedSeries(selectedSeries.filter(s => s !== cat.name));
                                    } else {
                                      setSelectedSeries([...selectedSeries, cat.name]);
                                    }
                                  }}
                                  className="mt-1 accent-[#f97316]"
                                />
                                <div className="text-xs text-left">
                                  <p className="font-bold text-white">{cat.name}</p>
                                  <p className="text-[10px] text-slate-400">{cat.min_points} - {cat.max_points} pts | Jour {cat.day_number}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-left">
                        <input
                          type="email"
                          required
                          placeholder="Email de contact"
                          className="w-full px-4 py-2.5 bg-[#0a1729] border border-[#2a3548] rounded-xl text-xs text-white"
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                        <input
                          type="tel"
                          required
                          placeholder="Portable"
                          className="w-full px-4 py-2.5 bg-[#0a1729] border border-[#2a3548] rounded-xl text-xs text-white"
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>

                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setFfttPlayer(null); setSelectedSeries([]); }} className="px-4 py-2 bg-slate-800 text-xs font-bold rounded-xl">Annuler</button>
                        <button type="submit" disabled={submitting} className="flex-1 py-2 bg-[#f97316] text-xs font-black rounded-xl">M'inscrire</button>
                      </div>
                    </form>
                  )
                ) : (
                  <form onSubmit={handleRegister} className="space-y-3">
                    <input
                      type="text"
                      required
                      placeholder="Nom"
                      className="w-full px-4 py-2.5 bg-[#0a1729] border border-[#2a3548] rounded-xl text-xs text-white"
                      value={formData.lastName}
                      onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    />
                    <input
                      type="text"
                      required
                      placeholder="Prénom"
                      className="w-full px-4 py-2.5 bg-[#0a1729] border border-[#2a3548] rounded-xl text-xs text-white"
                      value={formData.firstName}
                      onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    />
                    <input
                      type="number"
                      required
                      placeholder="Points (ex: 500)"
                      className="w-full px-4 py-2.5 bg-[#0a1729] border border-[#2a3548] rounded-xl text-xs text-white"
                      value={formData.points}
                      onChange={e => setFormData({ ...formData, points: Number(e.target.value) })}
                    />
                    <input
                      type="email"
                      required
                      placeholder="Email contact"
                      className="w-full px-4 py-2.5 bg-[#0a1729] border border-[#2a3548] rounded-xl text-xs text-white"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Téléphone"
                      className="w-full px-4 py-2.5 bg-[#0a1729] border border-[#2a3548] rounded-xl text-xs text-white"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />

                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase text-left">Choisir les séries</label>
                      <div className="bg-[#0a1729] p-3 border border-[#2a3548] rounded-2xl space-y-2 max-h-[140px] overflow-y-auto">
                        {categories.map((cat, idx) => {
                          const isEligible = formData.points >= (cat.min_points ?? 500) && formData.points <= (cat.max_points ?? 3000);
                          const isChecked = selectedSeries.includes(cat.name);
                          return (
                            <label key={idx} className="flex gap-2.5 text-xs text-left cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={!isEligible}
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedSeries(selectedSeries.filter(s => s !== cat.name));
                                  } else {
                                    setSelectedSeries([...selectedSeries, cat.name]);
                                  }
                                }}
                              />
                              <div>{cat.name} ({cat.min_points}-{cat.max_points} pts)</div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button type="button" onClick={() => setManualEntry(false)} className="px-4 py-2 bg-slate-800 text-xs font-bold rounded-xl">Annuler</button>
                      <button type="submit" className="flex-1 py-2 bg-[#f97316] text-xs font-black rounded-xl">S'inscrire</button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="bg-[#152031] p-6 rounded-[2rem] border border-[#2a3548]">
                <Info className="w-8 h-8 text-[#f97316] mx-auto mb-3" />
                <h4 className="font-extrabold text-white text-base">Inscriptions closes</h4>
                <p className="text-slate-400 text-xs mt-2">Le tournoi a débuté ou est terminé. L’inscription en ligne n’est plus active.</p>
              </div>
            )}

            <div className="bg-[#152031] p-6 rounded-[2rem] border border-[#2a3548] text-left">
              <div className="flex items-center gap-3 mb-4">
                <Key className="w-5 h-5 text-[#f97316]" />
                <h4 className="font-extrabold text-sm text-white">🔑 Mon Jeton Joueur</h4>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Collez votre jeton secret joueur"
                  className="flex-1 px-3 py-2 bg-[#0a1729] border border-[#2a3548] rounded-xl text-xs text-white uppercase font-mono"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                />
                <button
                  onClick={() => {
                    const cleanToken = tokenInput.trim().split('/').pop()?.trim();
                    if (cleanToken) navigate(`/player/${cleanToken}`);
                  }}
                  className="px-3 bg-[#f97316] text-xs font-bold text-white rounded-xl"
                >
                  Accéder
                </button>
              </div>
            </div>

            {/* Fiche Organisateur */}
            <div className="bg-[#152031] p-6 rounded-[2rem] border border-[#2a3548]/40 text-left space-y-4">
              <span className="text-[10px] font-black tracking-widest text-[#f97316] uppercase mt-1 block">
                ORGANISATEUR
              </span>
              {(() => {
                const contact = getClubContact(tournament);
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#f97316] text-white font-extrabold text-sm rounded-xl flex items-center justify-center select-none shrink-0">
                        {contact.name?.[0]?.toUpperCase() || 'O'}
                      </div>
                      <div>
                        <h4 className="font-sans font-extrabold text-[#ffffff] text-sm shrink truncate leading-none">
                          {contact.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          {tournament?.location || 'Bordeaux'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 pt-2 border-t border-[#2a3548]/30">
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span className="font-bold">Tél :</span>
                        <a href={`tel:${contact.phone}`} className="hover:text-[#f97316] transition-colors font-semibold">
                          {contact.phone}
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span className="font-bold">E-mail :</span>
                        <a href={`mailto:${contact.email}`} className="hover:text-[#f97316] transition-colors font-semibold truncate max-w-[220px]" title={contact.email}>
                          {contact.email}
                        </a>
                      </div>
                    </div>

                    <a 
                      href={`mailto:${contact.email}`}
                      className="w-full py-2.5 bg-[#0a1424] hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-[#2a3548]/50 transition-colors cursor-pointer text-center block mt-2"
                    >
                      <Mail className="w-4 h-4 text-orange-400" />
                      <span>Contacter par e-mail</span>
                    </a>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Modal Résultat Inscriptions */}
        {modalState.isOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-slate-900 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
              <h3 className="text-lg font-black">{modalState.title}</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{modalState.message}</p>
              {modalState.details?.token && (
                <div className="mt-4 p-3 bg-slate-50 border rounded-xl space-y-2">
                  <QRCodeSVG value={`${window.location.origin}/player/${modalState.details.token}`} size={120} className="mx-auto" />
                  <p className="font-mono text-xs font-bold text-indigo-600 mt-2">{modalState.details.token}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/player/${modalState.details?.token}`);
                      toast.success('Lien copié !');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-[10px] font-bold text-indigo-600 mx-auto rounded"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copier le lien
                  </button>
                </div>
              )}
              <button onClick={() => setModalState({ isOpen: false, type: 'success', title: '', message: '' })} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl mt-4">Fermer</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a1729] text-white font-sans selection:bg-[#f97316] selection:text-white flex flex-col justify-between">
      <div>
        <PublicHeader />
        {!isSupabaseConfigured && (
          <div className="bg-[#f97316] text-white text-xs md:text-sm py-3 px-4 text-center font-bold">
            Certaines fonctionnalités de Supabase ne sont pas configurées. Veuillez saisir vos Secrets.
          </div>
        )}
        {activeTournamentId === null ? renderGlobalLanding() : renderTournamentDetails()}
      </div>

      <footer className="bg-[#0f1f3d] text-slate-450 py-12 border-t border-[#2a3548]/50 shrink-0 select-none">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs">© 2026 Ping Manager. Conçu pour simplifier l'arbitrage et le suivi de tournoi.</p>
          <div className="flex gap-6 text-xs font-bold items-center">
            <span className="text-[#f97316] hover:text-orange-400">Français</span>
            <span className="text-slate-400">v0.21.0</span>
            {showAdminLink && (
              <Link to="?login=admin" className="text-slate-400 hover:text-white transition-colors cursor-pointer border-l border-[#2a3548]/80 pl-4">Admin</Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
