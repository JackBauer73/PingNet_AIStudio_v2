import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, Users, Trophy, QrCode, 
  HelpCircle, Settings, Clipboard, Award, 
  Smartphone, Eye, Layers, UserCheck, HelpCircle as FaqIcon, CheckCircle
} from 'lucide-react';
import PublicHeader from '../../components/layout/PublicHeader';

export default function Tutoriel() {
  const [activeTab, setActiveTab] = useState<'joueur' | 'organisateur'>('joueur');

  const faqItems = [
    {
      q: "Comment s'inscrire en ligne avec sa licence FFTT ?",
      a: "Rendez-vous dans la rubrique 'Tournois', sélectionnez votre compétition, puis renseignez votre numéro de licence FFTT à 7 chiffres. Ping Manager interroge instantanément les serveurs de la fédération pour importer votre nom, prénom, club d'origine et classements officiels mis à jour."
    },
    {
      q: "Qu'est-ce que le 'Jeton Joueur' (Token) et à quoi sert-il ?",
      a: "Le Jeton est une clé secrète personnalisée générée automatiquement lors de votre inscription. Il vous permet d'accéder à votre tableau de bord personnel d'un clic, d'effectuer votre pointage sur place, de voir vos horaires et tables de convocation, et de valider l'exactitude de vos scores."
    },
    {
      q: "Comment marche l'arbitrage électronique sans feuille papier ?",
      a: "Chaque table physique dispose d'un QR code imprimé. L'arbitre désigné scanne le QR code avec son portable, ce qui charge instantanément l'interface d'arbitrage sécurisée pré-remplie avec le match en cours. Dès que le score est validé par l'arbitre et le joueur, les classements de poules et les bracketings se mettent à jour automatiquement de façon globale !"
    },
    {
      q: "L'application fonctionne-t-elle hors connexion ?",
      a: "Ping Manager est doté de mécanismes d'optimisation locale robuste, garantissant un fonctionnement optimal même dans les gymnases profonds mal desservis en réseau mobile."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a1729] text-white font-sans selection:bg-[#f97316] selection:text-white flex flex-col justify-between">
      <div>
        <PublicHeader />

        {/* Hero Header */}
        <section className="py-12 md:py-16 text-center max-w-4xl mx-auto px-6 font-sans">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-bold mb-4 border border-[#f97316]/20">
              <BookOpen className="w-3.5 h-3.5" />
              Centre d'apprentissage & Aide
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-white">
              Guide d’utilisation du <span className="text-[#f97316]">Ping Manager</span>
            </h1>
            <p className="text-slate-400 text-sm md:text-base mt-4 max-w-2xl mx-auto leading-relaxed">
              Découvrez comment utiliser au mieux notre solution de gestion connectée. Que vous soyez compétiteur prêt à jouer ou club organisateur, nous avons pensé à chaque étape pour simplifier votre journée.
            </p>
          </motion.div>
        </section>

        {/* Mode Selector Tab Container */}
        <section className="max-w-4xl mx-auto px-6 mb-12">
          <div className="flex bg-[#111e32] p-1.5 rounded-2xl border border-[#2a3548] max-w-md mx-auto">
            <button
              onClick={() => setActiveTab('joueur')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black tracking-tight transition-all cursor-pointer ${
                activeTab === 'joueur'
                  ? 'bg-[#f97316] text-white shadow-lg shadow-orange-500/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4.5 h-4.5" />
              Espace Joueur
            </button>
            <button
              onClick={() => setActiveTab('organisateur')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black tracking-tight transition-all cursor-pointer ${
                activeTab === 'organisateur'
                  ? 'bg-[#f97316] text-white shadow-lg shadow-orange-500/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Settings className="w-4.5 h-4.5" />
              Espace Organisateur
            </button>
          </div>
        </section>

        {/* Dynamic Instructional Content */}
        <section className="max-w-5xl mx-auto px-6">
          {activeTab === 'joueur' ? (
            <motion.div
              key="joueur-tab"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {/* Step 1 */}
              <div className="bg-[#152031] p-6 rounded-3xl border border-[#2a3548] hover:border-[#f97316]/30 transition-all text-left">
                <div className="w-12 h-12 rounded-2xl bg-[#f97316]/10 text-[#f97316] flex items-center justify-center font-bold font-display text-lg mb-6">
                  01
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Smartphone className="w-5 h-5 text-orange-400" />
                  <h3 className="font-extrabold text-lg text-white">Inscription FFTT</h3>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Recherchez votre fiche licencié en entrant votre numéro FFTT à 7 chiffres. Vos points, nom, prénom et club sont récupérés automatiquement sans aucune saisie double. Choisissez vos tableaux en fonction de vos points.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-[#152031] p-6 rounded-3xl border border-[#2a3548] hover:border-[#f97316]/30 transition-all text-left">
                <div className="w-12 h-12 rounded-2xl bg-[#f97316]/10 text-[#f97316] flex items-center justify-center font-bold font-display text-lg mb-6">
                  02
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="w-5 h-5 text-orange-400" />
                  <h3 className="font-extrabold text-lg text-white">Pointage QR Code</h3>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Le jour de la compétition, présentez le QR Code de votre jeton joueur (téléchargé lors de votre inscription ou reçu par mail) à l'organisme d'accueil. Votre présence est validée automatiquement et votre dossard vous est remis immédiatement.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-[#152031] p-6 rounded-3xl border border-[#2a3548] hover:border-[#f97316]/30 transition-all text-left">
                <div className="w-12 h-12 rounded-2xl bg-[#f97316]/10 text-[#f97316] flex items-center justify-center font-bold font-display text-lg mb-6">
                  03
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <QrCode className="w-5 h-5 text-orange-400" />
                  <h3 className="font-extrabold text-lg text-white">Arbitrages et Scores</h3>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Suivez vos horaires de matches prévus et tables d’affectation en temps réel. Lorsque vous êtes désigné arbitre, scannez le QR code de votre table, saisissez les sets et validez l’envoi. Les classements se mettent à jour instantanément.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="organisateur-tab"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {/* Step 1 */}
              <div className="bg-[#152031] p-6 rounded-3xl border border-[#2a3548] hover:border-[#f97316]/30 transition-all text-left">
                <div className="w-12 h-12 rounded-2xl bg-[#f97316]/10 text-[#f97316] flex items-center justify-center font-bold font-display text-lg mb-6">
                  01
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Clipboard className="w-5 h-5 text-orange-400" />
                  <h3 className="font-extrabold text-lg text-white">Création & Catégories</h3>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Créez vos tournois de club depuis votre espace organisateur. Configurez les dates, la capacité, le nombre de tables disponibles et définissez vos catégories de classement (ex: Tableaux &lt; 900 pts, toutes catégories...).
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-[#152031] p-6 rounded-3xl border border-[#2a3548] hover:border-[#f97316]/30 transition-all text-left">
                <div className="w-12 h-12 rounded-2xl bg-[#f97316]/10 text-[#f97316] flex items-center justify-center font-bold font-display text-lg mb-6">
                  02
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-5 h-5 text-orange-400" />
                  <h3 className="font-extrabold text-lg text-white">Tirages Serpentins</h3>
                </div>
                <p className="text-slate-450 text-xs leading-relaxed text-slate-350">
                  Après clôture des pointages le jour J, lancez automatiquement le tirage des poules d'un clic. Ping Manager calcule un serpentin intelligent équilibré qui évite que des joueurs du même club s’affrontent en poules de 3 ou de 4.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-[#152031] p-6 rounded-3xl border border-[#2a3548] hover:border-[#f97316]/30 transition-all text-left">
                <div className="w-12 h-12 rounded-2xl bg-[#f97316]/10 text-[#f97316] flex items-center justify-center font-bold font-display text-lg mb-6">
                  03
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-5 h-5 text-orange-400" />
                  <h3 className="font-extrabold text-lg text-white">Grilles Automatiques</h3>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Progressez le tournoi d’un clic vers les grilles d’élimination directe (les brackets). L’application gère l'attribution optimale des tables physiques disponibles pour enchaîner les matches de façon ultra fluide.
                </p>
              </div>
            </motion.div>
          )}
        </section>

        {/* Visual guide highlight callout */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="p-8 rounded-3xl bg-gradient-to-tr from-[#111e32] to-[#152031] border border-[#2a3548] grid grid-cols-1 md:grid-cols-2 gap-8 items-center text-left font-sans">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold border border-indigo-500/20 uppercase tracking-widest mb-4">
                <Eye className="w-3.5 h-3.5" />
                Démonstration Interactive
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
                Zéro impression papier, des dizaines d’heures gagnées
              </h2>
              <p className="text-slate-400 text-xs md:text-sm leading-relaxed mt-4">
                Ping Manager remplace l'intégralité des tableaux volants d'attribution de tables, les classements papier tenus au stylo bille, et l'édition manuelle des brackets de consolante. 
                Configurez, invitez vos licenciés, et laissez le moteur de score orchestrer la compétition.
              </p>
              <div className="space-y-2 mt-6">
                <div className="flex items-center gap-2 text-xs text-slate-350">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Validation FFTT en temps réel</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-350">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Liaison simplifiée des emails et alertes convoqués</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-350">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Gestion des doubles et simples</span>
                </div>
              </div>
            </div>
            
            <div className="bg-[#0a1729] rounded-2xl border border-[#2a3548] p-5 shadow-inner flex flex-col justify-between h-[250px]">
              <div className="flex justify-between items-center pb-3 border-b border-[#2a3548]/50">
                <span className="text-[10px] font-black tracking-widest text-[#f97316] uppercase">TABLE PHYSIQUE D'ARBITRAGE</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="my-auto space-y-2">
                <QrCode className="w-14 h-14 text-slate-400 mx-auto" />
                <p className="text-center font-display font-black text-xl text-white">Table N°12</p>
                <p className="text-center text-[11px] text-slate-450">Scannez pour arbitrer ou suivre le match</p>
              </div>
              <div className="bg-[#111e32] p-2.5 rounded-xl text-center text-[10px] text-slate-300 font-bold border border-[#2a3548]/40">
                Match en cours : Paul (850 pts) vs Clara (760 pts)
              </div>
            </div>
          </div>
        </section>

        {/* FAQs list */}
        <section className="bg-[#111e32]/30 border-y border-[#2a3548]/40 py-20">
          <div className="max-w-4xl mx-auto px-6 text-left">
            <div className="flex items-center gap-2.5 mb-10 border-b border-[#2a3548]/50 pb-4">
              <FaqIcon className="w-6 h-6 text-[#f97316]" />
              <h2 className="text-2xl font-black text-white tracking-tight">Questions Fréquentes (FAQ)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
              {faqItems.map((item, id) => (
                <div key={id} className="space-y-2">
                  <p className="font-bold text-white text-sm flex items-start gap-2">
                    <span className="text-[#f97316] font-extrabold">Q.</span>
                    {item.q}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed pl-5">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Decorative Wave/Footer */}
      <footer className="bg-[#0f1f3d] text-slate-400 py-12 border-t border-[#2a3548]/50 shrink-0">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-left">© 2026 Ping Manager. Conçu pour simplifier l'arbitrage et le suivi des tournois.</p>
          <div className="flex gap-6 text-xs font-bold">
            <span className="text-[#f97316] hover:text-orange-400 cursor-pointer">Français</span>
            <span className="text-slate-400">v0.20.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
