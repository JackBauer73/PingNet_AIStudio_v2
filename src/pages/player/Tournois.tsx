import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';
import { usePlayers } from '../../hooks/usePlayers';
import { supabase, isSupabaseConfigured } from '../../supabase';
import { Trophy, Calendar, MapPin, Users, LogIn, ChevronRight, Sparkles, CheckCircle2, UserPlus, Info, Search, ArrowLeft, Loader2, Check, ArrowRight, Zap, Smartphone, Layers, Activity, Key, Copy } from 'lucide-react';
import { fetchPlayerByLicence } from '../../services/ffttApi';
import { sendPlayerEmail } from '../../services/emailService';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import PublicHeader from '../../components/layout/PublicHeader';

export default function Tournois() {
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
    // Si un ID de tournoi est déjà stocké dans le localStorage public, on l'active
    const publicId = localStorage.getItem('public_selected_tournament_id');
    if (publicId) {
      setActiveTournamentId(publicId);
    }
  }, []);

  useEffect(() => {
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
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div className="text-left font-sans">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-semibold mb-3 border border-[#f97316]/20">
              <Calendar className="w-3.5 h-3.5" />
              Événements de la saison
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-white">
              S'inscrire à une Compétition
            </h1>
            <p className="text-slate-400 mt-2 text-sm max-w-xl">
              Trouvez le tournoi de tennis de table de votre choix ci-dessous. Vous pourrez valider votre présence, suivre vos poules ou vous inscrire en quelques clics.
            </p>
          </div>
        </div>

        {allTournaments.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-[#2a3548] bg-[#152031] font-sans">
            <Trophy className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="font-bold text-lg text-slate-300">Aucun tournoi disponible pour le moment</p>
            <p className="text-sm text-slate-500 mt-1">Revenez très bientôt pour voir les premiers tournois !</p>
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
      </div>
    );
  };

  const renderTournamentDetails = () => {
    return (
      <div className="max-w-6xl mx-auto px-6 py-6 font-sans">
        <button
          onClick={() => {
            localStorage.removeItem('public_selected_tournament_id');
            setActiveTournamentId(null);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-[#2a3548] text-slate-200 hover:bg-white/5 transition-all cursor-pointer mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retourner à la liste</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-left"
            >
              {badge && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.color} mb-6`}>
                  <span className="w-2 h-2 rounded-full bg-current" />
                  {badge.label}
                </span>
              )}

              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none">
                {tournament ? tournament.name : 'Tournoi en cours'}
              </h1>

              {tournament && (
                <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-slate-300">
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
                    <span>{tournament.nb_tables || 8} Tables</span>
                  </div>
                </div>
              )}

              {tournament && categories.length > 0 && (
                <div className="mt-10 space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-[#2a3548]/80 pb-3">
                    <Trophy className="w-4.5 h-4.5 text-[#f97316]" />
                    <h3 className="font-extrabold text-[11px] text-slate-200 uppercase tracking-widest">
                      Tableaux disponibles & inscriptions
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
                        <div key={idx} className="bg-[#152031] p-4 rounded-2xl border border-[#2a3548] relative overflow-hidden group">
                          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} />
                          <div className="pl-2">
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-bold text-white text-sm truncate max-w-[140px]" title={cat.name}>
                                {cat.name}
                              </span>
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#0a1729] text-slate-350 border border-[#2a3548]">
                                {cat.price ? `${Number(cat.price).toFixed(2)}€` : 'Gratuit'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-450 mt-1">
                              Points requis: {cat.min_points} à {cat.max_points} pts • Jour {cat.day_number}
                            </div>
                            <div className="mt-3">
                              <div className="flex justify-between items-center text-xs mb-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Inscrits</span>
                                <span className="font-mono text-xs font-bold">{count}/{capacity}</span>
                              </div>
                              <div className="w-full bg-[#0a1729] rounded-full h-1">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (count / capacity) * 100)}%`, backgroundColor: color }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          <div className="lg:col-span-5 space-y-6">
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
                          Licence FFTT (7 chiffres)
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
                        <p className="text-xs text-slate-400 mt-2">
                          Profils de démo : <strong className="text-white cursor-pointer" onClick={() => setLicenceInput('7512345')}>7512345</strong> (Amiens), <strong className="text-white cursor-pointer" onClick={() => setLicenceInput('8011223')}>8011223</strong> ou <strong className="text-white cursor-pointer" onClick={() => setLicenceInput('5944332')}>5944332</strong>.
                        </p>
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
                        <div className="bg-[#0a1729] border border-[#2a3548] p-3 rounded-2xl space-y-2 max-h-[180px] overflow-y-auto">
                          {categories.map((cat, idx) => {
                            const isEligible = (ffttPlayer?.classement || 500) >= (cat.min_points ?? 500) && (ffttPlayer?.classement || 500) <= (cat.max_points ?? 3000);
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
          <div className="flex gap-6 text-xs font-bold">
            <span className="text-[#f97316] hover:text-orange-400">Français</span>
            <span className="text-slate-400">v0.19.28</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
