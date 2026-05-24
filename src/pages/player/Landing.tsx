import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';
import { usePlayers } from '../../hooks/usePlayers';
import { supabase } from '../../supabase';
import { Trophy, Calendar, MapPin, Users, HeartHandshake, LogIn, ChevronRight, Sparkles, CheckCircle2, UserPlus, Info, Search, ArrowLeft, Loader2, Check } from 'lucide-react';
import { fetchPlayerByLicence } from '../../services/ffttApi';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export default function Landing() {
  const { tournament, stats, loading, refresh } = useTournament();
  const { players, addPlayer } = usePlayers(tournament?.id);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    club: '',
    serie: 'Série A',
    points: 500,
    licenceNumber: '',
  });
  const [licenceInput, setLicenceInput] = useState('');
  const [searchingLicence, setSearchingLicence] = useState(false);
  const [ffttPlayer, setFfttPlayer] = useState<any | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [profileSearch, setProfileSearch] = useState('');

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
    };
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
  });

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
        setFormData({
          lastName: data.nom || '',
          firstName: data.prenom || '',
          club: data.club || '',
          serie: matched ? matched.name : (categories[0]?.name || 'Série A'),
          points: points,
          licenceNumber: data.licence || licenceInput.trim(),
        });
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

    // Récupération des points (selon saisie manuelle ou import FFTT)
    const playerPoints = manualEntry 
      ? Number(formData.points || 500) 
      : (ffttPlayer?.classement || 500);

    const selectedCat = categories.find(c => c.name === formData.serie);

    if (selectedCat && selectedCat.is_closed) {
      setModalState({
        isOpen: true,
        type: 'error',
        title: 'Tableau Clôturé 🔒',
        message: `Les inscriptions pour le tableau "${selectedCat.name}" sont désormais clôturées par l'organisateur. Il n'est plus possible de s'y inscrire.`,
        details: {
          playerName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
          licence: !manualEntry ? licenceInput : 'Saisie manuelle',
          categoryName: selectedCat.name,
          reason: `Ce tableau est clôturé (pointage clos et poules en cours).`
        }
      });
      return;
    }

    // ── VALIDATION DE LA LIMITE DE TABLEAUX PAR JOURNÉE ──
    if (selectedCat && tournament) {
      try {
        const tournamentDataRaw: any = tournament;
        const maxPerDay = Number(tournamentDataRaw.max_categories_per_day) || 3;
        
        if (maxPerDay < 100) { // Sauf si illimité
          // Récupérer les inscriptions du joueur pour ce tournoi
          const { data: existingRegs, error: fetchErr } = await supabase
            .from('registrations')
            .select(`
              table_categories ( name ),
              players ( first_name, last_name )
            `)
            .eq('tournament_id', tournament.id);

          if (!fetchErr && existingRegs && existingRegs.length > 0) {
            const mappedRegs = existingRegs
              .filter((r: any) => {
                const p = Array.isArray(r.players) ? r.players[0] : r.players;
                return p && 
                  p.first_name.toLowerCase() === formData.firstName.trim().toLowerCase() && 
                  p.last_name.toLowerCase() === formData.lastName.trim().toLowerCase();
              })
              .map((r: any) => {
                const c = Array.isArray(r.table_categories) ? r.table_categories[0] : r.table_categories;
                return {
                  serie: c?.name || ''
                };
              });

            // Vérifier si déjà inscrit à ce tableau précisément
            const isAlreadyRegistered = mappedRegs.some(reg => reg.serie === selectedCat.name);
            if (isAlreadyRegistered) {
              setModalState({
                isOpen: true,
                type: 'error',
                title: 'Déjà inscrit(e) ❌',
                message: `Vous êtes déjà inscrit(e) au tableau "${selectedCat.name}".`,
                details: {
                  playerName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
                  licence: !manualEntry ? licenceInput : 'Saisie manuelle',
                  categoryName: selectedCat.name,
                  reason: `Votre inscription pour ce tableau est déjà validée ou en attente d'approbation.`
                }
              });
              return;
            }

            const sameDayRegs = mappedRegs.filter(reg => {
              const cat = categories.find(c => c.name === reg.serie);
              return cat && Number(cat.day_number) === Number(selectedCat.day_number);
            });

            if (sameDayRegs.length >= maxPerDay) {
              setModalState({
                isOpen: true,
                type: 'error',
                title: 'Limite d’inscriptions atteinte ❌',
                message: `L'organisateur de l'événement limite les inscriptions à un maximum de ${maxPerDay} tableau(x) par joueur et par journée de compétition.`,
                details: {
                  playerName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
                  licence: !manualEntry ? licenceInput : 'Saisie manuelle',
                  categoryName: selectedCat.name,
                  reason: `Vous êtes déjà inscrit(e) aux tableaux suivants pour la Journée ${selectedCat.day_number} : ${sameDayRegs.map(r => r.serie).join(', ')}.`
                }
              });
              return;
            }
          }
        }
      } catch (err) {
        console.error('Erreur lors de la validation des limites par journée:', err);
      }
    }

    // ── VALIDATION DES LIMITES DE POINTS DU TABLEAU ──
    if (selectedCat) {
      const minP = selectedCat.min_points ?? 500;
      const maxP = selectedCat.max_points ?? 3000;

      if (playerPoints < minP || playerPoints > maxP) {
        // Validation échouée : Affichage de la fenêtre modale d'erreur explicite
        setModalState({
          isOpen: true,
          type: 'error',
          title: 'Inscription Refusée ❌',
          message: `Votre classement FFTT (${playerPoints} pts) ne vous permet pas de vous inscrire dans le tableau "${selectedCat.name}".`,
          details: {
            playerName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
            licence: !manualEntry ? licenceInput : 'Saisie manuelle',
            categoryName: selectedCat.name,
            playerPoints: playerPoints,
            requiredRange: `${minP} à ${maxP} pts`,
            reason: playerPoints > maxP 
              ? `Votre classement (${playerPoints} pts) dépasse la limite autorisée de ce tableau (maximum ${maxP} pts).`
              : `Votre classement (${playerPoints} pts) est inférieur au minimum requis pour ce tableau (minimum ${minP} pts).`
          }
        });
        return;
      }

      // ── VALIDATION DU GENRE (Optionnel / Si configuré) ──
      if (selectedCat.gender_restriction && selectedCat.gender_restriction !== 'ALL') {
        const playerGender = ffttPlayer?.sexe; // 'M' ou 'F'
        if (playerGender && playerGender !== selectedCat.gender_restriction) {
          const requiredLabel = selectedCat.gender_restriction === 'F' ? 'Féminin 🚺' : 'Masculin 🚹';
          setModalState({
            isOpen: true,
            type: 'error',
            title: 'Restriction de Genre ❌',
            message: `Ce tableau est exclusivement réservé aux compétiteurs de genre ${requiredLabel}.`,
            details: {
              playerName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
              licence: !manualEntry ? licenceInput : 'Saisie manuelle',
              categoryName: selectedCat.name,
              reason: `Votre fiche FFTT indique le genre "${playerGender === 'F' ? 'Féminin' : 'Masculin'}", mais ce tableau requiert le genre "${selectedCat.gender_restriction === 'F' ? 'Féminin' : 'Masculin'}".`
            }
          });
          return;
        }
      }

      // ── VALIDATION DE LA CATÉGORIE D'ÂGE (Optionnel / Si configuré) ──
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
          setModalState({
            isOpen: true,
            type: 'error',
            title: 'Restriction d’Âge ❌',
            message: `Ce tableau est réservé aux catégories d'âge : ${selectedCat.age_categories}.`,
            details: {
              playerName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
              licence: !manualEntry ? licenceInput : 'Saisie manuelle',
              categoryName: selectedCat.name,
              reason: `Votre fiche FFTT indique la catégorie d'âge "${ffttPlayer.categorie}", mais ce tableau requiert : "${selectedCat.age_categories}".`
            }
          });
          return;
        }
      }
    }

    setSubmitting(true);
    const toastId = toast.loading('Inscription en cours...');
    try {
      const result = await addPlayer({
        tournament_id: tournament.id,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        phone: null,
        club: formData.club.trim() || null,
        serie: formData.serie,
        checked_in: null, // Inscriptions publiques : initialement inscrites (non pointées)
        licence_number: formData.licenceNumber ? formData.licenceNumber.trim() : null,
        points: manualEntry 
          ? Number(formData.points || 500) 
          : (ffttPlayer?.classement || ffttPlayer?.initial || ffttPlayer?.mensuel || 500),
      });
      
      if (!result) {
        // Doublon détecté (géré par usePlayers qui renvoie null)
        setSubmitting(false);
        toast.dismiss(toastId);
        return;
      }

      toast.success('🎉 Inscription validée !', { id: toastId });
      
      // Affichage de la fenêtre modale de réussite
      setModalState({
        isOpen: true,
        type: 'success',
        title: 'Inscription Validée ! 🎉',
        message: `Félicitations ! Votre inscription au tableau "${formData.serie}" a été enregistrée avec succès. Nous avons hâte de vous voir sur l'aire de jeu !`,
        details: {
          playerName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
          licence: formData.licenceNumber || (!manualEntry ? licenceInput : 'Saisie manuelle'),
          categoryName: formData.serie,
          playerPoints: playerPoints
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
      });
      setLicenceInput('');
      setFfttPlayer(null);
      refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors de l'inscription", { id: toastId });
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
        return { label: 'Archivé', color: 'bg-slate-50 text-slate-400' };
    }
  };

  const badge = tournament ? getStatusBadge(tournament.status) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header/Nav */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 font-black text-xl">
              🏓
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-slate-950">Ping Manager v2</span>
              <span className="text-[10px] block font-semibold text-indigo-600 uppercase tracking-widest -mt-1">Espace Joueurs</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/organizer')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
          >
            <LogIn className="w-4 h-4" />
            Espace Organisateur
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24 max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {badge && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.color} mb-6`}>
                <span className="w-2 h-2 rounded-full bg-current" />
                {badge.label}
              </span>
            )}

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-none">
              {tournament ? tournament.name : 'Prêt pour le Prochain Smash ?'}
            </h1>

            <p className="text-slate-500 text-lg mt-6 max-w-xl leading-relaxed">
              {tournament 
                ? `Bienvenue sur la plateforme officielle du tournoi. Suivez l'avancement des poules et du tableau final en temps réel, ou inscrivez-vous dès maintenant !`
                : 'Planifiez vos tournois de tennis de table, gérez les inscriptions des clubs, les poules dynamiques et suivez de près l’attribution des tables en live.'}
            </p>

            {tournament && (
              <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold text-slate-600">
                <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <span>{new Date(tournament.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                {tournament.location && (
                  <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    <span>{tournament.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
                  <Trophy className="w-4 h-4 text-indigo-500" />
                  <span>{tournament.nb_tables || 8} Tables physiques</span>
                </div>
              </div>
            )}

            {/* Tableaux et places restantes */}
            {tournament && categories.length > 0 && (
              <div className="mt-10 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-200/60 pb-3">
                  <Trophy className="w-4.5 h-4.5 text-indigo-600" />
                  <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-widest">
                    Tableaux Disponibles & Places Restantes
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.map((cat, idx) => {
                    const count = players.filter(p => p.serie === cat.name && p.checked_in !== false).length;
                    const capacity = cat.capacity || 32;
                    const spotsLeft = Math.max(0, capacity - count);
                    const isFull = spotsLeft === 0;
                    const color = cat.color_code || '#4f46e5';

                    return (
                      <div 
                        key={idx} 
                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-3 relative overflow-hidden group"
                      >
                        {/* Petite bordure colorée sur le côté gauche */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-1.5 transition-all group-hover:w-2"
                          style={{ backgroundColor: color }}
                        />

                        <div className="pl-2">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-slate-950 text-sm tracking-tight truncate max-w-[140px]" title={cat.name}>
                              {cat.name}
                            </span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700 whitespace-nowrap">
                              {cat.price ? `${Number(cat.price).toFixed(2)}€` : 'Gratuit'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[10px] font-bold text-slate-400">
                            <span>{cat.min_points ?? 500} - {cat.max_points ?? 3000} pts</span>
                            {cat.day_number && (
                              <>
                                <span className="text-slate-200">•</span>
                                <span className="text-slate-500">Jour {cat.day_number}</span>
                              </>
                            )}
                            {cat.start_time && (
                              <>
                                <span className="text-slate-200">•</span>
                                <span className="text-indigo-600/80">{cat.start_time}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Jauge et places restantes */}
                        <div className="pl-2 pt-2 border-t border-slate-100/60">
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">Inscrits</span>
                            <span className={`font-extrabold text-[11px] ${isFull ? 'text-rose-600' : 'text-slate-800'}`}>
                              {count} / {capacity}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${Math.min(100, (count / capacity) * 100)}%`,
                                backgroundColor: isFull ? '#e11d48' : color
                              }}
                            />
                          </div>
                          <div className="flex justify-between items-center mt-2.5">
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Statut</span>
                            {isFull ? (
                              <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded tracking-wider">
                                Complet 🚫
                              </span>
                            ) : spotsLeft <= 5 ? (
                              <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded tracking-wider animate-pulse">
                                {spotsLeft} places !
                              </span>
                            ) : (
                              <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded tracking-wider">
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

            {/* Widget de Recherche de Dossard / Statut de Pointage */}
            {tournament && (
              <div id="checkin-lookup-widget" className="mt-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
                    <Search className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Vérifier mon Inscription & Dossard</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Saisissez votre nom ou licence pour suivre votre statut.</p>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou n° de licence..."
                    className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 transition-all font-medium"
                    value={profileSearch || ''}
                    onChange={(e) => setProfileSearch(e.target.value)}
                  />
                </div>

                {profileSearch.trim().length >= 2 && (() => {
                  const cleanedQuery = profileSearch.trim().toLowerCase();
                  
                  // Regrouper les inscriptions par joueur physique
                  const matchingMap = new Map<string, any>();
                  
                  players.forEach(p => {
                    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
                    const licence = p.licence_number || '';
                    if (fullName.includes(cleanedQuery) || licence.includes(cleanedQuery)) {
                      const key = p.licence_number && p.licence_number.trim() !== ''
                        ? `lic_${p.licence_number.trim()}`
                        : `name_${p.first_name.trim().toLowerCase()}_${p.last_name.trim().toLowerCase()}`;

                      if (!matchingMap.has(key)) {
                        matchingMap.set(key, {
                          first_name: p.first_name,
                          last_name: p.last_name,
                          licence_number: p.licence_number || null,
                          club: p.club || null,
                          checked_in: !!p.checked_in,
                          dossard: p.dossard || null,
                          series: [p.serie]
                        });
                      } else {
                        const existing = matchingMap.get(key);
                        if (!existing.series.includes(p.serie)) {
                          existing.series.push(p.serie);
                        }
                        if (p.checked_in) existing.checked_in = true;
                        if (p.dossard && !existing.dossard) existing.dossard = p.dossard;
                      }
                    }
                  });

                  const matchedRows = Array.from(matchingMap.values());

                  if (matchedRows.length === 0) {
                    return (
                      <p className="text-xs text-rose-500 font-medium bg-rose-50 border border-rose-100/50 px-3.5 py-2.5 rounded-xl">
                        Aucune inscription trouvée pour "{profileSearch}".
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-3 pt-2">
                      {matchedRows.map((player, pIdx) => (
                        <div 
                          key={pIdx}
                          className={`p-4 rounded-2xl border transition-all text-xs space-y-2
                            ${player.checked_in 
                              ? 'bg-emerald-500/5 border-emerald-100 text-emerald-800' 
                              : 'bg-amber-500/5 border-amber-100 text-amber-800'}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="font-extrabold text-slate-900 text-sm">
                                {player.last_name.toUpperCase()} {player.first_name}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {player.club || 'Sans club'} {player.licence_number ? `• Licence ${player.licence_number}` : ''}
                              </p>
                            </div>
                            {player.checked_in ? (
                              <span className="font-black text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg shrink-0 shadow-sm">
                                Pointé présent ✓
                              </span>
                            ) : (
                              <span className="font-semibold text-[10px] bg-amber-100 text-amber-850 px-2.5 py-1 rounded-lg shrink-0 shadow-sm">
                                À pointer ⏳
                              </span>
                            )}
                          </div>

                          <div className="border-t border-slate-100/60 pt-2.5 flex flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-slate-400 font-medium text-[10px]">Tableaux :</span>
                              {player.series.map((s: string, sIdx: number) => (
                                <span key={sIdx} className="px-1.5 py-0.5 rounded bg-white border border-slate-100 font-bold uppercase tracking-wide text-[9px] text-slate-600 shadow-sm-flat">
                                  {s}
                                </span>
                              ))}
                            </div>

                            {player.checked_in && player.dossard ? (
                              <div className="mt-1 bg-emerald-100/60 border border-emerald-200/55 p-2 rounded-xl text-emerald-900 font-extrabold text-sm flex items-center gap-2 shadow-sm">
                                <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-600 text-white font-mono font-black rounded-lg text-xs shadow-inner">
                                  {player.dossard}
                                </span>
                                <span>Votre dossard : {player.dossard}</span>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-500 italic mt-1 bg-slate-100/65 p-2 rounded-xl leading-relaxed">
                                Rendez-vous à la table de pointage de l'événement pour récupérer votre dossard.
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
            
            {tournament && ['pools', 'bracket', 'in_progress'].includes(tournament.status) && (
              <div className="mt-8">
                <button
                  onClick={() => navigate('/organizer/scores')}
                  className="px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:shadow-indigo-200 transition-all flex items-center gap-2 active:scale-95"
                >
                  <Sparkles className="w-5 h-5" />
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
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl text-center text-slate-400 py-16">
                Chargement des informations...
              </div>
            ) : tournament && ['draft', 'open', 'registration'].includes(tournament.status) ? (
              /* Inscription Form */
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900">Formulaire d'Inscription</h3>
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
                            className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-100 hover:bg-slate-100/50 focus:bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-extrabold text-base tracking-widest text-slate-800 transition-all placeholder:tracking-normal placeholder:font-semibold placeholder:text-sm"
                            value={licenceInput}
                            onChange={e => setLicenceInput(e.target.value.replace(/\D/g, ''))}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <Search className="w-5 h-5" />
                          </div>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-2 leading-relaxed">
                          Saisissez <strong>7512345</strong>, <strong>8011223</strong> ou <strong>5944332</strong> pour tester avec les profils de démonstration.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={searchingLicence || !licenceInput.trim()}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2"
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

                      <div className="text-center pt-3 border-t border-slate-100 mt-4">
                        <button
                          type="button"
                          onClick={() => setManualEntry(true)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-bold transition-all hover:underline"
                        >
                          S'inscrire manuellement sans licence
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Display loaded FFTT details and let player complete registration */
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="bg-emerald-50/60 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">Données FFTT Confirmées</p>
                          <p className="text-sm font-black text-slate-900">
                            {ffttPlayer.prenom} {ffttPlayer.nom}
                          </p>
                          <p className="text-xs text-slate-500">
                            Club : <span className="font-bold text-slate-700">{ffttPlayer.club || "Indépendant / Aucun Club"}</span>
                          </p>
                          <p className="text-xs text-slate-500">
                            Points FFTT : <span className="font-extrabold text-slate-700 text-sm">{ffttPlayer.classement || 500} pts</span>
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          Tableau / Série d’éligibilité attribuée d'office
                        </label>
                        <select
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-sm text-slate-800"
                          value={formData.serie}
                          onChange={e => setFormData({ ...formData, serie: e.target.value })}
                        >
                          {categories.length > 0 ? (
                            categories.map((cat, idx) => (
                              <option key={idx} value={cat.name} disabled={cat.is_closed}>
                                {cat.name} ({cat.min_points} - {cat.max_points} pts) - {cat.price}€ {cat.is_closed ? '🔒 [CLÔTURÉ]' : ''}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="Série A">Série A (Toutes catégories)</option>
                              <option value="Série B">Série B (-1300 pts)</option>
                              <option value="Série C">Série C (-900 pts)</option>
                              <option value="Jeunes">Cadets / Minimes</option>
                            </>
                          )}
                        </select>
                      </div>



                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFfttPlayer(null);
                            setLicenceInput('');
                          }}
                          className="px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded-xl transition-all text-xs flex items-center gap-1.5"
                          title="Saisir un autre numéro"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Annuler
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-1.5"
                        >
                          {submitting ? 'Validation...' : 'Confirmer mon inscription 🎯'}
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 hover:bg-slate-100/50 focus:bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-sm transition-all"
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 hover:bg-slate-100/50 focus:bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-sm transition-all"
                        value={formData.firstName}
                        onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Club (Optionnel)</label>
                      <input
                        type="text"
                        placeholder="Ex: ASPTT Amiens"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 hover:bg-slate-100/50 focus:bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-sm transition-all"
                        value={formData.club}
                        onChange={e => setFormData({ ...formData, club: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">N° de Licence (Optionnel)</label>
                      <input
                        type="text"
                        placeholder="Ex: 012345"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 hover:bg-slate-100/50 focus:bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-sm transition-all font-mono"
                        value={formData.licenceNumber}
                        onChange={e => setFormData({ ...formData, licenceNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Points de Classement Actuels (ex: 500, 650, 1200)</label>
                      <input
                        type="number"
                        min={500}
                        max={3000}
                        placeholder="Ex: 500"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 hover:bg-slate-100/50 focus:bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-sm transition-all"
                        value={formData.points}
                        onChange={e => setFormData({ ...formData, points: Number(e.target.value) || 500 })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Série / Catégorie d’éligibilité</label>
                      <select
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-sm text-slate-800"
                        value={formData.serie}
                        onChange={e => setFormData({ ...formData, serie: e.target.value })}
                      >
                        {categories.length > 0 ? (
                          categories.map((cat, idx) => (
                            <option key={idx} value={cat.name} disabled={cat.is_closed}>
                              {cat.name} ({cat.min_points} - {cat.max_points} pts) - {cat.price}€ {cat.is_closed ? '🔒 [CLÔTURÉ]' : ''}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="Série A">Série A (Toutes catégories)</option>
                            <option value="Série B">Série B (-1300 pts)</option>
                            <option value="Série C">Série C (-900 pts)</option>
                            <option value="Jeunes">Cadets / Minimes</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setManualEntry(false)}
                        className="px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded-xl transition-all text-xs flex items-center gap-1.5"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Retour Licence
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all text-sm flex items-center justify-center"
                      >
                        {submitting ? 'Validation...' : 'Valider mon inscription 🏓'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* Informative card about why registration is locked or missing */
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500">
                    <Info className="w-8 h-8" />
                  </div>
                  <h3 className="font-extrabold text-xl text-slate-900">Inscriptions Clôturées</h3>
                  <p className="text-slate-500 text-sm mt-2">
                    {tournament 
                      ? "Le tournoi est actuellement en cours ou terminé. Il n'est plus possible de s'inscrire publiquement."
                      : "Aucun événement actif n'est configuré en inscriptions ouvertes actuellement."}
                  </p>
                </div>

                {tournament && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <Users className="w-5 h-5 text-indigo-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statistiques de Participation</p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">{stats.players} compétiteurs déjà enregistrés</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Decorative Wave/Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 mt-24">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs">© 2026 Ping Manager v2. Conçu pour simplifier l'arbitrage et le suivi des tournois.</p>
          <div className="flex gap-6 text-xs font-bold">
            <span className="text-white hover:text-indigo-400 cursor-pointer">Français</span>
            <span className="text-slate-500">v2.0.4-LTS</span>
          </div>
        </div>
      </footer>

      {/* Fenêtre Modale d'Affichage de Statut d'Inscription (Réussite / Incompatibilité) */}
      {modalState.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden p-8 relative transform transition-all animate-in fade-in zoom-in-95 duration-250"
            id="validation-result-modal"
          >
            <div className="text-center space-y-4">
              {modalState.type === 'success' ? (
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
              ) : (
                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <Info className="w-10 h-10" />
                </div>
              )}

              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {modalState.title}
              </h3>
              
              <p className="text-sm font-semibold text-slate-500 leading-relaxed px-2">
                {modalState.message}
              </p>

              {modalState.details && (
                <div className="bg-slate-50 border border-slate-100/80 rounded-2xl p-5 text-left space-y-3 mt-6">
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
                  </div>

                  {modalState.details.reason && (
                    <div className="bg-rose-50/70 border border-rose-100/60 p-3.5 rounded-xl text-rose-700 text-xs font-semibold leading-relaxed mt-2.5">
                      ⚠️ {modalState.details.reason}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                className={`w-full py-4 rounded-xl font-extrabold text-sm transition-all text-white shadow-lg active:scale-[0.98] ${
                  modalState.type === 'success' 
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                }`}
              >
                Compris 🏓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
