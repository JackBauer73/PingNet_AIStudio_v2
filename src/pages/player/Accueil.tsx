import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Calendar, Users, Activity, Smartphone, Layers, Zap, CheckCircle2, ArrowRight, BookOpen } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import PublicHeader from '../../components/layout/PublicHeader';
import { useTournament } from '../../hooks/useTournament';
import { supabase } from '../../supabase';

export default function Accueil() {
  const navigate = useNavigate();
  const { allTournaments } = useTournament({ forcePublic: true });
  const [showAdminLink, setShowAdminLink] = useState(true);

  useEffect(() => {
    // Keep Admin link visible
    setShowAdminLink(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a1729] text-slate-100 font-sans selection:bg-[#f97316] selection:text-white flex flex-col justify-between">
      <div>
        <PublicHeader />

        {/* Hero Section */}
        <section className="relative overflow-hidden py-16 md:py-24 max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 z-10 font-sans text-left">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-bold mb-6 border border-[#f97316]/25">
                <Trophy className="w-3.5 h-3.5 animate-pulse" />
                La nouvelle ère du Tennis de Table
              </div>
              
              <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-[0.95] text-white mb-6">
                Le Tennis de Table <br />
                <span className="text-[#f97316]">sous une autre dimension</span>
              </h1>
              
              <p className="text-slate-300 text-base md:text-lg max-w-xl leading-relaxed mb-8">
                Suivi en direct, inscriptions instantanées et arbitrages automatisés. Rejoignez ou organisez des compétitions de tennis de table de façon fluide, moderne et ultra-performante.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => navigate('/tournois')}
                  className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#f97316] hover:bg-[#ea6a0a] text-white font-bold tracking-tight transition-all shadow-lg shadow-orange-500/20 cursor-pointer"
                >
                  Trouver un tournoi
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => navigate('/tutoriel')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border-2 border-[#2a3548] hover:border-[#f97316] text-slate-200 hover:text-white hover:bg-white/[0.02] font-bold tracking-tight transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-orange-400" />
                  Consulter le Tutoriel
                </button>
              </div>
            </motion.div>
          </div>
          
          {/* Visual Showcase Block */}
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

              <div className="space-y-3 z-10 my-auto text-left">
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
                {allTournaments ? allTournaments.length : 3}+
              </p>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1">Tournois créés</p>
            </div>
            <div>
              <p className="font-display text-4xl md:text-5xl font-black text-[#f97316] tracking-tight tabular-nums">
                100%
              </p>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1">Données FFTT API</p>
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
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1">Feuilles de papier</p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-[#152031]/30 py-20 border-b border-[#2a3548]/50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-semibold mb-3 border border-[#f97316]/10">
                <Zap className="w-3.5 h-3.5" />
                Performance maximale
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-white">
                Piloter vos tournois comme des pros
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 font-sans">
              <div className="p-6 rounded-2xl bg-[#152031] border border-[#2a3548]/60 hover:-translate-y-1 hover:border-[#f97316]/35 transition-all group text-left">
                <div className="w-12 h-12 rounded-xl bg-[#0f1f3d] border border-[#2a3548] flex items-center justify-center mb-4 group-hover:bg-[#f97316] group-hover:border-[#f97316] transition-colors">
                  <Zap className="w-6 h-6 text-[#f97316] group-hover:text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2">Inscription Instantanée</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Connexion FFTT simplifiée pour s'inscrire en quelques secondes. Vérification automatique de conformité et des classements.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#152031] border border-[#2a3548]/60 hover:-translate-y-1 hover:border-[#f97316]/35 transition-all group text-left">
                <div className="w-12 h-12 rounded-xl bg-[#0f1f3d] border border-[#2a3548] flex items-center justify-center mb-4 group-hover:bg-[#f97316] group-hover:border-[#f97316] transition-colors">
                  <Smartphone className="w-6 h-6 text-[#f97316] group-hover:text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2">Suivi sur Smartphone</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Pas besoin d'installer d'application. Suivez vos pointages, vos horaires de convocation et vos tables directement en ligne depuis votre mobile.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#152031] border border-[#2a3548]/60 hover:-translate-y-1 hover:border-[#f97316]/35 transition-all group text-left">
                <div className="w-12 h-12 rounded-xl bg-[#0f1f3d] border border-[#2a3548] flex items-center justify-center mb-4 group-hover:bg-[#f97316] group-hover:border-[#f97316] transition-colors">
                  <Activity className="w-6 h-6 text-[#f97316] group-hover:text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2">Live Score Intuitif</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Des QR Codes sur chaque table permettent aux arbitres d'entrer les scores directement sur mobile avec report automatique en temps réel.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#152031] border border-[#2a3548]/60 hover:-translate-y-1 hover:border-[#f97316]/35 transition-all group text-left">
                <div className="w-12 h-12 rounded-xl bg-[#0f1f3d] border border-[#2a3548] flex items-center justify-center mb-4 group-hover:bg-[#f97316] group-hover:border-[#f97316] transition-colors">
                  <Layers className="w-6 h-6 text-[#f97316] group-hover:text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2">Poules & Tableaux</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Génération des poules d'un clic avec serpentin intelligent, et bascule instantanée vers les tableaux à élimination directe.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#152031] border border-[#2a3548]/60 hover:-translate-y-1 hover:border-[#f97316]/35 transition-all group text-left">
                <div className="w-12 h-12 rounded-xl bg-[#0f1f3d] border border-[#2a3548] flex items-center justify-center mb-4 group-hover:bg-[#f97316] group-hover:border-[#f97316] transition-colors">
                  <Trophy className="w-6 h-6 text-[#f97316] group-hover:text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2">Arbitrage Simplifié</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Une interface d'arbitrage épurée, sécurisée, empêchant les scores invalides pour des compétitions fluides.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#152031] border border-[#2a3548]/60 hover:-translate-y-1 hover:border-[#f97316]/35 transition-all group text-left">
                <div className="w-12 h-12 rounded-xl bg-[#0f1f3d] border border-[#2a3548] flex items-center justify-center mb-4 group-hover:bg-[#f97316] group-hover:border-[#f97316] transition-colors">
                  <CheckCircle2 className="w-6 h-6 text-[#f97316] group-hover:text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2">Garantie Sans Papier</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Économisez du temps et des impressions de feuilles. Les feuilles de matches papier et les crayons font désormais partie du passé.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works Section */}
        <section className="bg-[#111e32] border-b border-[#2a3548]/50 py-20 text-white text-center relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 relative z-10 font-sans">
            <h2 className="font-display text-3xl font-bold tracking-tight mb-16 text-white text-center">
              Comment ça marche pour un joueur ?
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative text-center">
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
        <section className="py-20 max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-2xl bg-[#152031] text-white border border-[#2a3548] shadow-lg flex flex-col justify-between text-left group font-sans">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold mb-6 border border-white/5">
                Joueurs & Compétiteurs
              </span>
              <h3 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-4 text-white">
                Une expérience de jeu immersive
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Fini l'attente interminable devant les panneaux d'affichage papier. Soyez notifiés en temps réel, trouvez rapidement votre table et jouez dans les meilleures conditions.
              </p>
            </div>
            <button 
              onClick={() => navigate('/tournois')} 
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#f97316] hover:bg-[#ea6a0a] text-white font-bold tracking-tight transition-all cursor-pointer w-max shadow-md shadow-orange-500/10 font-sans"
            >
              Trouver un tournoi
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="p-8 rounded-2xl bg-[#152031] text-white border border-[#2a3548] shadow-lg flex flex-col justify-between text-left group hover:border-[#f97316]/50 transition-all font-sans">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-semibold mb-6 border border-[#f97316]/20">
                Clubs & Organisateurs
              </span>
              <h3 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-4 text-white">
                Simplifiez l'organisation de A à Z
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Gérez les inscriptions en ligne de manière autonome. Vos poules de match et les tableaux se réactualisent au fil des résultats enregistrés. Un pur concentré d'efficacité sportive.
              </p>
            </div>
            <button 
              onClick={() => navigate('/tournois')} 
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#2a3548] hover:border-[#f97316] text-slate-200 hover:text-white hover:bg-white/[0.02] font-bold tracking-tight transition-all cursor-pointer w-max font-sans"
            >
              Accéder aux tournois
            </button>
          </div>
        </section>

        {/* CTA final Section stylized block */}
        <section className="mb-20 px-6 max-w-6xl mx-auto">
          <div className="bg-gradient-to-r from-[#ea6a0a] to-[#f97316] py-12 text-white text-center rounded-[2.5rem] border border-[#f97316]/20 shadow-2xl shadow-orange-500/5 px-6">
            <div className="max-w-4xl mx-auto font-sans">
              <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mb-4 text-white">
                Prêt à vous inscrire ou lancer un tournoi ?
              </h2>
              <p className="text-white/85 max-w-lg mx-auto text-sm mb-8 leading-relaxed">
                Parcourez la liste officielle de nos compétitions actives, inscrivez-vous en ligne, ou accédez au tutoriel complet pour organiser vos événements en club.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <button 
                  onClick={() => navigate('/tournois')}
                  className="inline-flex items-center gap-3 px-8 py-3.5 rounded-xl bg-[#0a1729] hover:bg-[#111e32] text-white font-bold tracking-tight transition-all shadow-xl shadow-black/20 cursor-pointer"
                >
                  Voir les tournois actifs
                  <ArrowRight className="w-4 h-4 text-[#f97316]" />
                </button>
                <button 
                  onClick={() => navigate('/tutoriel')}
                  className="inline-flex items-center gap-3 px-8 py-3.5 rounded-xl bg-orange-750/30 hover:bg-orange-800/40 text-white border border-white/20 font-bold tracking-tight transition-all cursor-pointer"
                >
                  Regarder le Tutoriel
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-[#0f1f3d] text-slate-400 py-12 border-t border-[#2a3548]/50 shrink-0">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-left">© 2026 Ping Manager. Conçu pour simplifier l'arbitrage et le suivi des tournois.</p>
          <div className="flex gap-6 text-xs font-bold items-center">
            <span className="text-[#f97316] hover:text-orange-400 cursor-pointer">Français</span>
            <span className="text-slate-400">v0.20.0</span>
            {showAdminLink && (
              <Link to="?login=admin" className="text-slate-400 hover:text-white transition-colors cursor-pointer border-l border-[#2a3548]/80 pl-4">Admin</Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
