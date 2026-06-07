import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';
import { usePlayers } from '../../hooks/usePlayers';
import { supabase, isSupabaseConfigured } from '../../supabase';
import { Trophy, Calendar, MapPin, Users, HeartHandshake, LogIn, ChevronRight, Sparkles, CheckCircle2, UserPlus, Info, Search, ArrowLeft, Loader2, Check, ArrowRight, Zap, Smartphone, Layers, Activity, Key, CheckCircle, Clock, UserCheck, Copy, Mail } from 'lucide-react';
import { fetchPlayerByLicence } from '../../services/ffttApi';
import { sendPlayerEmail } from '../../services/emailService';
import Logo from '../../components/layout/Logo';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import AuthModal from '../../components/auth/AuthModal';

export default function Landing() {
  const { tournament, stats, loading, allTournaments, selectTournament, refresh } = useTournament({ forcePublic: true });
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);
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

  // States pour la fenêtre modale d'affichage de réussite/erreur de validation
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

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('login') === 'true') {
      setIsAuthModalOpen(true);
      navigate('/', { replace: true });
    }
  }, [location, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlToken = params.get('token');
    if (urlToken && urlToken.trim()) {
      let val = urlToken.trim();
      if (val.includes('/player/')) {
        val = val.split('/player/').pop() || val;
      } else if (val.includes('?token=')) {
        val = val.split('?token=').pop() || val;
      }
      if (val.includes('?')) {
        val = val.split('?')[0];
      }
      if (val.endsWith('/')) {
        val = val.slice(0, -1);
      }
      const clean = val.trim();
      if (clean) {
        navigate(`/player/${clean}`, { replace: true });
      }
    }
  }, [location, navigate]);

  const handleOrganizerClick = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      navigate('/organizer');
    } else {
      setIsAuthModalOpen(true);
    }
  };

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
        // Trouver la catégorie qui correspond au classement du licencié
        const matched = categories.find(c => points >= (c.min_points ?? 500) && points <= (c.max_points ?? 3000));
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

  React.useEffect(() => {
    if (!tournament?.id) return;
    
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        const { data, error } = await supabase
          .from('table_categories')
          .select('*')
          .eq('tournament_id', tournament.id)
          .order('name', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          // Fusionner avec le stockage local
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

    // Récupération des points (selon saisie manuelle ou import FFTT)
    const playerPoints = manualEntry 
      ? Number(formData.points || 500) 
      : (ffttPlayer?.classement || 500);

    const selectedCats = categories.filter(c => selectedSeries.includes(c.name));
    const maxPerDay = Number((tournament as any).max_categories_per_day) || 3;
    const sameDayCounts: Record<string, number> = {};

    // Validation préalable de chaque tableau sélectionné
    for (const selectedCat of selectedCats) {
      if (selectedCat.is_closed) {
        toast.error(`Le tableau "${selectedCat.name}" est clos.`);
        return;
      }

      // Validation temporelle d'inscription par journée
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

      // Validation des limites de points
      const minP = selectedCat.min_points ?? 500;
      const maxP = selectedCat.max_points ?? 3000;
      if (playerPoints < minP || playerPoints > maxP) {
        toast.error(`Classement insuffisant : vos points (${playerPoints} pts) ne vous permettent pas d'accéder au tableau "${selectedCat.name}" (requis: ${minP} à ${maxP} pts).`);
        return;
      }

      // Validation du genre (Optionnel)
      if (selectedCat.gender_restriction && selectedCat.gender_restriction !== 'ALL') {
        const playerGender = ffttPlayer?.sexe || 'M';
        if (playerGender !== selectedCat.gender_restriction) {
          toast.error(`Le tableau "${selectedCat.name}" est exclusivement réservé au sexe : ${selectedCat.gender_restriction === 'F' ? 'Féminin' : 'Masculin'}.`);
          return;
        }
      }

      // Validation de la catégorie d'âge (Optionnel)
      if (selectedCat.age_categories && 
          selectedCat.age_categories !== 'Toutes catégories' && 
          selectedCat.age_categories.toLowerCase() !== 'toutes' && 
          ffttPlayer?.categorie) {
        const playerAgeCat = ffttPlayer.categorie.toLowerCase();
        const allowedCat = selectedCat.age_categories.toLowerCase();
        const isEligible = allowedCat.split(',').some((tag: string) => {
          const cleanTag = tag.trim();
          if (!cleanTag) return false;
          return playerAgeCat.includes(cleanTag);
        });
        
        if (!isEligible) {
          toast.error(`Restriction d'âge : le tableau "${selectedCat.name}" requiert la catégorie d'âge "${selectedCat.age_categories}".`);
          return;
        }
      }

      // Validation cumulée par journée
      const dayNumStr = selectedCat.day_number.toString();
      sameDayCounts[dayNumStr] = (sameDayCounts[dayNumStr] || 0) + 1;

      // On compte également les inscriptions déjà enregistrées en base
      const alreadyRegCount = players.filter(p => {
        const isSelf = (p.licence_number && formData.licenceNumber && p.licence_number.trim() === formData.licenceNumber.trim()) ||
          (p.first_name.toLowerCase() === formData.firstName.trim().toLowerCase() && p.last_name.toLowerCase() === formData.lastName.trim().toLowerCase());
        if (!isSelf) return false;
        const cObj = categories.find(cat => cat.name === p.serie);
        return cObj && Number(cObj.day_number) === Number(selectedCat.day_number);
      }).length;

      if ((sameDayCounts[dayNumStr] + alreadyRegCount) > maxPerDay) {
        toast.error(`Limite de tableaux dépassée : Vous ne pouvez pas cumuler plus de ${maxPerDay} tableau(x) pour la Journée ${selectedCat.day_number}. (Actuel : ${alreadyRegCount} inscrit, ${sameDayCounts[dayNumStr]} sélectionné(s))`);
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
          checked_in: null, // Initialement inscrit non pointé
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
      
      // Déclenchement automatique de l'e-mail de confirmation si renseigné
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
        }).then((res) => {
          if (res.success) {
            toast.success('✉️ E-mail de confirmation envoyé automatiquement !');
          } else {
            console.warn("L'e-mail automatique n'a pas pu être envoyé:", res.error || res.reason);
          }
        }).catch((err) => {
          console.error("Erreur lors de l'envoi de l'e-mail automatique:", err);
        });
      }

      // Affichage de la fenêtre modale de réussite avec le TOKEN secret du joueur
      setModalState({
        isOpen: true,
        type: 'success',
        title: 'Inscriptions Validées ! 🎉',
        message: `Félicitations ! Vos inscriptions aux ${countSuccess} tableau(x) de compétition ont été confirmées. Votre jeton joueur unique pour tester le pointage et suivre vos matchs a été créé d'office.`,
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

      // Réinitialisation du formulaire
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
      setModalState({
        isOpen: true,
        type: 'error',
        title: 'Erreur Technique ⚠️',
        message: err.message || "Une erreur inattendue est survenue lors de l'inscription."
      });
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
        return { label: 'Terminé', color: 'bg-slate-100 text-slate-800' };
      default:
        return { label: 'Archivé', color: 'bg-[#152031] text-slate-400 border-[#2a3548]' };
    }
  };

  const badge = tournament ? getStatusBadge(tournament.status) : null;

  const renderGlobalLanding = () => {
    return (
      <div className="bg-[#0a1729] select-none text-slate-100">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24 md:py-32 max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 z-10 font-sans">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-bold mb-6 border border-[#f97316]/25">
                <Trophy className="w-3.5 h-3.5 animate-pulse" />
                La nouvelle ère du Tennis de Table
              </div>
              
              <h1 className="font-display text-5xl md:text-7xl font-extrabold tracking-tighter leading-[0.95] text-white mb-6">
                Le Tennis de Table <br />
                <span className="text-[#f97316]">sous une autre dimension</span>
              </h1>
              
              <p className="text-slate-300 text-lg md:text-xl max-w-xl leading-relaxed mb-8">
                Suivi en direct, inscriptions instantanées et arbitrages automatisés. Rejoignez ou organisez des compétitions de tennis de table de façon fluide, moderne et ultra-performante.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <a 
                  href="#tournaments-list-section" 
                  className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#f97316] hover:bg-[#ea6a0a] text-white font-bold tracking-tight transition-all shadow-lg shadow-orange-500/20 cursor-pointer"
                >
                  Découvrir les tournois
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
                <button 
                  onClick={handleOrganizerClick}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border-2 border-[#2a3548] hover:border-[#f97316] text-slate-200 hover:text-white hover:bg-white/[0.02] font-bold tracking-tight transition-all cursor-pointer"
                >
                  Créer un tournoi
                </button>
              </div>
            </motion.div>
          </div>
          
          {/* Mockup visuel sportif premium */}
          <div className="lg:col-span-5 relative flex justify-center lg:justify-end">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="relative w-full max-w-[400px] h-[340px] bg-gradient-to-tr from-[#0a1729] to-[#152031] rounded-2xl border border-[#2a3548] shadow-2xl p-6 flex flex-col justify-between overflow-hidden group"
            >
              {/* Table De Ping Pong Stylisée en fond */}
              <div className="absolute inset-0 opacity-10 flex items-center justify-center">
                <div className="w-4/5 h-2/3 border-4 border-dashed border-white rounded flex items-center justify-center">
                  <div className="w-full h-0.5 bg-white" />
                </div>
              </div>

              <div className="flex items-center justify-between z-10">
                <span className="text-[10px] font-extrabold uppercase bg-white/10 text-[#f97316] border border-[#f97316]/30 px-2.5 py-1 rounded-full tracking-wider">
                  LIVE TRACKING
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-pulse" />
              </div>

              <div className="space-y-3 z-10 my-auto">
                <p className="font-display text-2xl font-black text-white leading-tight">
                  Suivez vos matches & poules en direct de partout !
                </p>
                <p className="text-slate-400 text-xs font-sans leading-relaxed">
                  Scannez les QR Codes de vos tables d'arbitrage pour accéder à vos scores et classements à l'instant T.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white/[0.04] border border-[#2a3548]/30 p-3 rounded-xl z-10 backdrop-blur-md">
                <div className="w-10 h-10 rounded-lg bg-[#f97316]/20 flex items-center justify-center text-[#f97316]">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <div className="font-sans text-left">
                  <p className="text-xs font-bold text-white">Classements mis à jour</p>
                  <p className="text-[10px] text-slate-400">Précision temps réel certifiée</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="bg-[#111e32] border-y border-[#2a3548]/50 py-12">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="font-display text-4xl md:text-5xl font-black text-[#f97316] tracking-tight tabular-nums">
                {allTournaments.length}+
              </p>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1">Tournois créés</p>
            </div>
            <div>
              <p className="font-display text-4xl md:text-5xl font-black text-[#f97316] tracking-tight tabular-nums">
                100%
              </p>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1">Données FFTT</p>
            </div>
            <div>
              <p className="font-display text-4xl md:text-5xl font-black text-[#f97316] tracking-tight tabular-nums">
                30s
              </p>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1">Inscription Mobile</p>
            </div>
            <div>
              <p className="font-display text-4xl md:text-5xl font-black text-[#f97316] tracking-tight tabular-nums">
                Zéro
              </p>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1">Papier / Saisie double</p>
            </div>
          </div>
        </section>

        {/* Tournaments List Section */}
        <section id="tournaments-list-section" className="py-24 max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div className="text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-semibold mb-3 border border-[#f97316]/20">
                <Calendar className="w-3.5 h-3.5" />
                Événements de la saison
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-white">
                Compétitions Disponibles
              </h2>
            </div>
            <p className="text-slate-400 max-w-md text-sm leading-relaxed font-sans text-left">
              Sélectionnez un tournoi pour vous inscrire rapidement, consulter les tableaux de match, ou suivre les pointages et dossards.
            </p>
          </div>

          {allTournaments.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-[#2a3548] bg-[#152031] font-sans">
              <Trophy className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="font-bold text-lg text-slate-300">Aucun tournoi disponible pour le moment</p>
              <p className="text-sm text-slate-500 mt-1">Revenez très bientôt pour voir les premiers événements !</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
              {allTournaments.map((t) => {
                const sBadge = getStatusBadge(t.status);
                return (
                  <div 
                    key={t.id}
                    onClick={() => {
                      selectTournament(t.id);
                      setActiveTournamentId(t.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="group cursor-pointer p-6 rounded-2xl bg-[#152031] border border-[#2a3548]/80 hover:border-[#f97316] hover:shadow-xl hover:shadow-orange-500/5 transition-all flex flex-col justify-between h-[280px]"
                  >
                    <div className="text-left">
                      <div className="flex justify-between items-start gap-2 mb-4">
                        <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">
                          {t.location || 'Lieu non défini'}
                        </span>
                        {sBadge && (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            t.status === 'open' || t.status === 'registration' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 animate-pulse'
                              : 'bg-[#0a1729] text-slate-450 border-[#2a3548]'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {sBadge.label}
                          </span>
                        )}
                      </div>

                      <h3 className="font-display text-xl font-bold text-white line-clamp-2 leading-snug group-hover:text-[#f97316] transition-colors">
                        {t.name}
                      </h3>
                      
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-3 font-medium">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span>{new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                    </div>

                    <div className="border-t border-[#2a3548]/30 pt-4 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-350 uppercase tracking-widest group-hover:translate-x-1 group-hover:text-white transition-all inline-flex items-center gap-1.5">
                        Ouvrir l'événement
                        <ArrowRight className="w-3.5 h-3.5 text-[#f97316]" />
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-450">
                        {t.nb_tables || 8} tables
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Features Section */}
        <section className="bg-[#152031]/30 py-24 border-t border-[#2a3548]/50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-semibold mb-3 border border-[#f97316]/10">
                <Zap className="w-3.5 h-3.5 animate-bounce" />
                Performance maximale
              </div>
              <h2 className="font-display text-4xl font-bold tracking-tight text-white mb-2">
                Piloter vos tournois comme des pros
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 font-sans">
              <div className="p-6 rounded-2xl bg-[#152031] border border-[#2a3548]/60 hover:-translate-y-1 hover:border-[#f97316]/30 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-[#0f1f3d] border border-[#2a3548] flex items-center justify-center mb-4 group-hover:bg-[#f97316] group-hover:border-[#f97316] transition-colors">
                  <Zap className="w-6 h-6 text-[#f97316] group-hover:text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2 text-left">Inscription Instantanée</h3>
                <p className="text-slate-400 text-sm leading-relaxed text-left">
                  Connexion FFTT simplifiée pour s'inscrire en quelques secondes. Vérification automatique de conformité et des classements.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#152031] border border-[#2a3548]/60 hover:-translate-y-1 hover:border-[#f97316]/30 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-[#0f1f3d] border border-[#2a3548] flex items-center justify-center mb-4 group-hover:bg-[#f97316] group-hover:border-[#f97316] transition-colors">
                  <Smartphone className="w-6 h-6 text-[#f97316] group-hover:text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2 text-left">Suivi sur Smartphone</h3>
                <p className="text-slate-400 text-sm leading-relaxed text-left">
                  Pas besoin d'installer d'application. Suivez vos pointages, vos horaires de convocation et vos tables directement en ligne.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#152031] border border-[#2a3548]/60 hover:-translate-y-1 hover:border-[#f97316]/30 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-[#0f1f3d] border border-[#2a3548] flex items-center justify-center mb-4 group-hover:bg-[#f97316] group-hover:border-[#f97316] transition-colors">
                  <Activity className="w-6 h-6 text-[#f97316] group-hover:text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2 text-left">Live Score Intuitif</h3>
                <p className="text-slate-400 text-sm leading-relaxed text-left">
                  Des QR Codes sur chaque table permettent aux arbitres d'entrer les scores directement sur mobile avec report automatique en temps réel.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#152031] border border-[#2a3548]/60 hover:-translate-y-1 hover:border-[#f97316]/30 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-[#0f1f3d] border border-[#2a3548] flex items-center justify-center mb-4 group-hover:bg-[#f97316] group-hover:border-[#f97316] transition-colors">
                  <Layers className="w-6 h-6 text-[#f97316] group-hover:text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2 text-left">Poules / Tableaux Automatiques</h3>
                <p className="text-slate-400 text-sm leading-relaxed text-left">
                  Génération des poules de 3 ou 4 joueurs d'un clic avec serpentin intelligent, et bascule vers les tableaux à élimination directe.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#152031] border border-[#2a3548]/60 hover:-translate-y-1 hover:border-[#f97316]/30 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-[#0f1f3d] border border-[#2a3548] flex items-center justify-center mb-4 group-hover:bg-[#f97316] group-hover:border-[#f97316] transition-colors">
                  <Trophy className="w-6 h-6 text-[#f97316] group-hover:text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2 text-left">Arbitrage Simplifié</h3>
                <p className="text-slate-400 text-sm leading-relaxed text-left">
                  Une interface d'arbitrage épurée, sécurisée, empêchant les scores invalides pour des compétitions sans accroc.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#152031] border border-[#2a3548]/60 hover:-translate-y-1 hover:border-[#f97316]/30 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-[#0f1f3d] border border-[#2a3548] flex items-center justify-center mb-4 group-hover:bg-[#f97316] group-hover:border-[#f97316] transition-colors">
                  <CheckCircle2 className="w-6 h-6 text-[#f97316] group-hover:text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2 text-left">Garantie Sans Papier</h3>
                <p className="text-slate-400 text-sm leading-relaxed text-left">
                  Économisez du temps et des impressions. Les feuilles de matches papier et les crayons font désormais partie du passé.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works Section */}
        <section className="bg-[#111e32] border-y border-[#2a3548]/50 py-24 text-white text-center relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 relative z-10 font-sans">
            <h2 className="font-display text-4xl font-bold tracking-tight mb-16 text-white">
              Comment ça marche pour un joueur ?
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
              {/* Ligne de connexion orange cachée sur petit écran */}
              <div className="hidden lg:block absolute top-8 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-[#f97316] to-[#f97316] z-0 opacity-20" />
              
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-[#152031] border-2 border-[#f97316] flex items-center justify-center font-display font-extrabold text-[#f97316] text-xl mb-4 mx-auto shadow-lg shadow-orange-500/5">
                  01
                </div>
                <h3 className="font-display font-bold text-lg mb-2 text-white">Sélection</h3>
                <p className="text-slate-400 text-xs px-4">Choisis ton tournoi dans la liste active.</p>
              </div>

              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-[#152031] border-2 border-[#f97316] flex items-center justify-center font-display font-extrabold text-[#f97316] text-xl mb-4 mx-auto shadow-lg shadow-orange-500/5">
                  02
                </div>
                <h3 className="font-display font-bold text-lg mb-2 text-white">Inscription</h3>
                <p className="text-slate-400 text-xs px-4">Saisis ta licence FFTT pour valider ton inscription.</p>
              </div>

              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-[#152031] border-2 border-[#f97316] flex items-center justify-center font-display font-extrabold text-[#f97316] text-xl mb-4 mx-auto shadow-lg shadow-orange-500/5">
                  03
                </div>
                <h3 className="font-display font-bold text-lg mb-2 text-white">Pointage</h3>
                <p className="text-slate-400 text-xs px-4">Le jour J, pointe-toi à la table et récupère ton dossard.</p>
              </div>

              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-[#152031] border-2 border-[#f97316] flex items-center justify-center font-display font-extrabold text-[#f97316] text-xl mb-4 mx-auto shadow-lg shadow-orange-500/5">
                  04
                </div>
                <h3 className="font-display font-bold text-lg mb-2 text-white">Live score</h3>
                <p className="text-slate-400 text-xs px-4">Suis l'avancement en live et joue tes matches.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Audience Section */}
        <section className="py-24 max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-2xl bg-[#152031] text-white border border-[#2a3548] shadow-lg flex flex-col justify-between group font-sans">
            <div className="text-left">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold mb-6 border border-white/5">
                Joueurs & Compétiteurs
              </span>
              <h3 className="font-display text-3xl font-bold tracking-tight mb-4">
                Une expérience de jeu immersive
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Fini l'attente interminable devant les panneaux de liège et d'arbitrage. Soyez notifiés en temps réel, trouvez rapidement votre table et jouez dans les meilleures conditions.
              </p>
            </div>
            <a href="#tournaments-list-section" className="group inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#f97316] hover:bg-[#ea6a0a] text-white font-bold tracking-tight transition-all cursor-pointer w-max shadow-md shadow-orange-500/10">
              Trouver un tournoi
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          <div className="p-8 rounded-2xl bg-[#152031] text-white border border-[#2a3548] shadow-lg flex flex-col justify-between group hover:border-[#f97316]/50 transition-all font-sans">
            <div className="text-left">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-semibold mb-6 border border-[#f97316]/20">
                Clubs & Organisateurs
              </span>
              <h3 className="font-display text-3xl font-bold tracking-tight mb-4">
                Simplifiez l'organisation de A à Z
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Gérez les inscriptions en ligne de manière autonome. Vos poules de match et les tableaux se réactualisent au fil des résultats enregistrés. Un pur concentré d'efficacité sportive.
              </p>
            </div>
            <button onClick={handleOrganizerClick} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#2a3548] hover:border-[#f97316] text-slate-200 hover:text-white hover:bg-white/[0.02] font-bold tracking-tight transition-all cursor-pointer w-max">
              Accéder à l'Espace Club
            </button>
          </div>
        </section>

        {/* CTA final Section stylized block */}
        <section className="mb-24 px-6 max-w-6xl mx-auto">
          <div className="bg-gradient-to-r from-[#ea6a0a] to-[#f97316] py-16 text-white text-center rounded-[2.5rem] border border-[#f97316]/20 shadow-2xl shadow-orange-500/5 px-6">
            <div className="max-w-4xl mx-auto font-sans">
              <h2 className="font-display text-4xl font-extrabold tracking-tight mb-4 text-white">
                Prêt à lancer votre premier tournoi ?
              </h2>
              <p className="text-white/85 max-w-lg mx-auto text-sm mb-8 leading-relaxed">
                Inscrivez votre club sur Ping Manager dès aujourd'hui et offrez à vos joueurs une interface de compétition connectée, premium et immersive.
              </p>
              <button 
                onClick={handleOrganizerClick}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-[#0a1729] hover:bg-[#111e32] text-white font-bold tracking-tight transition-all shadow-xl shadow-black/20 cursor-pointer"
              >
                Créer mon compte club
                <ArrowRight className="w-4 h-4 text-[#f97316]" />
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  };

  const renderTournamentDetails = () => {
    return (
      <div className="bg-[#0a1729] text-slate-100 font-sans min-h-screen selection:bg-[#f97316] selection:text-white">
        {/* Hero Section */}
        <section className="py-16 md:py-24 max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-left"
            >
              {badge && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.color} mb-6`}>
                  <span className="w-2 h-2 rounded-full bg-current" />
                  {badge.label}
                </span>
              )}

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-none">
                {tournament ? tournament.name : 'Prêt pour le Prochain Smash ?'}
              </h1>

              <p className="text-slate-300 text-base md:text-lg mt-6 max-w-xl leading-relaxed">
                {tournament 
                  ? `Bienvenue sur la plateforme officielle du tournoi. Suivez l'avancement des poules et du tableau final en temps réel, ou inscrivez-vous dès maintenant !`
                  : 'Planifiez vos tournois de tennis de table, gérez les inscriptions des clubs, les poules dynamiques et suivez de près l’attribution des tables en live.'}
              </p>

              {tournament && (
                <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold text-slate-300">
                  <div className="flex items-center gap-2 bg-[#152031] px-4 py-2.5 rounded-2xl border border-[#2a3548] shadow-md">
                    <Calendar className="w-4 h-4 text-[#f97316]" />
                    <span>{new Date(tournament.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  {tournament.location && (
                    <div className="flex items-center gap-2 bg-[#152031] px-4 py-2.5 rounded-2xl border border-[#2a3548] shadow-md">
                      <MapPin className="w-4 h-4 text-[#f97316]" />
                      <span>{tournament.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-[#152031] px-4 py-2.5 rounded-2xl border border-[#2a3548] shadow-md">
                    <Trophy className="w-4 h-4 text-[#f97316]" />
                    <span>{tournament.nb_tables || 8} Tables physiques</span>
                  </div>
                </div>
              )}

              {/* Tableaux et places restantes */}
              {tournament && categories.length > 0 && (
                <div className="mt-12 space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-[#2a3548]/80 pb-3">
                    <Trophy className="w-4.5 h-4.5 text-[#f97316]" />
                    <h3 className="font-extrabold text-[11px] text-slate-200 uppercase tracking-widest">
                      Tableaux Disponibles & Places Restantes
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categories.map((cat, idx) => {
                      const count = players.filter(p => p.serie === cat.name).length;
                      const capacity = cat.capacity || 32;
                      const spotsLeft = Math.max(0, capacity - count);
                      const isFull = spotsLeft === 0;
                      const color = cat.color_code || '#f97316';

                      return (
                        <div 
                          key={idx} 
                          className="bg-[#152031] p-4 rounded-2xl border border-[#2a3548] hover:border-[#f97316]/45 hover:shadow-lg hover:shadow-orange-500-[1.5%] transition-all flex flex-col justify-between gap-3 relative overflow-hidden group"
                        >
                          {/* Petite bordure colorée sur le côté gauche */}
                          <div 
                            className="absolute left-0 top-0 bottom-0 w-1.5 transition-all group-hover:w-2"
                            style={{ backgroundColor: color }}
                          />

                          <div className="pl-2">
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-bold text-white text-sm tracking-tight truncate max-w-[140px]" title={cat.name}>
                                {cat.name}
                              </span>
                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-[#0a1729] text-slate-300 border border-[#2a3548] whitespace-nowrap">
                                {cat.price ? `${Number(cat.price).toFixed(2)}€` : 'Gratuit'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[10px] font-bold text-slate-450 font-sans">
                              <span className="text-[#f97316]">{cat.min_points ?? 500} - {cat.max_points ?? 3000} pts</span>
                              {cat.day_number && (
                                <>
                                  <span className="text-[#2a3548]">•</span>
                                  <span className="text-slate-400">Jour {cat.day_number}</span>
                                </>
                              )}
                              {cat.start_time && (
                                <>
                                  <span className="text-[#2a3548]">•</span>
                                  <span className="text-orange-400">{cat.start_time}</span>
                                </>
                              )}
                            </div>

                            {(() => {
                              const payMethods: any = tournament?.payment_methods || {};
                              const regPeriods = payMethods.registration_periods || {};
                              const period = regPeriods[cat.day_number?.toString() || '1'];
                              
                              if (period && period.start && period.end) {
                                const now = new Date();
                                const start = new Date(period.start);
                                const end = new Date(period.end);
                                let regStatus: 'not_started' | 'open' | 'closed' = 'open';
                                let formattedPeriodStr = '';
                                
                                if (now < start) {
                                  regStatus = 'not_started';
                                  formattedPeriodStr = `Ouvrent le ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                                } else if (now > end) {
                                  regStatus = 'closed';
                                  formattedPeriodStr = `Closes depuis le ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
                                } else {
                                  regStatus = 'open';
                                  formattedPeriodStr = `Fermeture : ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                                }
                                
                                return (
                                  <div className="mt-2 text-[10px] font-extrabold flex items-center gap-1 font-sans">
                                    {regStatus === 'not_started' && (
                                      <span className="text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                                        ⏳ Débute le : {formattedPeriodStr}
                                      </span>
                                    )}
                                    {regStatus === 'closed' && (
                                      <span className="text-[#ef4444] bg-[#ef4444]/5 px-2 py-0.5 rounded border border-[#ef4444]/20 flex items-center gap-1">
                                        🔒 Inscriptions closes
                                      </span>
                                    )}
                                    {regStatus === 'open' && (
                                      <span className="text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1 animate-pulse">
                                        ✅ {formattedPeriodStr}
                                      </span>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          {/* Jauge et places restantes */}
                          <div className="pl-2 pt-2 border-t border-[#2a3548]/40">
                            <div className="flex justify-between items-center text-xs mb-1">
                              <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">Inscrits</span>
                              <span className={`font-mono font-extrabold text-[11px] ${isFull ? 'text-[#ef4444]' : 'text-slate-200'}`}>
                                {count} / {capacity}
                              </span>
                            </div>
                            <div className="w-full bg-[#0a1729] rounded-full h-1.5 overflow-hidden border border-[#2a3548]/30">
                              <div 
                                className="h-full rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${Math.min(100, (count / capacity) * 100)}%`,
                                  backgroundColor: isFull ? '#ef4444' : color
                                }}
                              />
                            </div>
                            <div className="flex justify-between items-center mt-2.5">
                              <span className="text-[9px] text-slate-450 font-extrabold uppercase tracking-wide">Statut</span>
                              {isFull ? (
                                <span className="text-[9px] font-black uppercase text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/25 px-2 py-0.5 rounded tracking-wider">
                                  Complet 🚫
                                </span>
                              ) : spotsLeft <= 5 ? (
                                <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded tracking-wider animate-pulse">
                                  {spotsLeft} places !
                                </span>
                              ) : (
                                <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded tracking-wider">
                                  {spotsLeft} places libres
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {tournament && ['pools', 'bracket', 'in_progress'].includes(tournament.status) && (
                <div className="mt-8 font-sans">
                  <button
                    onClick={() => navigate('/live-scores')}
                    className="px-6 py-4 bg-[#f97316] hover:bg-[#ea6a0a] text-white font-bold rounded-2xl shadow-xl shadow-orange-500/10 hover-translate-y-0.5 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="w-5 h-5 animate-spin-slow" />
                    Consulter les Tables & Scores en Live
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right side: Register Form or Tournament Info */}
          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              {loading ? (
                <div className="bg-[#152031] p-8 rounded-[2rem] border border-[#2a3548] shadow-2xl text-center text-slate-400 py-16">
                  <Loader2 className="w-8 h-8 text-[#f97316] animate-spin mx-auto mb-3" />
                  Chargement des informations...
                </div>
              ) : tournament && ['open', 'registration'].includes(tournament.status) ? (
                /* Inscription Form */
                <div className="bg-[#152031] p-8 rounded-[2rem] border border-[#2a3548] shadow-2xl text-left">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[#f97316]/10 rounded-xl flex items-center justify-center text-[#f97316]">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-white">Formulaire d'Inscription</h3>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {manualEntry ? "Saisie manuelle des coordonnées" : "Rejoignez instantanément via votre licence FFTT"}
                      </p>
                    </div>
                  </div>

                  {!manualEntry ? (
                    /* FFTT Licence lookup workflow */
                    !ffttPlayer ? (
                      <form onSubmit={handleSearchLicence} className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                            Numéro de Licence FFTT (7 chiffres)
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              maxLength={7}
                              placeholder="Ex: 7512345"
                              className="w-full pl-4 pr-12 py-3.5 bg-[#0a1729] border border-[#2a3548] hover:bg-[#0a1729]/80 focus:bg-[#0a1729] rounded-xl outline-none focus:ring-2 focus:ring-[#f97316] font-extrabold text-base tracking-widest text-white transition-all placeholder:tracking-normal placeholder:font-semibold placeholder:text-sm placeholder:text-slate-600"
                              value={licenceInput}
                              onChange={e => setLicenceInput(e.target.value.replace(/\D/g, ''))}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                              <Search className="w-5 h-5 text-[#f97316]" />
                            </div>
                          </div>
                          <p className="text-slate-400 text-[11px] mt-2 leading-relaxed font-medium">
                            Saisissez <strong className="text-white hover:text-[#f97316] transition-colors cursor-pointer" onClick={() => setLicenceInput('7512345')}>7512345</strong>, <strong className="text-white hover:text-[#f97316] transition-colors cursor-pointer" onClick={() => setLicenceInput('8011223')}>8011223</strong> ou <strong className="text-white hover:text-[#f97316] transition-colors cursor-pointer" onClick={() => setLicenceInput('5944332')}>5944332</strong> pour tester avec les profils de démonstration.
                          </p>
                        </div>

                        <button
                          type="submit"
                          disabled={searchingLicence || !licenceInput.trim()}
                          className="w-full py-4 bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-50 text-white font-extrabold rounded-xl shadow-lg shadow-orange-500/10 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {searchingLicence ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Récupération de la fiche...
                            </>
                          ) : (
                            <>
                              <Search className="w-4 h-4" />
                              Importer mes données FFTT 🏓
                            </>
                          )}
                        </button>

                        <div className="text-center pt-3 border-t border-[#2a3548]/40 mt-4">
                          <button
                            type="button"
                            onClick={() => setManualEntry(true)}
                            className="text-xs text-[#f97316] hover:text-orange-400 font-bold transition-all hover:underline cursor-pointer"
                          >
                            S'inscrire manuellement sans licence
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Display loaded FFTT details and let player complete registration */
                      <form onSubmit={handleRegister} className="space-y-4">
                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                            <Check className="w-4 h-4" />
                          </div>
                          <div className="space-y-1 font-sans text-left">
                            <p className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">Données FFTT Confirmées</p>
                            <p className="text-sm font-black text-white">
                              {ffttPlayer.prenom} {ffttPlayer.nom}
                            </p>
                            <p className="text-xs text-slate-400">
                              Club : <span className="font-bold text-slate-200">{ffttPlayer.club || "Indépendant / Aucun Club"}</span>
                            </p>
                            <p className="text-xs text-slate-400">
                              Points FFTT : <span className="font-extrabold text-[#f97316] text-sm">{ffttPlayer.classement || 500} pts</span>
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">
                            Sélectionnez vos Tableaux (Inscriptions Multiples possibles)
                          </label>
                          <div className="bg-[#0a1729] border border-[#2a3548] p-3 rounded-2xl space-y-2 max-h-[220px] overflow-y-auto">
                            {categories.length > 0 ? (
                              categories.map((cat, idx) => {
                                const isEligible = (ffttPlayer?.classement || 500) >= (cat.min_points ?? 500) && (ffttPlayer?.classement || 500) <= (cat.max_points ?? 3000);
                                const isChecked = selectedSeries.includes(cat.name);
                                return (
                                  <label key={idx} className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                                    !isEligible ? 'opacity-30 cursor-not-allowed bg-slate-900 border-transparent' :
                                    cat.is_closed ? 'opacity-30 cursor-not-allowed bg-red-950/20 border-red-900/30' :
                                    isChecked ? 'bg-[#f97316]/5 border-[#f97316]/40 shadow-sm' : 'bg-[#152031] border-[#2a3548] hover:bg-white/[0.01]'
                                  }`}>
                                    <input
                                      type="checkbox"
                                      disabled={!isEligible || cat.is_closed}
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setSelectedSeries(selectedSeries.filter(s => s !== cat.name));
                                        } else {
                                          setSelectedSeries([...selectedSeries, cat.name]);
                                        }
                                      }}
                                      className="mt-1 h-4 w-4 rounded text-[#f97316] focus:ring-[#f97316] border-[#2a3548] cursor-pointer accent-[#f97316]"
                                    />
                                    <div className="font-sans text-xs">
                                      <p className="font-bold text-white">{cat.name}</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        Journée {cat.day_number} • {cat.min_points} à {cat.max_points} pts • {cat.price}€
                                        {cat.is_closed ? ' 🔒 (Tableau clos)' : ''}
                                        {!isEligible ? ' ⚠️ (Classement incompatible)' : ''}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })
                            ) : (
                              <p className="text-xs text-slate-400">Aucun tableau disponible.</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                              Email de Contact
                            </label>
                            <input
                              type="email"
                              required
                              placeholder="Ex: joueur@gmail.com"
                              className="w-full px-4 py-3 bg-[#0a1729] border border-[#2a3548] hover:bg-[#0a1729]/80 focus:bg-[#0a1729] rounded-xl outline-none focus:ring-2 focus:ring-[#f97316] font-semibold text-sm transition-all text-white"
                              value={formData.email || ''}
                              onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                              Téléphone Portable
                            </label>
                            <input
                              type="tel"
                              required
                              placeholder="Ex: 0612345678"
                              className="w-full px-4 py-3 bg-[#0a1729] border border-[#2a3548] hover:bg-[#0a1729]/80 focus:bg-[#0a1729] rounded-xl outline-none focus:ring-2 focus:ring-[#f97316] font-semibold text-sm transition-all text-white"
                              value={formData.phone || ''}
                              onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setFfttPlayer(null);
                              setLicenceInput('');
                              setSelectedSeries([]);
                            }}
                            className="px-4 py-3 bg-[#0a1729] hover:bg-white/5 border border-[#2a3548] text-slate-300 font-bold rounded-xl transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                            title="Saisir un autre numéro"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            Annuler
                          </button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 py-3 bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-50 text-white font-extrabold rounded-xl shadow-lg shadow-orange-500/10 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {submitting ? 'Validation...' : 'Confirmer mes inscriptions 🎯'}
                          </button>
                        </div>
                      </form>
                    )
                  ) : (
                    /* Fallback Manual form if requested */
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nom</label>
                        <input
                          type="text"
                          required
                          placeholder="Votre nom"
                          className="w-full px-4 py-3 bg-[#0a1729] border border-[#2a3548] hover:bg-[#0a1729]/80 focus:bg-[#0a1729] rounded-xl outline-none focus:ring-2 focus:ring-[#f97316] font-semibold text-sm text-white transition-all"
                          value={formData.lastName}
                          onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Prénom</label>
                        <input
                          type="text"
                          required
                          placeholder="Votre prénom"
                          className="w-full px-4 py-3 bg-[#0a1729] border border-[#2a3548] hover:bg-[#0a1729]/80 focus:bg-[#0a1729] rounded-xl outline-none focus:ring-2 focus:ring-[#f97316] font-semibold text-sm text-white transition-all"
                          value={formData.firstName}
                          onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Club (Optionnel)</label>
                        <input
                          type="text"
                          placeholder="Ex: ASPTT Amiens"
                          className="w-full px-4 py-3 bg-[#0a1729] border border-[#2a3548] hover:bg-[#0a1729]/80 focus:bg-[#0a1729] rounded-xl outline-none focus:ring-2 focus:ring-[#f97316] font-semibold text-sm text-white transition-all"
                          value={formData.club}
                          onChange={e => setFormData({ ...formData, club: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">N° de Licence (Optionnel)</label>
                        <input
                          type="text"
                          placeholder="Ex: 012345"
                          className="w-full px-4 py-3 bg-[#0a1729] border border-[#2a3548] hover:bg-[#0a1729]/80 focus:bg-[#0a1729] rounded-xl outline-none focus:ring-2 focus:ring-[#f97316] font-semibold text-sm transition-all font-mono text-white"
                          value={formData.licenceNumber}
                          onChange={e => setFormData({ ...formData, licenceNumber: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Points de Classement Actuels (ex: 500, 650, 1200)</label>
                        <input
                          type="number"
                          required
                          min={500}
                          max={3000}
                          placeholder="Ex: 500"
                          className="w-full px-4 py-3 bg-[#0a1729] border border-[#2a3548] hover:bg-[#0a1729]/80 focus:bg-[#0a1729] rounded-xl outline-none focus:ring-2 focus:ring-[#f97316] font-semibold text-sm text-white transition-all"
                          value={formData.points}
                          onChange={e => setFormData({ ...formData, points: Number(e.target.value) || 500 })}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            Email de Contact
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="Ex: joueur@gmail.com"
                            className="w-full px-4 py-3 bg-[#0a1729] border border-[#2a3548] hover:bg-[#0a1729]/80 focus:bg-[#0a1729] rounded-xl outline-none focus:ring-2 focus:ring-[#f97316] font-semibold text-sm transition-all text-white"
                            value={formData.email || ''}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            Téléphone Portable
                          </label>
                          <input
                            type="tel"
                            required
                            placeholder="Ex: 0612345678"
                            className="w-full px-4 py-3 bg-[#0a1729] border border-[#2a3548] hover:bg-[#0a1729]/80 focus:bg-[#0a1729] rounded-xl outline-none focus:ring-2 focus:ring-[#f97316] font-semibold text-sm transition-all text-white"
                            value={formData.phone || ''}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2 text-left">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          Sélectionnez vos Tableaux (Inscriptions Multiples)
                        </label>
                        <div className="bg-[#0a1729] border border-[#2a3548] p-3 rounded-2xl space-y-2 max-h-[220px] overflow-y-auto">
                          {categories.length > 0 ? (
                            categories.map((cat, idx) => {
                              const isEligible = formData.points >= (cat.min_points ?? 500) && formData.points <= (cat.max_points ?? 3000);
                              const isChecked = selectedSeries.includes(cat.name);
                              return (
                                <label key={idx} className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                                  !isEligible ? 'opacity-30 cursor-not-allowed bg-slate-900 border-transparent' :
                                  cat.is_closed ? 'opacity-30 cursor-not-allowed bg-red-950/20 border-red-900/40' :
                                  isChecked ? 'bg-[#f97316]/5 border-[#f97316]/45 shadow-sm' : 'bg-[#152031] border-[#2a3548] hover:bg-white/[0.01]'
                                }`}>
                                  <input
                                    type="checkbox"
                                    disabled={!isEligible || cat.is_closed}
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedSeries(selectedSeries.filter(s => s !== cat.name));
                                      } else {
                                        setSelectedSeries([...selectedSeries, cat.name]);
                                      }
                                    }}
                                    className="mt-1 h-4 w-4 rounded text-[#f97316] focus:ring-[#f97316] border-[#2a3548] cursor-pointer accent-[#f97316]"
                                  />
                                  <div className="font-sans text-xs">
                                    <p className="font-bold text-white">{cat.name}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      Journée {cat.day_number} • {cat.min_points} à {cat.max_points} pts • {cat.price}€
                                      {cat.is_closed ? ' 🔒 (Tableau clos)' : ''}
                                      {!isEligible ? ' ⚠️ (Classement incompatible)' : ''}
                                    </p>
                                  </div>
                                </label>
                              );
                            })
                          ) : (
                            <p className="text-xs text-slate-450">Aucun tableau disponible.</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setManualEntry(false);
                            setSelectedSeries([]);
                          }}
                          className="px-4 py-3 bg-[#0a1729] hover:bg-white/5 border border-[#2a3548] text-slate-300 font-bold rounded-xl transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Retour Licence
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="flex-1 py-3 bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-orange-500/10 active:scale-[0.98] transition-all text-sm flex items-center justify-center cursor-pointer"
                        >
                          {submitting ? 'Validation...' : 'Valider mes inscriptions 🏓'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                /* Informative card about why registration is locked or missing */
                <div className="bg-[#152031] p-8 rounded-[2rem] border border-[#2a3548] shadow-2xl space-y-6 text-left">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-[#f97316]/5 border border-[#f97316]/20 rounded-full flex items-center justify-center mx-auto mb-4 text-[#f97316]">
                      <Info className="w-8 h-8 font-light" />
                    </div>
                    <h3 className="font-extrabold text-xl text-white">
                      {tournament?.status === 'draft' ? "Inscriptions à Venir ⏳" : "Inscriptions Clôturées 🔒"}
                    </h3>
                    <p className="text-slate-400 text-sm mt-3 font-medium leading-relaxed">
                      {tournament?.status === 'draft' 
                        ? "Le tournoi est actuellement en préparation par l'organisateur. Les inscriptions ne sont pas encore ouvertes."
                        : tournament 
                          ? "Le tournoi est actuellement en cours, terminé ou n'est plus en phase d'inscription en ligne."
                          : "Aucun événement actif n'est configuré en inscriptions ouvertes actuellement."}
                    </p>
                  </div>

                  {tournament && (
                    <div className="bg-[#0a1729] p-4 rounded-2xl border border-[#2a3548] flex items-center gap-3">
                      <Users className="w-5 h-5 text-[#f97316] shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Statistiques de Participation</p>
                        <p className="text-sm font-bold text-white mt-0.5">{stats.players} compétiteurs déjà enregistrés</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* ESPACE POINTAGE ET TEST DU TOKEN JOUEUR (Nouveauté v0.5.1) */}
            <div className="bg-[#152031] p-7 rounded-[2rem] border border-[#2a3548] shadow-2xl mt-6">
              <div className="flex items-center gap-3 mb-5 text-left">
                <div className="w-10 h-10 bg-[#f97316]/10 rounded-xl flex items-center justify-center text-[#f97316]">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">🔑 Mon Jeton Joueur (Token)</h3>
                  <p className="text-slate-400 text-xs">Testez votre pointage ou validez votre présence</p>
                </div>
              </div>

              <div className="space-y-4 font-sans">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Saisissez ou collez votre token joueur"
                    className="flex-1 px-4 py-2.5 bg-[#0a1729] border border-[#2a3548] focus:bg-[#0a1729] rounded-xl outline-none focus:ring-2 focus:ring-[#f97316] font-mono text-xs text-white transition-all font-semibold placeholder:text-slate-600"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && tokenInput.trim()) {
                        let val = tokenInput.trim();
                        if (val.includes('/player/')) {
                          val = val.split('/player/').pop() || val;
                        } else if (val.includes('?token=')) {
                          val = val.split('?token=').pop() || val;
                        }
                        if (val.includes('?')) {
                          val = val.split('?')[0];
                        }
                        if (val.endsWith('/')) {
                          val = val.slice(0, -1);
                        }
                        const clean = val.trim();
                        if (clean) {
                          navigate(`/player/${clean}`);
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (tokenInput.trim()) {
                        let val = tokenInput.trim();
                        if (val.includes('/player/')) {
                          val = val.split('/player/').pop() || val;
                        } else if (val.includes('?token=')) {
                          val = val.split('?token=').pop() || val;
                        }
                        if (val.includes('?')) {
                          val = val.split('?')[0];
                        }
                        if (val.endsWith('/')) {
                          val = val.slice(0, -1);
                        }
                        const clean = val.trim();
                        if (clean) {
                          navigate(`/player/${clean}`);
                        }
                      }
                    }}
                    disabled={!tokenInput.trim()}
                    className="px-4 py-2.5 bg-[#f97316] hover:bg-[#e26210] disabled:opacity-40 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <Search className="w-3.5 h-3.5"/>
                    Accéder
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a1729] text-white font-sans selection:bg-[#f97316] selection:text-white">
      {!isSupabaseConfigured && (
        <div className="bg-[#f97316] text-white text-xs md:text-sm py-3 px-4 shadow-md sticky top-0 z-50 text-center font-bold flex items-center justify-center gap-2.5">
          <Info className="w-4 h-4 shrink-0" />
          <span>Configuration Supabase manquante ou non valide. Veuillez paramétrer vos variables d'environnement (VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY) dans vos Secrets pour activer la base de données de Ping Manager.</span>
        </div>
      )}
      {/* Header/Nav */}
      <header className="border-b border-[#2a3548] bg-[#0a1729]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer text-left" onClick={() => setActiveTournamentId(null)}>
            <Logo className="w-11 h-11" />
            <div>
              <span className="font-display font-extrabold tracking-tight text-white text-base leading-none block">Ping Manager</span>
              <span className="text-[10px] block font-sans font-bold text-[#f97316] uppercase tracking-wider -mt-0.5">Espace Joueurs</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {activeTournamentId !== null && (
              <button
                onClick={() => setActiveTournamentId(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-[#2a3548] text-slate-200 hover:bg-white/5 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Tous les tournois</span>
              </button>
            )}
            <button
              onClick={handleOrganizerClick}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-200 bg-white/[0.03] hover:bg-white/10 rounded-xl transition-all border border-[#2a3548]"
            >
              <LogIn className="w-4 h-4" />
              Espace Organisateur
            </button>
          </div>
        </div>
      </header>

      {/* Rendu principal conditionnel */}
      {activeTournamentId === null ? renderGlobalLanding() : renderTournamentDetails()}

      {/* Decorative Wave/Footer */}
      <footer className="bg-[#0f1f3d] text-slate-450 py-12 mt-24 border-t border-[#2a3548]/50">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs">© 2026 Ping Manager. Conçu pour simplifier l'arbitrage et le suivi des tournois.</p>
          <div className="flex gap-6 text-xs font-bold">
            <span className="text-[#f97316] hover:text-orange-400 cursor-pointer">Français</span>
            <span className="text-slate-400">v0.19.24</span>
          </div>
        </div>
      </footer>

      {/* Fenêtre Modale d'Affichage de Statut d'Inscription (Réussite / Incompatibilité) */}
      {modalState.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="bg-white rounded-3xl border border-slate-100 shadow-xl max-w-md w-full overflow-y-auto p-5 sm:p-6 relative transform transition-all animate-in fade-in zoom-in-95 duration-200 max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-5rem)] my-6"
            id="validation-result-modal"
          >
            <div className="text-center space-y-2.5">
              {modalState.type === 'success' ? (
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
              ) : (
                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <Info className="w-10 h-10" />
                </div>
              )}

              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {modalState.title}
              </h3>
              
              <p className="text-xs font-semibold text-slate-500 leading-relaxed px-1">
                {modalState.message}
              </p>

              {modalState.details && (
                <div className="bg-slate-50 border border-slate-100/80 rounded-2xl p-4 text-left space-y-2.5 mt-4 text-xs">
                  <div className="grid grid-cols-2 gap-y-3 text-xs">
                    <div>
                      <span className="block font-bold text-slate-400 uppercase tracking-widest text-[9px] mb-0.5">Joueur</span>
                      <span className="font-extrabold text-slate-800 text-sm">{modalState.details.playerName}</span>
                    </div>
                    <div>
                      <span className="block font-bold text-slate-400 uppercase tracking-widest text-[9px] mb-0.5">Licence / Type</span>
                      <span className="font-extrabold text-slate-800 text-sm">{modalState.details.licence || "N/A"}</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-200/50 pt-3">
                      <span className="block font-bold text-slate-400 uppercase tracking-widest text-[9px] mb-0.5">Tableau / Série</span>
                      <span className="font-black text-indigo-600 text-sm">{modalState.details.categoryName}</span>
                    </div>
                    {modalState.details.playerPoints !== undefined && (
                      <div className="border-t border-slate-200/50 pt-3">
                        <span className="block font-bold text-slate-400 uppercase tracking-widest text-[9px] mb-0.5">Classement Joueur</span>
                        <span className="font-extrabold text-emerald-700 text-sm">{modalState.details.playerPoints} pts</span>
                      </div>
                    )}
                    {modalState.details.requiredRange && (
                      <div className="border-t border-slate-200/50 pt-3">
                        <span className="block font-bold text-slate-400 uppercase tracking-widest text-[9px] mb-0.5">Limites du tableau</span>
                        <span className="font-extrabold text-slate-700 text-sm">{modalState.details.requiredRange}</span>
                      </div>
                    )}
                    {modalState.details.playerEmail && (
                      <div className="col-span-2 border-t border-slate-200/50 pt-3">
                        <span className="block font-bold text-slate-400 uppercase tracking-widest text-[9px] mb-0.5">Contact E-mail</span>
                        <span className="font-extrabold text-slate-800 text-sm select-all">{modalState.details.playerEmail}</span>
                      </div>
                    )}
                  </div>

                  {modalState.details.token ? (
                    <div className="mt-4 space-y-3 pt-3 border-t border-slate-200/50 flex flex-col items-center">
                      <div className="bg-white p-3.5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center shadow-inner">
                        <QRCodeSVG
                          value={`${window.location.origin}/player/${modalState.details.token}`}
                          size={150}
                          level="H"
                          includeMargin={true}
                          className="rounded-lg"
                        />
                        <span className="text-[10px] font-black tracking-widest text-[#f97316] uppercase mt-2.5">
                          QR CODE ESPACE JOUEUR
                        </span>
                      </div>
                      
                      <div className="text-center bg-indigo-50/50 border border-indigo-100/60 p-3 rounded-xl text-[11px] text-slate-600 font-semibold leading-relaxed">
                        📸 Prenez une capture d’écran de ce <strong>QR Code</strong> et présentez-le à l’accueil pour valider directement votre présence, ou utilisez-le pour accéder à votre espace personnalisé d'un simple scan.
                      </div>

                      <div className="space-y-1 w-full text-left">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          Votre Jeton Joueur (Secret)
                        </label>
                        <div className="flex gap-2">
                          <code className="flex-1 font-mono text-[11px] font-black text-indigo-700 select-all overflow-x-auto py-2 px-3 bg-slate-50 border border-indigo-100 rounded-xl flex items-center">
                            {modalState.details.token}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/player/${modalState.details.token || ''}`);
                              toast.success('🔗 Lien de votre espace joueur copié ! ✓');
                            }}
                            className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-md"
                            title="Copier le Lien"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    modalState.details.reason && (
                      <div className="bg-rose-50/70 border border-rose-100/60 p-3.5 rounded-xl text-rose-700 text-xs font-semibold leading-relaxed mt-2.5">
                        ⚠️ {modalState.details.reason}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all text-white shadow-md active:scale-[0.98] ${
                  modalState.type === 'success' 
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-50' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-50'
                }`}
              >
                Compris 🏓
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
