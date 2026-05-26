import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { resendPlayerLink } from '../../services/playerAuth';
import { Mail, Search, Award, CheckCircle2, ChevronRight, Sparkles, LogIn, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PlayerLogin() {
  const [email, setEmail] = useState('');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from('tournaments')
      .select('id, name, date')
      .order('date', { ascending: false })
      .then(({ data }) => {
        setTournaments(data || []);
        if (data && data.length > 0) {
          setSelectedTournamentId(data[0].id);
        }
        setLoadingTournaments(false);
      });
  }, []);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !selectedTournamentId) {
      toast.error('Veuillez remplir votre email et sélectionner un tournoi.');
      return;
    }

    setSubmitting(true);
    setMagicLink(null);
    try {
      const res = await resendPlayerLink(email.trim(), selectedTournamentId);
      toast.success('Lien magique généré ! Appliqué ci-dessous pour simulation.');
      setMagicLink(res.magicLink);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la génération du lien.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1f3d] text-white flex flex-col justify-between p-4 selection:bg-orange-500 selection:text-white">
      {/* Header */}
      <header className="max-w-md w-full mx-auto pt-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-black italic text-sm text-white">
            🏓
          </div>
          <span className="font-extrabold text-[#E2E8F0]">Portail Joueur</span>
        </div>
        <button
          onClick={() => navigate('/')}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour
        </button>
      </header>

      {/* Card body */}
      <main className="max-w-md w-full mx-auto my-auto py-12">
        <div className="bg-slate-800/60 border border-slate-700 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden backdrop-blur-md">
          {/* Decorative halo */}
          <div className="absolute -right-16 -top-16 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black">Mon Espace Personnel</h1>
              <p className="text-slate-400 text-xs mt-0.5">Entrez vos accès pour suivre vos matchs</p>
            </div>
          </div>

          <form onSubmit={handleSendLink} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Sélectionner un tournoi
              </label>
              {loadingTournaments ? (
                <div className="w-full h-11 bg-slate-900/50 rounded-xl border border-slate-700 animate-pulse" />
              ) : (
                <select
                  value={selectedTournamentId}
                  onChange={(e) => setSelectedTournamentId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 hover:bg-slate-900/80 text-[#E2E8F0] border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/35 transition-all font-semibold text-sm"
                >
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Adresse Email d’inscription
              </label>
              <input
                type="email"
                required
                placeholder="Ex: joueur@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-xl outline-none focus:ring-2 focus:ring-orange-500/35 transition-all text-sm font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || loadingTournaments}
              className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-white font-extrabold rounded-xl shadow-lg shadow-orange-950/20 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {submitting ? 'Génération...' : 'Accéder à mon espace joueur →'}
            </button>
          </form>

          {/* Simulated Email Link Box for Local Preview */}
          {magicLink && (
            <div className="mt-6 p-4 bg-slate-950 rounded-2xl border border-orange-500/30 text-xs space-y-2">
              <p className="font-extrabold text-orange-400 uppercase tracking-wider text-[10px]">
                📬 Simulateur d'Email (Mode Dev)
              </p>
              <p className="text-slate-400 leading-normal">
                En production, ce lien est envoyé directement par email. Cliquez ci-dessous pour vous connecter :
              </p>
              <a
                href={magicLink}
                className="block text-center py-2 bg-slate-800 text-orange-400 border border-orange-500/20 hover:border-orange-500/40 rounded-xl font-bold transition-all text-[11px] select-all cursor-pointer truncate px-2"
              >
                {magicLink}
              </a>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-md w-full mx-auto text-center pb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 opacity-50">
          TournoisTT · Système de score décentralisé
        </p>
      </footer>
    </div>
  );
}
