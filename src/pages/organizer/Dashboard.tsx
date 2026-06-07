import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';
import { Trophy, Users, Play, Clock, CheckCircle2, Calendar, MapPin, Plus, Trash2, Info, CreditCard, Tag, Pencil, Tv, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../supabase';
import { archiveTournament } from '../../services/archiveTournament';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

import { useMatches } from '../../hooks/useMatches';

function LiveMatchesPreview({ tournamentId }: { tournamentId: string }) {
  const { matches, loading } = useMatches(tournamentId);
  const activeMatches = matches.filter(m => m.status === 'in_progress').slice(0, 3);

  if (loading) return <div className="animate-pulse flex gap-6"><div className="h-40 bg-[#152031] border border-[#2a3548] rounded-[2rem] flex-1" /></div>;

  if (activeMatches.length === 0) {
    return (
      <div className="bg-[#152031] p-12 rounded-[2rem] border border-dashed border-[#2a3548] text-center text-slate-400/80 my-2 select-none">
        <div className="flex flex-col items-center justify-center space-y-2">
          <span className="text-4xl text-[#3f465c] font-bold select-none">🏓</span>
          <p className="text-sm font-semibold text-slate-400">Aucun match en cours sur les tables.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {activeMatches.map(match => (
        <div key={match.id} className="bg-[#152031] p-6 rounded-[2rem] border border-[#2a3548] shadow-lg hover:border-[#f97316]/50 transition-all duration-300">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-extrabold uppercase bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/25 px-2.5 py-1 rounded-md tracking-wider">
              Table {match.table_number}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-sm font-bold text-[#d8e3fb] truncate flex-1 text-right">{match.player1?.last_name}</span>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#0f1f3d] rounded-xl border border-[#1a3056] font-mono font-black italic text-lg text-white select-none">
              <span>{match.sets?.filter(s => s.score_p1 > s.score_p2).length || 0}</span>
              <span className="text-[#3f465c]">:</span>
              <span>{match.sets?.filter(s => s.score_p2 > s.score_p1).length || 0}</span>
            </div>
            <span className="text-sm font-bold text-[#d8e3fb] truncate flex-1 text-left">{match.player2?.last_name}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const TOURNAMENT_STATUS_DETAILS: Record<string, { label: string; color: string }> = {
  draft:       { label: 'Brouillon',        color: 'bg-slate-100 text-slate-600 border-slate-200' },
  open:        { label: 'Inscriptions',     color: 'bg-blue-50 text-blue-700 border-blue-200' },
  registration: { label: 'Inscriptions',    color: 'bg-blue-50 text-blue-700 border-blue-200' },
  pools:       { label: 'Phase de Poules',  color: 'bg-amber-50 text-amber-700 border-amber-200' },
  bracket:     { label: 'Tableau Final',    color: 'bg-purple-50 text-purple-700 border-purple-200' },
  in_progress: { label: 'En cours',         color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed:      { label: 'Terminé',          color: 'bg-slate-100 text-slate-800 border-slate-300' },
  finished:    { label: 'Terminé',          color: 'bg-slate-100 text-slate-800 border-slate-300' },
  archived:    { label: 'Archivé',          color: 'bg-slate-100 text-slate-400 border-slate-200' },
};

const AGE_OPTIONS = [
  { label: 'Poussin', value: 'P', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { label: 'Benjamin', value: 'B', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'Minime', value: 'M', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'Cadet', value: 'C', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { label: 'Junior', value: 'J', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { label: 'Senior', value: 'S', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { label: 'Vétéran', value: 'V', color: 'bg-purple-50 text-purple-700 border-purple-200' }
];

const formatAgeCategories = (raw: string) => {
  if (!raw || raw === 'Toutes catégories' || raw.toLowerCase() === 'toutes') {
    return 'Toutes catégories 👥';
  }
  const codes = raw.split(',').map(c => c.trim().toUpperCase());
  const formatted = codes.map(code => {
    const found = AGE_OPTIONS.find(o => o.value === code);
    return found ? found.label : code;
  });
  return formatted.join(', ');
};

export default function Dashboard() {
  const { tournament, stats, loading, refresh: refreshTournament } = useTournament();
  const { matches } = useMatches(tournament?.id || '');
  const navigate = useNavigate();
  async function ouvrirSurTV() {
    try {
      const details = await (window as any).getScreenDetails?.();
      const ext = details?.screens.find((s: any) => !s.isPrimary);
      if (ext) {
        window.open('/board', 'pm-board',
          `left=${ext.availLeft},top=${ext.availTop},width=${ext.availWidth},height=${ext.availHeight}`);
        return;
      }
    } catch {}
    window.open('/board', 'pm-board', 'width=1280,height=720');
  }
  const [archiving, setArchiving] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  const [activeCategories, setActiveCategories] = useState<any[]>([]);

  // Calcul du jour et des matchs du jour courant
  const currentDay = tournament?.current_day || 1;
  const categoriesToday = activeCategories.filter(cat => (cat.day_number || 1) === currentDay);
  
  const matchesToday = matches.filter(match => {
    const pSerie = match.player1?.serie || match.player2?.serie;
    if (!pSerie) return false;
    const cat = activeCategories.find(c => c.name === pSerie);
    return (cat?.day_number || 1) === currentDay;
  });

  const totalMatchesToday = matchesToday.length;
  const finishedMatchesToday = matchesToday.filter(m => m.status === 'finished' || m.status === 'walkover').length;
  const isDayFinished = totalMatchesToday > 0 && finishedMatchesToday === totalMatchesToday;

  const getLoadedTournamentDaysCount = () => {
    if (!tournament?.date || !tournament?.end_date) return 1;
    const start = new Date(tournament.date);
    const end = new Date(tournament.end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return 1;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleNextDay = async () => {
    if (!tournament) return;
    const nextDay = currentDay + 1;
    const toastId = toast.loading(`Transition vers la Journée ${nextDay}...`);
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ current_day: nextDay })
        .eq('id', tournament.id);
      
      if (error) throw error;
      toast.success(`🎉 Journée clôturée avec succès ! Bienvenue au Jour ${nextDay}.`, { id: toastId });
      refreshTournament();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la transition de journée', { id: toastId });
    }
  };

  const handleSetDay = async (dayNum: number) => {
    if (!tournament) return;
    const toastId = toast.loading(`Activation de la Journée ${dayNum}...`);
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ current_day: dayNum })
        .eq('id', tournament.id);
      
      if (error) throw error;
      toast.success(`Journée ${dayNum} activée.`, { id: toastId });
      refreshTournament();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors du changement de journée', { id: toastId });
    }
  };

  useEffect(() => {
    if (!tournament?.starts_at || (tournament.status !== 'open' && tournament.status !== 'registration')) {
      setTimeLeft('');
      return;
    }
    const timer = setInterval(() => {
      const starts = new Date(tournament.starts_at!).getTime();
      const now = Date.now();
      const diff = starts - now;
      if (diff <= 0) {
        setTimeLeft('Début immédiat !');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [tournament]);

  const handleOpenRegistrations = async () => {
    if (!tournament) return;
    const toastId = toast.loading('Ouverture des inscriptions...');
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ status: 'open' })
        .eq('id', tournament.id);
      if (error) throw error;
      toast.success('Inscriptions ouvertes avec succès !', { id: toastId });
      refreshTournament();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de l’ouverture', { id: toastId });
    }
  };

  const handleReopenTournament = () => {
    if (!tournament) return;
    setShowReopenConfirm(true);
  };

  const handleReopenTournamentConfirmed = async () => {
    if (!tournament) return;
    setShowReopenConfirm(false);

    const toastId = toast.loading('Réouverture du tournoi...');
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ status: 'in_progress' })
        .eq('id', tournament.id);

      if (error) throw error;
      toast.success('Le tournoi a été réouvert avec succès !', { id: toastId });
      refreshTournament();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors de la réouverture", { id: toastId });
    }
  };

  const handleArchive = () => {
    if (!tournament) return;
    setShowArchiveConfirm(true);
  };

  const handleArchiveConfirmed = async () => {
    if (!tournament) return;
    setShowArchiveConfirm(false);

    setArchiving(true);
    const toastId = toast.loading('Archivage du tournoi en cours...');
    try {
      await archiveTournament(tournament.id);
      toast.success('🎉 Tournoi archivé avec succès !', { id: toastId });
      refreshTournament();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors de l'archivage", { id: toastId });
    } finally {
      setArchiving(false);
    }
  };

  const getStatusLabel = (status: string) => {
    return TOURNAMENT_STATUS_DETAILS[status]?.label || status;
  };

  useEffect(() => {
    if (tournament) {
      supabase
        .from('table_categories')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('day_number', { ascending: true })
        .order('start_time', { ascending: true })
        .then(({ data, error }) => {
          if (!error && data) {
            setActiveCategories(data);
          }
        });
    }
  }, [tournament]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newTournament, setNewTournament] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    starts_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
    location: '',
    description: '',
    nb_tables: 8,
    sets_to_win: 2,
    points_per_set: 11,
    max_categories_per_day: 3,
    players_per_pool: 3,
    mode: 'players' as const,
    payment_methods: {
      cb: false,
      cash: true,
      check: false,
      transfer: false,
      onSite: true,
      registration_periods: {} as Record<string, { start: string; end: string }>
    }
  });

  interface TempTableCategory {
    id?: string;
    name: string;
    min_points: number;
    max_points: number;
    price: number;
    capacity: number;
    start_time: string;
    day_number: number;
    gender_restriction: 'M' | 'F' | 'ALL';
    age_categories: string;
    color_code: string;
  }

  const [categories, setCategories] = useState<TempTableCategory[]>([
    {
      name: 'Tableau A - Elite',
      min_points: 500,
      max_points: 3000,
      price: 10,
      capacity: 32,
      start_time: '09:00',
      day_number: 1,
      gender_restriction: 'ALL',
      age_categories: 'Seniors',
      color_code: '#4f46e5'
    }
  ]);

  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState<TempTableCategory>({
    name: '',
    min_points: 500,
    max_points: 1500,
    price: 8,
    capacity: 32,
    start_time: '10:00',
    day_number: 1,
    gender_restriction: 'ALL',
    age_categories: 'Toutes catégories',
    color_code: '#4f46e5'
  });

  const getTournamentDaysCount = () => {
    if (!newTournament.date || !newTournament.end_date) return 1;
    const start = new Date(newTournament.date);
    const end = new Date(newTournament.end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return 1;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const getFormattedDayDate = (baseDateStr: string, dayNum: number) => {
    if (!baseDateStr) return '';
    const base = new Date(baseDateStr);
    if (isNaN(base.getTime())) return '';
    base.setDate(base.getDate() + (dayNum - 1));
    return base.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const [creating, setCreating] = useState(false);

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Cohérence des points
    if (Number(newCategory.min_points) >= Number(newCategory.max_points)) {
      toast.error("Le classement minimum doit être strictement inférieur au classement maximum.");
      return;
    }

    // 2. Noms uniques (en excluant l'élément en cours de modification)
    if (categories.some((c, idx) => idx !== editingCategoryIndex && c.name.toLowerCase() === newCategory.name.trim().toLowerCase())) {
      toast.error("Un tableau possède déjà ce nom dans votre configuration.");
      return;
    }

    // 3. Chevauchement de Séries (exactement même plage de points le même jour, excluant l'élément actuel)
    if (categories.some((c, idx) => 
      idx !== editingCategoryIndex &&
      Number(c.day_number) === Number(newCategory.day_number) && 
      Number(c.min_points) === Number(newCategory.min_points) && 
      Number(c.max_points) === Number(newCategory.max_points)
    )) {
      toast.error("Un tableau possède déjà exactement la même plage de points pour ce jour.");
      return;
    }

    // 4. Capacité
    if (Number(newCategory.capacity) < 2) {
      toast.error("La capacité de compétiteurs doit être d'au moins 2 joueurs.");
      return;
    }

    if (editingCategoryIndex !== null) {
      const updated = [...categories];
      updated[editingCategoryIndex] = { ...newCategory, name: newCategory.name.trim() };
      setCategories(updated);
      setEditingCategoryIndex(null);
      toast.success(`Tableau "${newCategory.name}" modifié avec succès !`);
    } else {
      setCategories([...categories, { ...newCategory, name: newCategory.name.trim() }]);
      toast.success(`Tableau "${newCategory.name}" ajouté avec succès !`);
    }
    setShowAddCategoryModal(false);
  };

  const openEditTournamentModal = () => {
    if (!tournament) return;
    const payMethods: any = tournament.payment_methods || {};
    setNewTournament({
      name: tournament.name,
      date: tournament.date || new Date().toISOString().split('T')[0],
      end_date: tournament.end_date || tournament.date || new Date().toISOString().split('T')[0],
      starts_at: tournament.starts_at ? new Date(tournament.starts_at).toISOString().slice(0, 16) : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
      location: tournament.location || '',
      description: tournament.description || '',
      nb_tables: tournament.nb_tables || 8,
      sets_to_win: tournament.sets_to_win || 2,
      points_per_set: tournament.points_per_set || 11,
      max_categories_per_day: tournament.max_categories_per_day || 3,
      players_per_pool: tournament.players_per_pool || 3,
      mode: (tournament.score_mode || 'players') as any,
      payment_methods: {
        cb: !!payMethods.cb,
        cash: payMethods.cash !== false,
        check: !!payMethods.check,
        transfer: !!payMethods.transfer,
        onSite: payMethods.onSite !== false,
        registration_periods: payMethods.registration_periods || {}
      }
    });

    const formattedCats = activeCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      min_points: cat.min_points,
      max_points: cat.max_points,
      price: cat.price,
      capacity: cat.capacity,
      start_time: cat.start_time || '09:00',
      day_number: cat.day_number || 1,
      gender_restriction: cat.gender_restriction || 'ALL',
      age_categories: cat.age_categories || '',
      color_code: cat.color_code || '#4f46e5'
    }));
    setCategories(formattedCats);
    setIsEditing(true);
    setShowCreateModal(true);
  };

  const handleEditTournamentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tournament) return;

    // Validation des dates du tournoi
    if (new Date(newTournament.end_date) < new Date(newTournament.date)) {
      toast.error("La date de fin doit être égale ou postérieure à la date de début.");
      return;
    }

    // Validation du contenu
    if (categories.length === 0) {
      toast.error("Un tournoi doit posséder au moins un tableau (catégorie) pour être enregistré.");
      return;
    }

    // Validation des périodes d'inscription par journée
    const daysCountForVal = getTournamentDaysCount();
    for (let i = 1; i <= daysCountForVal; i++) {
      const period = newTournament.payment_methods.registration_periods?.[i.toString()];
      if (!period || !period.start || !period.end) {
        toast.error(`Veuillez configurer les dates d'ouverture et de clôture d'inscription pour la Journée ${i}.`);
        return;
      }
      if (new Date(period.end) < new Date(period.start)) {
        toast.error(`La clôture d'inscription de la Journée ${i} doit être après son ouverture.`);
        return;
      }
    }

    setCreating(true);
    const toastId = toast.loading('Mise à jour du tournoi et des tableaux...');

    try {
      // 1. Sauvegarde du Tournoi
      const tournamentData: any = {
        name: newTournament.name.trim(),
        location: newTournament.location.trim() || null,
        description: newTournament.description.trim() || null,
        date: newTournament.date,
        end_date: newTournament.end_date,
        starts_at: null,
        nb_tables: Number(newTournament.nb_tables),
        sets_to_win: Number(newTournament.sets_to_win),
        points_per_set: Number(newTournament.points_per_set),
        max_categories_per_day: Number(newTournament.max_categories_per_day),
        players_per_pool: Number(newTournament.players_per_pool),
        score_mode: newTournament.mode,
        payment_methods: newTournament.payment_methods
      };

      let { error: tError } = await supabase
        .from('tournaments')
        .update(tournamentData)
        .eq('id', tournament.id);

      // --- RETRY LOGIC FOR SCHEMA CACHE ERROR ---
      if (tError && tError.message && (tError.message.includes('max_categories_per_day') || tError.message.includes('players_per_pool'))) {
        console.warn("La colonne 'max_categories_per_day' ou 'players_per_pool' n'existe pas ou n'est pas encore dans le cache du schéma Supabase. Sauvegarde sans ces colonnes...");
        toast.error("Données de configuration manquantes ou obsolètes dans la base. Sauvegarde sans ces paramètres...", { duration: 5000 });
        
        // Supprimer la colonne et réessayer
        const { max_categories_per_day, players_per_pool, ...fallbackData } = tournamentData;
        const fallbackRes = await supabase
          .from('tournaments')
          .update(fallbackData)
          .eq('id', tournament.id);
        
        tError = fallbackRes.error;
      }

      if (tError) throw tError;

      // 2. Mettre à jour les catégories (Séries) d'une manière non destructive
      // On compare les catégories d'origine avec celles modifiées pour supprimer uniquement celles retirées
      const activeIds = activeCategories.map(c => c.id);
      const keptIds = categories.filter(c => c.id).map(c => c.id);
      const idsToDelete = activeIds.filter(id => !keptIds.includes(id));

      if (idsToDelete.length > 0) {
        const { error: deleteCatsError } = await supabase
          .from('table_categories')
          .delete()
          .in('id', idsToDelete);

        if (deleteCatsError) {
          throw new Error("Impossible de supprimer certains tableaux car des joueurs y sont inscrits. Veuillez d'abord retirer les inscriptions associées.");
        }
      }

      const toUpsert = categories
        .filter(cat => cat.id)
        .map(cat => ({
          id: cat.id,
          tournament_id: tournament.id,
          name: cat.name,
          min_points: Number(cat.min_points),
          max_points: Number(cat.max_points),
          price: Number(cat.price),
          capacity: Number(cat.capacity),
          start_time: cat.start_time || null,
          day_number: Number(cat.day_number),
          gender_restriction: cat.gender_restriction,
          age_categories: cat.age_categories.trim() || null,
          color_code: cat.color_code
        }));

      const toInsert = categories
        .filter(cat => !cat.id)
        .map(cat => ({
          tournament_id: tournament.id,
          name: cat.name,
          min_points: Number(cat.min_points),
          max_points: Number(cat.max_points),
          price: Number(cat.price),
          capacity: Number(cat.capacity),
          start_time: cat.start_time || null,
          day_number: Number(cat.day_number),
          gender_restriction: cat.gender_restriction,
          age_categories: cat.age_categories.trim() || null,
          color_code: cat.color_code
        }));

      if (toUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from('table_categories')
          .upsert(toUpsert);
        if (upsertError) throw upsertError;
      }

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('table_categories')
          .insert(toInsert);
        if (insertError) throw insertError;
      }

      // 3. Gérer les tables physiques si le nombre a changé
      await supabase.from('tournament_tables').delete().eq('tournament_id', tournament.id);
      const tableRows = Array.from({ length: newTournament.nb_tables }, (_, i) => ({
        tournament_id: tournament.id,
        table_number: i + 1
      }));
      const { error: tablesError } = await supabase.from('tournament_tables').insert(tableRows);
      if (tablesError) throw tablesError;

      toast.success('🎉 Tournoi et tableaux mis à jour avec succès !', { id: toastId });
      setShowCreateModal(false);
      setIsEditing(false);
      await refreshTournament();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la modification du tournoi', { id: toastId });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation des dates du tournoi
    if (new Date(newTournament.end_date) < new Date(newTournament.date)) {
      toast.error("La date de fin doit être égale ou postérieure à la date de début.");
      return;
    }

    // Validation du contenu
    if (categories.length === 0) {
      toast.error("Un tournoi doit posséder au moins un tableau (catégorie) pour être enregistré.");
      return;
    }

    // Validation des périodes d'inscription par journée
    const daysCountForVal = getTournamentDaysCount();
    for (let i = 1; i <= daysCountForVal; i++) {
      const period = newTournament.payment_methods.registration_periods?.[i.toString()];
      if (!period || !period.start || !period.end) {
        toast.error(`Veuillez configurer les dates d'ouverture et de clôture d'inscription pour la Journée ${i}.`);
        return;
      }
      if (new Date(period.end) < new Date(period.start)) {
        toast.error(`La clôture d'inscription de la Journée ${i} doit être après son ouverture.`);
        return;
      }
    }

    setCreating(true);
    const toastId = toast.loading('Création atomique du tournoi et des tableaux...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Vous devez être connecté pour créer un tournoi.');

      // 1. Sauvegarde du Tournoi
      const tournamentData: any = {
        name: newTournament.name.trim(),
        location: newTournament.location.trim() || null,
        description: newTournament.description.trim() || null,
        date: newTournament.date,
        end_date: newTournament.end_date,
        starts_at: null,
        nb_tables: Number(newTournament.nb_tables),
        sets_to_win: Number(newTournament.sets_to_win),
        points_per_set: Number(newTournament.points_per_set),
        max_categories_per_day: Number(newTournament.max_categories_per_day),
        players_per_pool: Number(newTournament.players_per_pool),
        score_mode: newTournament.mode,
        payment_methods: newTournament.payment_methods,
        status: 'draft',
        organizer_id: user.id
      };

      let tResult = await supabase
        .from('tournaments')
        .insert([tournamentData])
        .select()
        .single();

      // --- RETRY LOGIC FOR SCHEMA CACHE ERROR ---
      if (tResult.error && tResult.error.message && (tResult.error.message.includes('max_categories_per_day') || tResult.error.message.includes('players_per_pool'))) {
        console.warn("La colonne 'max_categories_per_day' ou 'players_per_pool' n'existe pas ou n'est pas encore dans le cache du schéma Supabase. Tentative de création sans ces colonnes...");
        toast.error("Données de configuration manquantes ou obsolètes dans la base. Création sans ces paramètres de filtrage...", { duration: 5000 });
        
        const { max_categories_per_day, players_per_pool, ...fallbackData } = tournamentData;
        tResult = await supabase
          .from('tournaments')
          .insert([fallbackData])
          .select()
          .single();
      }

      const { data: tData, error: tError } = tResult;
      if (tError) throw tError;

      // 2. Création des Tableaux (parallel insert)
      const categoriesData = categories.map(cat => ({
        tournament_id: tData.id,
        name: cat.name,
        min_points: Number(cat.min_points),
        max_points: Number(cat.max_points),
        price: Number(cat.price),
        capacity: Number(cat.capacity),
        start_time: cat.start_time || null,
        day_number: Number(cat.day_number),
        gender_restriction: cat.gender_restriction,
        age_categories: cat.age_categories.trim() || null,
        color_code: cat.color_code
      }));

      const { error: catError } = await supabase
        .from('table_categories')
        .insert(categoriesData);

      if (catError) throw catError;

      // 3. Créer les tables physiques
      const tableRows = Array.from({ length: newTournament.nb_tables }, (_, i) => ({
        tournament_id: tData.id,
        table_number: i + 1
      }));
      
      const { error: tablesError } = await supabase.from('tournament_tables').insert(tableRows);
      if (tablesError) throw tablesError;

      toast.success('🎉 Tournoi et tableaux créés avec succès !', { id: toastId });
      setShowCreateModal(false);
      await refreshTournament();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la création du tournoi', { id: toastId });
    } finally {
      setCreating(false);
    }
  };

  const renderModals = () => {
    return (
      <>
        {/* Create Tournament & Tableaux Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-5xl w-full shadow-2xl flex flex-col max-h-[92vh] border border-slate-100"
            >
              <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100 shrink-0">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {isEditing ? "Modification du Tournoi" : "Configuration du Nouveau Tournoi"}
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    {isEditing ? "Ajustez les informations générales de l'événement et vos tableaux sportifs" : "Saisie complète et configuration des séries sportives (Tableaux)"}
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setIsEditing(false);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={isEditing ? handleEditTournamentSubmit : handleCreateTournament} className="flex flex-col flex-1 min-h-0 space-y-6">
                
                {/* Corps défilant */}
                <div className="flex-1 overflow-y-auto pr-3 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
                  
                  {/* Section 1 : Informations Générales */}
                  <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-indigo-600 tracking-widest flex items-center gap-1.5 border-l-3 border-indigo-600 pl-2">
                    <Info className="w-3.5 h-3.5" /> Informations Générales
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Nom de l'événement</label>
                      <input 
                        required 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-semibold text-sm transition-all"
                        value={newTournament.name}
                        placeholder="Ex: Tournoi National de Printemps d'Amiens"
                        onChange={e => setNewTournament({...newTournament, name: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Date de début</label>
                      <input 
                        type="date"
                        required 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all font-semibold text-slate-800"
                        value={newTournament.date}
                        onChange={e => setNewTournament({...newTournament, date: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Date de fin</label>
                      <input 
                        type="date"
                        required 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all font-semibold text-slate-800"
                        value={newTournament.end_date}
                        onChange={e => setNewTournament({...newTournament, end_date: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Lieu / Gymnase</label>
                      <input 
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all font-semibold"
                        value={newTournament.location}
                        placeholder="Ex: Gymnase des Quatre chênes, Amiens"
                        onChange={e => setNewTournament({...newTournament, location: e.target.value})}
                      />
                    </div>

                    {/* Heure de début officiel supprimée, remplacée par les dates de début et fin d'inscription en ligne par jour */}
                    <div className="md:col-span-2 space-y-4 bg-slate-50/70 p-5 rounded-3xl border border-slate-150">
                      <h4 className="text-xs font-black uppercase text-indigo-700 tracking-widest flex items-center gap-1.5 pl-1">
                        <Calendar className="w-3.5 h-3.5" /> Périodes d'Inscription en ligne par Journée
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 pl-1">Configurez les plages d'ouvertures et de fermetures de l'inscription pour vos séries selon leur journée.</p>
                      
                      <div className="space-y-4 pt-1">
                        {Array.from({ length: getTournamentDaysCount() }, (_, i) => {
                          const dayNum = i + 1;
                          const period = newTournament.payment_methods.registration_periods?.[dayNum.toString()] || { start: '', end: '' };
                          return (
                            <div key={dayNum} className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 items-center shadow-sm">
                              <div className="md:col-span-2 flex items-center gap-2 border-b border-slate-100 pb-2">
                                <span className="inline-flex items-center justify-center w-5.5 h-5.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black">
                                  J{dayNum}
                                </span>
                                <span className="font-extrabold text-xs text-slate-800">
                                  Journée {dayNum} {getFormattedDayDate(newTournament.date, dayNum) ? `(${getFormattedDayDate(newTournament.date, dayNum)})` : ''}
                                </span>
                              </div>

                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Début de l'inscription</label>
                                <input 
                                  type="datetime-local"
                                  required
                                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold text-xs text-slate-800"
                                  value={period.start || ''}
                                  onChange={e => {
                                    const updatedPeriods = {
                                      ...(newTournament.payment_methods.registration_periods || {}),
                                      [dayNum.toString()]: {
                                        ...period,
                                        start: e.target.value
                                      }
                                    };
                                    setNewTournament({
                                      ...newTournament,
                                      payment_methods: {
                                        ...newTournament.payment_methods,
                                        registration_periods: updatedPeriods
                                      }
                                    });
                                  }}
                                />
                              </div>

                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Fin de l'inscription</label>
                                <input 
                                  type="datetime-local"
                                  required
                                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold text-xs text-slate-800"
                                  value={period.end || ''}
                                  onChange={e => {
                                    const updatedPeriods = {
                                      ...(newTournament.payment_methods.registration_periods || {}),
                                      [dayNum.toString()]: {
                                        ...period,
                                        end: e.target.value
                                      }
                                    };
                                    setNewTournament({
                                      ...newTournament,
                                      payment_methods: {
                                        ...newTournament.payment_methods,
                                        registration_periods: updatedPeriods
                                      }
                                    });
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Description / Règlement publique</label>
                      <textarea 
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all font-medium placeholder:text-slate-300"
                        value={newTournament.description}
                        placeholder="Règles générales, dotations globales, recommandations sanitaires..."
                        onChange={e => setNewTournament({...newTournament, description: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2 : Modes de Paiement Recommandés */}
                <div className="space-y-3 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                  <h3 className="text-xs font-black uppercase text-indigo-600 tracking-widest flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> Modes de Paiement acceptés
                  </h3>
                  <p className="text-xs text-slate-400">Cochez les solutions que les compétiteurs pourront employer (affiché lors des inscriptions).</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                    <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-150 cursor-pointer hover:bg-indigo-50/20 hover:border-indigo-200 transition-all select-none">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        checked={newTournament.payment_methods.cb}
                        onChange={e => setNewTournament({
                          ...newTournament,
                          payment_methods: { ...newTournament.payment_methods, cb: e.target.checked }
                        })}
                      />
                      <span className="text-xs font-bold text-slate-700">💳 CB</span>
                    </label>

                    <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-150 cursor-pointer hover:bg-indigo-50/20 hover:border-indigo-200 transition-all select-none">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        checked={newTournament.payment_methods.cash}
                        onChange={e => setNewTournament({
                          ...newTournament,
                          payment_methods: { ...newTournament.payment_methods, cash: e.target.checked }
                        })}
                      />
                      <span className="text-xs font-bold text-slate-700">💵 Espèces</span>
                    </label>

                    <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-150 cursor-pointer hover:bg-indigo-50/20 hover:border-indigo-200 transition-all select-none">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        checked={newTournament.payment_methods.check}
                        onChange={e => setNewTournament({
                          ...newTournament,
                          payment_methods: { ...newTournament.payment_methods, check: e.target.checked }
                        })}
                      />
                      <span className="text-xs font-bold text-slate-700">✍️ Chèque</span>
                    </label>

                    <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-150 cursor-pointer hover:bg-indigo-50/20 hover:border-indigo-200 transition-all select-none">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        checked={newTournament.payment_methods.transfer}
                        onChange={e => setNewTournament({
                          ...newTournament,
                          payment_methods: { ...newTournament.payment_methods, transfer: e.target.checked }
                        })}
                      />
                      <span className="text-xs font-bold text-slate-700">🏦 Virement</span>
                    </label>

                    <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-150 cursor-pointer hover:bg-indigo-50/20 hover:border-indigo-200 transition-all select-none">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        checked={newTournament.payment_methods.onSite}
                        onChange={e => setNewTournament({
                          ...newTournament,
                          payment_methods: { ...newTournament.payment_methods, onSite: e.target.checked }
                        })}
                      />
                      <span className="text-xs font-bold text-slate-700">🤝 Sur Place</span>
                    </label>
                  </div>
                </div>

                {/* Section 3 : Configuration du Juge Arbitre & Infrastructure */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-indigo-600 tracking-widest flex items-center gap-1.5 border-l-3 border-indigo-600 pl-2">
                    🏓 Paramètres Sportifs & Arbitrage
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Tables physiques</label>
                      <input 
                        type="number"
                        required 
                        min="1"
                        max="64"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-semibold text-sm"
                        value={isNaN(newTournament.nb_tables) ? '' : newTournament.nb_tables}
                        onChange={e => setNewTournament({...newTournament, nb_tables: parseInt(e.target.value) || 0})}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Sets gagnants</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-semibold text-sm text-slate-700"
                        value={newTournament.sets_to_win}
                        onChange={e => setNewTournament({...newTournament, sets_to_win: parseInt(e.target.value) || 2})}
                      >
                        <option value={2}>2 (Best of 3)</option>
                        <option value={3}>3 (Best of 5)</option>
                        <option value={4}>4 (Best of 7)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Points par set</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-semibold text-sm text-slate-700"
                        value={newTournament.points_per_set}
                        onChange={e => setNewTournament({...newTournament, points_per_set: parseInt(e.target.value) || 11})}
                      >
                        <option value={11}>11 points (ITTF)</option>
                        <option value={21}>21 points (Historique)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Saisie des scores</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-semibold text-sm text-slate-700"
                        value={newTournament.mode}
                        onChange={e => setNewTournament({...newTournament, mode: e.target.value as any})}
                      >
                        <option value="players">Par les joueurs (QR Code)</option>
                        <option value="referee">Par la table d'orga (JA)</option>
                      </select>
                    </div>

                    <div>
                      <label id="label-max-categories-per-day" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Tableau / jour Max</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-semibold text-sm text-slate-700 font-extrabold"
                        value={newTournament.max_categories_per_day}
                        onChange={e => setNewTournament({...newTournament, max_categories_per_day: parseInt(e.target.value) || 1})}
                      >
                        <option value={1}>1 tableau max / joueur</option>
                        <option value={2}>2 tableaux max / joueur</option>
                        <option value={3}>3 tableaux max / joueur</option>
                        <option value={4}>4 tableaux max / joueur</option>
                        <option value={100}>Illimité 👥</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Joueurs par poule</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-semibold text-sm text-slate-700 font-extrabold text-indigo-600"
                        value={newTournament.players_per_pool || 3}
                        onChange={e => setNewTournament({...newTournament, players_per_pool: parseInt(e.target.value) || 3})}
                      >
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 4 : Gestion des Tableaux (Dynamic List Builders) */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xs font-black uppercase text-indigo-600 tracking-widest flex items-center gap-1.5 border-l-3 border-indigo-600 pl-2">
                        🏆 Tableaux de Compétition ({categories.length})
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Ajoutez d'anciens tableaux pour diviser les compétiteurs par classements, âge ou genre.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const days = getTournamentDaysCount();
                        setEditingCategoryIndex(null);
                        setNewCategory({
                          name: `Série ${String.fromCharCode(65 + categories.length)}`,
                          min_points: 500,
                          max_points: 1500,
                          price: 8,
                          capacity: 48,
                          start_time: '10:00',
                          day_number: 1,
                          gender_restriction: 'ALL',
                          age_categories: 'Toutes catégories',
                          color_code: '#4f46e5'
                        });
                        setShowAddCategoryModal(true);
                      }}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-extrabold rounded-xl border border-indigo-100 transition-all flex items-center gap-1 active:scale-95"
                    >
                      <Plus className="w-4 h-4" /> Ajouter un Tableau
                    </button>
                  </div>

                  {categories.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                      Aucun tableau configuré. Un tournoi doit posséder au moins un tableau pour être sauvegardé valide.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {categories.map((cat, idx) => (
                        <div 
                          key={idx}
                          className="p-4 bg-white border border-slate-150 rounded-2xl shadow-sm flex items-start justify-between group transition-shadow hover:shadow-md"
                        >
                          <div className="flex gap-3">
                            <span 
                              className="w-4 h-4 rounded-full shrink-0 mt-1 shadow-inner border border-black/10" 
                              style={{ backgroundColor: cat.color_code }} 
                            />
                            <div>
                              <p className="font-extrabold text-sm text-slate-900 leading-tight">{cat.name}</p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[10px] text-slate-500 font-bold">
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded leading-none">
                                  📊 {cat.min_points} - {cat.max_points} pts
                                </span>
                                <span className="text-slate-300">•</span>
                                <span>🕒 {cat.start_time}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-indigo-600 font-black">📆 Jour {cat.day_number}</span>
                                <span className="text-slate-300">•</span>
                                <span className="uppercase text-amber-700">👤 {cat.gender_restriction}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-emerald-700">💰 {cat.price} €</span>
                                <span className="text-slate-300">•</span>
                                <span>👥 Max {cat.capacity}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1.5 shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryIndex(idx);
                                setNewCategory(cat);
                                setShowAddCategoryModal(true);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Modifier ce tableau"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCategories(categories.filter((_, i) => i !== idx))}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                              title="Supprimer ce tableau"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                </div> {/* Fin du corps défilant */}

                {/* Submit Controls */}
                <div className="pt-6 flex gap-3 border-t border-slate-100 mt-auto shrink-0">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setIsEditing(false);
                    }}
                    className="flex-1 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all text-sm active:scale-95"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-100 disabled:opacity-50 transition-all text-sm active:scale-95"
                  >
                    {creating ? 'Enregistrement...' : isEditing ? 'Enregistrer les Modifications 🏓' : 'Créer le Tournoi & Séries 🏓'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Nested Add Tableau / Category Modal */}
        {showAddCategoryModal && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[2rem] p-7 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-black text-lg text-slate-900 tracking-tight">
                    {editingCategoryIndex !== null ? "Modifier le Tableau" : "Ajouter un Tableau (Série)"}
                  </h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">Configurez les contraintes sportives de la série</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddCategorySubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 pl-1">Nom de la série</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold text-xs"
                    placeholder="Ex: Tableau B - Moins de 1200 pts"
                    value={newCategory.name}
                    onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 pl-1">Points Min (Classement)</label>
                    <input
                      required
                      type="number"
                      min="500"
                      max="3500"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold text-xs"
                      value={newCategory.min_points}
                      onChange={e => setNewCategory({ ...newCategory, min_points: parseInt(e.target.value) || 500 })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 pl-1">Points Max (Classement)</label>
                    <input
                      required
                      type="number"
                      min="500"
                      max="3500"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold text-xs"
                      value={newCategory.max_points}
                      onChange={e => setNewCategory({ ...newCategory, max_points: parseInt(e.target.value) || 3000 })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 pl-1">Tarif inscription (€)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.5"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold text-xs"
                      value={newCategory.price}
                      onChange={e => setNewCategory({ ...newCategory, price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 pl-1">Capacité Max (Joueurs)</label>
                    <input
                      required
                      type="number"
                      min="2"
                      max="512"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold text-xs"
                      value={newCategory.capacity}
                      onChange={e => setNewCategory({ ...newCategory, capacity: parseInt(e.target.value) || 32 })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 pl-1">Heure de début</label>
                    <input
                      required
                      type="time"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold text-xs"
                      value={newCategory.start_time}
                      onChange={e => setNewCategory({ ...newCategory, start_time: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 pl-1">Jour du tournoi</label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold text-xs"
                      value={newCategory.day_number}
                      onChange={e => setNewCategory({ ...newCategory, day_number: parseInt(e.target.value) || 1 })}
                    >
                      {Array.from({ length: getTournamentDaysCount() }, (_, i) => (
                        <option key={i + 1} value={i + 1}>Jour {i + 1}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 pl-1">Restrictions Genre</label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold text-xs"
                      value={newCategory.gender_restriction}
                      onChange={e => setNewCategory({ ...newCategory, gender_restriction: e.target.value as any })}
                    >
                      <option value="ALL">Mixte (Hommes / Femmes)</option>
                      <option value="M">Messieurs (Hommes uniquement)</option>
                      <option value="F">Dames (Femmes uniquement)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Catégories d’Âge éligibles</label>
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-2.5 max-w-[280px]">
                      <button
                        type="button"
                        onClick={() => setNewCategory({ ...newCategory, age_categories: 'Toutes catégories' })}
                        className={`flex-1 py-1.5 text-[9px] font-extrabold rounded-lg transition-all ${
                          (!newCategory.age_categories || newCategory.age_categories === 'Toutes catégories' || newCategory.age_categories.toLowerCase() === 'toutes')
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Toutes catégories
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCategory({ ...newCategory, age_categories: 'S, V' });
                        }}
                        className={`flex-1 py-1.5 text-[9px] font-extrabold rounded-lg transition-all ${
                          (newCategory.age_categories && newCategory.age_categories !== 'Toutes catégories' && newCategory.age_categories.toLowerCase() !== 'toutes')
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Sélection personnalisée
                      </button>
                    </div>

                    {newCategory.age_categories && 
                     newCategory.age_categories !== 'Toutes catégories' && 
                     newCategory.age_categories.toLowerCase() !== 'toutes' && (
                      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                        {AGE_OPTIONS.map(opt => {
                          const activeCodes = newCategory.age_categories
                            .split(',')
                            .map(c => c.trim().toUpperCase())
                            .filter(Boolean);
                          const isActive = activeCodes.includes(opt.value);

                          const handleToggle = () => {
                            let nextCodes;
                            if (isActive) {
                              nextCodes = activeCodes.filter(c => c !== opt.value);
                            } else {
                              nextCodes = [...activeCodes, opt.value];
                            }
                            
                            if (nextCodes.length === 0) {
                              setNewCategory({ ...newCategory, age_categories: 'Toutes catégories' });
                            } else {
                              setNewCategory({ ...newCategory, age_categories: nextCodes.join(', ') });
                            }
                          };

                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={handleToggle}
                              className={`p-1.5 text-center rounded-lg border text-[10px] font-bold transition-all transition-transform duration-100 flex flex-col items-center justify-center gap-0.5 ${
                                isActive 
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm scale-[1.03]' 
                                  : 'bg-white border-slate-150 text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                              }`}
                            >
                              <span className="font-extrabold text-[9px] text-slate-400 uppercase tracking-wider">{opt.value}</span>
                              <span className="truncate max-w-full">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 pl-1">Code couleur visuel (HEX)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      className="w-10 h-10 p-1 border border-slate-200 rounded-xl cursor-pointer"
                      value={newCategory.color_code}
                      onChange={e => setNewCategory({ ...newCategory, color_code: e.target.value })}
                    />
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold text-xs"
                      value={newCategory.color_code}
                      onChange={e => setNewCategory({ ...newCategory, color_code: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-2 border-t border-slate-100 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all"
                  >
                    {editingCategoryIndex !== null ? "Sauvegarder les modifications 🎯" : "Ajouter au Panier 🎯"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal Réouvrir le Tournoi */}
        {showReopenConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-[#0f1f3d]/60 backdrop-blur-sm"
              onClick={() => setShowReopenConfirm(false)}
            />

            {/* Dialog Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white dark:bg-[#0a1729] rounded-[2rem] p-6 md:p-8 max-w-md w-full border border-slate-200 dark:border-white/10 shadow-2xl relative z-10"
            >
              <div className="h-12 w-12 bg-[#f97316]/10 rounded-2xl flex items-center justify-center text-[#f97316] mb-5">
                <Trophy className="w-6 h-6 animate-pulse" />
              </div>
              
              <h3 className="font-display text-xl md:text-2xl font-bold tracking-tight text-[#0f1f3d] dark:text-white mb-2">
                Réouvrir le Tournoi ?
              </h3>
              
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                Le tournoi va être réouvert et son statut passera à <strong>En cours</strong>. Vous pourrez à nouveau modifier les scores, gérer les tables, et valider les matchs de toutes les journées.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowReopenConfirm(false)}
                  className="w-1/2 h-12 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-sm"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleReopenTournamentConfirmed}
                  className="w-1/2 h-12 px-4 rounded-xl bg-[#f97316] hover:bg-[#ea6a0a] text-white font-bold transition-all shadow-md text-sm active:scale-95"
                >
                  Réouvrir
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal Archiver le Tournoi */}
        {showArchiveConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-[#0f1f3d]/60 backdrop-blur-sm"
              onClick={() => setShowArchiveConfirm(false)}
            />

            {/* Dialog Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white dark:bg-[#0a1729] rounded-[2rem] p-6 md:p-8 max-w-md w-full border border-slate-200 dark:border-white/10 shadow-2xl relative z-10"
            >
              <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-5">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <h3 className="font-display text-xl md:text-2xl font-bold tracking-tight text-[#0f1f3d] dark:text-white mb-2">
                Archiver ce Tournoi ?
              </h3>

              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                Voulez-vous vraiment archiver ce tournoi ? Cela effacera les sessions d’arbitrage actives mais conservera les podiums et le bilan historique dans vos archives.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(false)}
                  className="w-1/2 h-12 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-sm"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleArchiveConfirmed}
                  className="w-1/2 h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md text-sm active:scale-95"
                >
                  Archiver
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </>
    );
  };

  if (loading) return <div className="p-8 text-slate-400">Chargement...</div>;

  if (!tournament || tournament.status === 'archived') {
    return (
      <>
        <div className="p-8 max-w-4xl mx-auto mt-12">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-indigo-100 shadow-xl shadow-indigo-100/50">
              <Trophy className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black text-slate-950 tracking-tight">
              {tournament?.status === 'archived' ? 'Précédent Tournoi Archivé !' : 'Bienvenue sur Ping Manager'}
            </h1>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
              {tournament?.status === 'archived' 
                ? `Le tournoi "${tournament.name}" a été archivé avec succès. Vous pouvez maintenant lancer un nouvel événement avec sa configuration dynamique par tableaux.`
                : "Vous n'avez pas encore de tournoi actif. Créez votre événement, définissez vos tableaux de niveau (Séries) et attribuez vos tables physiques pour commencer."}
            </p>
            <div className="mt-8 flex justify-center">
              <button 
                onClick={() => {
                  setCategories([
                    {
                      name: 'Tableau A - Elite',
                      min_points: 500,
                      max_points: 3000,
                      price: 10,
                      capacity: 32,
                      start_time: '09:00',
                      day_number: 1,
                      gender_restriction: 'ALL',
                      age_categories: 'Seniors',
                      color_code: '#4f46e5'
                    }
                  ]);
                  setShowCreateModal(true);
                }}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-100 hover:shadow-indigo-200 transition-all flex items-center gap-2.5 active:scale-95"
              >
                <Trophy className="w-5 h-5" />
                Lancer un nouveau tournoi
              </button>
            </div>
          </div>
        </div>
        {renderModals()}
      </>
    );
  }

  return (
    <div className="min-h-full bg-[#081425] text-[#d8e3fb] p-4 md:p-6 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-350 select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#1a3056] gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] text-[10px] md:text-xs font-bold mb-2.5 uppercase tracking-wider border border-[#f97316]/20">
            <Trophy className="w-3.5 h-3.5" />
            <span>Console Organisateur</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Tableau de bord
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1.5 max-w-2xl">
            Supervisez le bon déroulement des séries, suivez l'avancement global de la journée en temps réel et gérez d'un coup d'œil les tables de jeu en salle.
          </p>
        </div>

        <div className="flex gap-4 items-center flex-wrap">
          <div className="bg-[#152031] p-4 rounded-xl border border-[#2a3548] flex items-center gap-4 min-w-[200px] select-none hover:border-[#10B981]/50 transition-all shadow-md">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle className="text-slate-800" cx="24" cy="24" fill="transparent" r="20" stroke="currentColor" strokeWidth="4"></circle>
                <circle 
                  className="text-emerald-500" 
                  cx="24" 
                  cy="24" 
                  fill="transparent" 
                  r="20" 
                  stroke="currentColor" 
                  strokeDasharray="125.6" 
                  strokeDashoffset={125.6 - (125.6 * (stats.matchesTotal > 0 ? Math.min(stats.matchesDone / stats.matchesTotal, 1) : 0))} 
                  strokeWidth="4"
                  strokeLinecap="round"
                ></circle>
              </svg>
              <span className="absolute text-[10px] font-mono font-black text-emerald-400">
                {stats.matchesTotal > 0 ? Math.round((stats.matchesDone / stats.matchesTotal) * 100) : 0}%
              </span>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Progression</p>
              <p className="text-sm font-bold text-slate-200">
                {stats.matchesDone} / {stats.matchesTotal} terminés
              </p>
            </div>
          </div>

          <button 
            onClick={async () => {
              const confirmText = "⚠️ Voulez-vous archiver ou réinitialiser de force ce tournoi ?\n\nCela vous permettra de commencer un tout nouveau tournoi immédiatement, même si celui-ci n'a pas été entièrement joué ou s'il y a 0 donnée.";
              if (window.confirm(confirmText)) {
                setArchiving(true);
                const toastId = toast.loading('Archivage en cours...');
                try {
                  await archiveTournament(tournament.id);
                  toast.success('🎉 Tournoi archivé de force avec succès !', { id: toastId });
                  refreshTournament();
                } catch (err: any) {
                  console.error(err);
                  if (window.confirm("L'archivage a échoué (les données sont vides ou incohérentes). Souhaitez-vous SUPPRIMER définitivement ce tournoi pour débloquer la création ?")) {
                    const { error: delError } = await supabase.from('tournaments').delete().eq('id', tournament.id);
                    if (delError) throw delError;
                    toast.success('Tournoi supprimé avec succès !', { id: toastId });
                    refreshTournament();
                  } else {
                    toast.error(err.message || "Erreur lors de l'archivage", { id: toastId });
                  }
                } finally {
                  setArchiving(false);
                }
              }
            }}
            disabled={archiving}
            className="p-4 bg-[#f97316]/10 hover:bg-[#f97316]/20 border border-red-200/10 rounded-xl flex items-center gap-3.5 transition-all active:scale-[0.98] disabled:opacity-50 text-left cursor-pointer min-w-[200px]"
            title="Archiver ou supprimer d'urgence"
          >
            <div className="w-10 h-10 bg-red-955 bg-rose-955 bg-rose-500/10 text-[#ef4444] rounded-lg flex items-center justify-center border border-red-555 border-red-500/20">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-red-555 text-rose-400 tracking-wider">Zone d'Urgence</p>
              <p className="text-sm font-black text-rose-300">Archiver / Réinitialiser</p>
            </div>
          </button>
        </div>
      </div>

      {/* 1. Bandeau Mode Brouillon (draft) */}
      {tournament?.status === 'draft' && (
        <div className="p-5 bg-[#152031] border border-[#2a3548] rounded-2xl text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-amber-500" />
          <div className="relative z-10 w-full">
            <h3 className="font-bold text-lg text-amber-500 flex items-center gap-2">
              <span>⚡ Mode Brouillon Actif</span>
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              Votre tournoi est en préparation. Ajoutez ou modifiez vos Tableaux de niveau, ou publiez-le maintenant pour l'ouvrir aux inscriptions.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 relative z-10 shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
            <button
              onClick={openEditTournamentModal}
              className="h-12 px-6 bg-[#1f2a3c] hover:bg-[#2a3548] text-slate-100 border border-[#2a3548] font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              Modifier la configuration & Séries
            </button>
            <button
              onClick={handleOpenRegistrations}
              className="h-12 px-6 bg-[#f97316] hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              Ouvrir les inscriptions
            </button>
          </div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#f97316]/5 rounded-full blur-2xl pointer-events-none" />
        </div>
      )}

      {/* 2. Bandeau Inscriptions Ouvertes (open / registration) */}
      {['open', 'registration'].includes(tournament?.status || '') && (
        <div className="p-5 bg-[#152031] border border-[#2a3548] rounded-2xl text-[#d8e3fb] flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-blue-500" />
          <div className="relative z-10">
            <h3 className="font-bold text-lg text-blue-400 flex items-center gap-2">
              <span>🚀 Période d'inscriptions publiques</span>
            </h3>
            <p className="text-slate-300 text-sm mt-1">
              Les joueurs peuvent s'inscrire au tournoi. {timeLeft ? `Début officiel du tournoi dans : ${timeLeft}` : ''}
            </p>
          </div>
          <div className="flex gap-3 shrink-0 flex-wrap z-10 w-full sm:w-auto">
            <button
              onClick={openEditTournamentModal}
              className="h-12 px-5 bg-[#1f2a3c] hover:bg-[#2a3548] text-slate-200 border border-[#2a3548] font-bold rounded-xl shadow-sm transition-all text-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              ⚙️ Modifier Configuration / Tableaux
            </button>
            <button
              onClick={() => navigate('/organizer/players')}
              className="h-12 px-6 bg-[#f97316] hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center cursor-pointer"
            >
              Gérer les Joueurs / Pointage
            </button>
          </div>
        </div>
      )}

      {/* Contrôle de la Journée Active */}
      {tournament && !['draft', 'closed', 'finished', 'archived'].includes(tournament.status) && (
        <div className="bg-[#152031] p-5 rounded-2xl border border-[#2a3548] shadow-sm relative overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#f97316]" />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pl-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] animate-pulse" />
                <h3 className="font-extrabold text-base text-white">
                  Gestion du Jour Actif : <span className="text-[#f97316]">Journée {currentDay}</span>
                </h3>
              </div>
              <p className="text-slate-400 text-xs mt-1.5 max-w-xl leading-relaxed">
                La gestion des poules, tableaux et scores se fait par journée. Vous gérez actuellement les tableaux du Jour {currentDay} ({categoriesToday.length} tableaux programmés).
              </p>
              
              <div className="flex flex-wrap gap-2.5 mt-3.5">
                <div className="bg-[#0f1f3d] px-3 py-1.5 rounded-xl border border-[#1a3056] text-[10px] font-bold text-[#d8e3fb]">
                  📁 Tableaux : <span className="text-[#f97316] font-extrabold">{categoriesToday.map(c => c.name).join(', ') || 'Aucun'}</span>
                </div>
                {totalMatchesToday > 0 && (
                  <div className="bg-[#10B981]/10 px-3 py-1.5 rounded-xl border border-[#10B981]/25 text-[10px] font-bold text-emerald-400">
                    🏓 Matchs : <span className="text-emerald-300 font-extrabold">{finishedMatchesToday} / {totalMatchesToday} terminés</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2.5 shrink-0 self-stretch md:self-auto flex-wrap">
              {currentDay > 1 && (
                <button
                  onClick={() => handleSetDay(currentDay - 1)}
                  className="px-4 py-2 bg-[#1f2a3c] hover:bg-[#2a3548] text-slate-100 border border-[#2a3548] rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                >
                  ◀ Jour {currentDay - 1}
                </button>
              )}
              
              {(() => {
                const totalDays = getLoadedTournamentDaysCount();
                const isLastDay = currentDay >= totalDays;

                if (isLastDay) {
                  if (isDayFinished) {
                    return (
                      <button
                        onClick={() => navigate('/organizer/bracket')}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center gap-1.5 active:scale-95 cursor-pointer font-sans"
                      >
                        🏆 Clôturer le Tournoi (Dernier Jour) ▶
                      </button>
                    );
                  } else if (totalMatchesToday > 0) {
                    return (
                      <button
                        disabled
                        className="px-4 py-2 bg-[#1f2a3c] text-slate-500 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-not-allowed border border-[#2a3548]"
                        title="Tous les matchs de cette dernière journée doivent se terminer en phase finale pour pouvoir procéder à la clôture finale."
                      >
                        🔒 Dernier Jour {currentDay} ({finishedMatchesToday}/{totalMatchesToday} terminés)
                      </button>
                    );
                  } else if (categoriesToday.length > 0) {
                    return (
                      <button
                        onClick={() => navigate('/organizer/bracket')}
                        className="px-4 py-2 bg-[#f97316] hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 shadow-md shadow-orange-500/20 cursor-pointer"
                      >
                        Gérer le Tableau Final ▶
                      </button>
                    );
                  } else {
                    return (
                      <button
                        onClick={() => navigate('/organizer/bracket')}
                        className="px-4 py-2 bg-[#f97316] hover:bg-[#ff6b00] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 shadow-md shadow-orange-500/20 cursor-pointer"
                      >
                        Phase Finale ▶
                      </button>
                    );
                  }
                } else {
                  if (isDayFinished) {
                    return (
                      <button
                        onClick={handleNextDay}
                        className="px-4 py-2 bg-[#10B981] hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1 active:scale-95 cursor-pointer"
                      >
                        Clôturer le Jour {currentDay} & Passer au Suivant ▶
                      </button>
                    );
                  } else if (totalMatchesToday > 0) {
                    return (
                      <button
                        disabled
                        className="px-4 py-2 bg-[#1f2a3c] text-slate-500 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-not-allowed border border-[#2a3548]"
                        title="Tous les matchs du jour en cours doivent être terminés"
                      >
                        🔒 Jour {currentDay} ({finishedMatchesToday}/{totalMatchesToday} terminés)
                      </button>
                    );
                  } else if (categoriesToday.length > 0) {
                    return (
                      <button
                        onClick={handleNextDay}
                        className="px-4 py-2 bg-[#f97316] hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                      >
                        Clôturer la journée {currentDay} ▶
                      </button>
                    );
                  } else {
                    return (
                      <button
                        onClick={handleNextDay}
                        className="px-4 py-2 bg-[#1f2a3c] hover:bg-[#2a3548] text-slate-200 border border-[#2a3548] rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                      >
                        Passer au Jour {currentDay + 1} ▶
                      </button>
                    );
                  }
                }
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 3. Bandeau Tournoi Terminé / Clôturé, en attente d'archivage (closed / finished) */}
      {['closed', 'finished'].includes(tournament?.status || '') && (
        <div className="p-5 bg-[#152031] border border-emerald-500/20 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-emerald-500" />
          <div className="relative z-10">
            <h3 className="font-bold text-lg text-emerald-400 flex items-center gap-2">
              <span>🥇 Tournoi Terminé !</span>
            </h3>
            <p className="text-slate-300 text-sm mt-1">
              Tous les matchs ont été clôturés. L'archivage du tournoi enregistrera officiellement le bilan de l'événement. Vous pouvez également le réouvrir si besoin de saisir un score manquant.
            </p>
          </div>
          <div className="flex gap-3 shrink-0 self-stretch md:self-auto justify-end z-10">
            <button
              onClick={handleReopenTournament}
              className="h-12 px-5 bg-[#1f2a3c] hover:bg-[#2a3548] text-slate-100 border border-[#2a3548] font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              🔄 Réouvrir le Tournoi
            </button>
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {archiving ? 'Archivage...' : 'Archiver ce tournoi'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-[#152031] p-5 rounded-2xl shadow-sm border border-[#2a3548] relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity text-white">
            <Users className="w-16 h-16" />
          </div>
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Joueurs inscrits</h3>
          <p className="text-4xl font-extrabold text-white mt-3 tracking-tighter">{stats.players}</p>
          <div className="h-1.5 w-12 bg-orange-500 rounded-full mt-4" />
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-[#152031] p-5 rounded-2xl shadow-sm border border-[#2a3548] relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity text-white">
            <Play className="w-16 h-16" />
          </div>
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Matchs terminés</h3>
          <p className="text-4xl font-extrabold text-white mt-3 tracking-tighter">
            {stats.matchesDone} <span className="text-xl text-slate-500 italic">/ {stats.matchesTotal}</span>
          </p>
          <div className="h-1.5 w-12 bg-emerald-500 rounded-full mt-4" />
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-[#152031] p-5 rounded-2xl shadow-sm border border-[#2a3548] relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity text-white">
            <Trophy className="w-16 h-16" />
          </div>
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Tables en salle</h3>
          <p className="text-4xl font-extrabold text-white mt-3 tracking-tighter">{tournament?.nb_tables || 0}</p>
          <div className="h-1.5 w-12 bg-blue-500 rounded-full mt-4" />
        </motion.div>
      </div>

      {/* Tableaux de Compétition Actifs */}
      {activeCategories.length > 0 && (
        <div className="mb-5 bg-[#152031] p-5 rounded-2xl border border-[#2a3548] shadow-sm" id="active-tournament-categories">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2 mb-1.5">
            <Trophy className="w-5 h-5 text-[#f97316]" />
            Tableaux de Compétition Actifs
          </h2>
          <p className="text-slate-400 text-xs mb-6 font-medium">Liste des catégories sportives configurées pour cet événement avec leur jauge d'inscription.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeCategories.map(cat => (
              <div key={cat.id} className="p-5 bg-[#1f2a3c]/60 border border-[#2a3548] rounded-2xl flex flex-col justify-between hover:border-slate-500 transition-all">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span 
                      className="px-2.5 py-1 text-[10px] font-black uppercase text-white rounded-md tracking-wider shrink-0" 
                      style={{ backgroundColor: cat.color_code }}
                    >
                      {cat.name}
                    </span>
                    <span className="text-xs font-bold text-[#f97316] bg-orange-950/30 px-2.5 py-0.5 rounded-full border border-orange-500/20">
                      Jour {cat.day_number}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-slate-300 space-y-2 mt-3.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Points requis :</span>
                      <span>📊 {cat.min_points} - {cat.max_points} pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Heure de début :</span>
                      <span>🕒 {cat.start_time || '—'}</span>
                    </div>
                    {cat.gender_restriction !== 'ALL' && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Catégorie :</span>
                        <span className="uppercase text-amber-400 font-extrabold">{cat.gender_restriction === 'M' ? 'Messieurs' : 'Dames'}</span>
                      </div>
                    )}
                    {cat.age_categories && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Âges admis :</span>
                        <span className="font-extrabold text-[#d8e3fb] bg-[#0f1f3d] px-2.5 py-0.5 rounded-full border border-[#1a3056] uppercase text-[9px] tracking-wider shrink-0">
                          {formatAgeCategories(cat.age_categories)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#2a3548] flex justify-between items-center">
                  <span className="text-xs font-black text-[#f97316]">
                    💰 {cat.price} €
                  </span>
                  <span className="text-[10px] font-bold text-slate-350 bg-[#0f1f3d] px-2 py-0.5 rounded border border-[#1a3056]">
                    👥 Joueurs: max {cat.capacity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!['draft', 'open', 'registration'].includes(tournament?.status || '') && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold flex items-center gap-3 text-white">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              Direct Tables
            </h2>
            <button 
              onClick={() => navigate('/organizer/scores')}
              className="text-indigo-600 text-sm font-bold hover:underline"
            >
              Voir tout →
            </button>
          </div>
          <LiveMatchesPreview tournamentId={tournament.id} />
        </div>
      )}

      {/* Écran de Salle / TV */}
      {tournament && (
        <div className="mb-5 bg-[#152031] p-5 rounded-2xl border border-[#2a3548] shadow-sm animate-fade-in" id="tv-board-section">
          <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between">
            <div className="flex-1 space-y-4">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2 mb-1">
                <Tv className="w-5 h-5 text-[#f97316] animate-pulse" />
                Écran de Salle & Appels (TV)
              </h2>
              <p className="text-slate-400 text-xs font-semibold max-w-xl leading-relaxed">
                Affichez en direct l'état de toutes les tables de jeu, les appels de joueurs et les phases finales sur un grand écran ou une TV dans le gymnase. Cet écran se met à jour en temps réel automatiquement.
              </p>
              
              <div className="bg-[#0f1f3d] p-4 rounded-2xl border border-[#1a3056] flex items-start gap-3">
                <span className="text-lg">💡</span>
                <p className="text-slate-300 text-xs font-semibold leading-relaxed">
                  <strong>Aide HDMI :</strong> Branchez la TV ou le projecteur en HDMI au laptop de l'organisateur, configurez l'affichage en mode <strong>"Étendre" (Win+P)</strong>, puis cliquez sur le bouton ci-dessous pour ouvrir l'écran de salle de façon intelligente.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  type="button"
                  onClick={ouvrirSurTV}
                  className="px-5 py-3 bg-[#f97316] hover:bg-orange-600 text-white font-extrabold rounded-xl transition-all shadow-md shadow-orange-500/20 text-xs uppercase tracking-wider active:scale-98 flex items-center gap-2 cursor-pointer"
                >
                  <Tv className="w-4 h-4" />
                  Afficher sur la TV (2e Écran)
                </button>
                <a
                  href="/board"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 bg-[#1f2a3c] hover:bg-[#2a3548] text-slate-100 font-bold rounded-xl transition-all border border-[#2a3548] text-center flex items-center justify-center text-xs"
                >
                  Ouvrir l'adresse publique
                </a>
              </div>
            </div>

            <div className="shrink-0 p-4 bg-[#1f2a3c] border border-[#2a3548] rounded-3xl flex flex-col items-center gap-2 text-center shadow-xs">
              <div className="p-2.5 bg-white rounded-2xl">
                <QRCodeSVG value={window.location.origin + '/board'} size={110} />
              </div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Scanner pour Box/TV 📱
              </span>
            </div>
          </div>
        </div>
      )}

      {renderModals()}
    </div>
  );
}
