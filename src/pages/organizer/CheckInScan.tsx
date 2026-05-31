import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { assignDossard } from '../../services/dossardService';
import { useTournament } from '../../hooks/useTournament';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  Search, 
  QrCode, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Trophy, 
  Clock, 
  History, 
  Camera,
  Hash,
  X,
  Sparkles
} from 'lucide-react';

export default function CheckInScan() {
  const { dayNumber } = useParams<{ dayNumber: string }>();
  const day = parseInt(dayNumber || '1', 10);
  const navigate = useNavigate();
  const { tournament } = useTournament();

  const [scanMode, setScanMode] = useState<'idle' | 'scanning' | 'confirm' | 'success' | 'error'>('idle');
  const [tokenInput, setTokenInput] = useState('');
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [playerData, setPlayerData] = useState<any | null>(null);
  const [playerRegs, setPlayerRegs] = useState<any[]>([]); // registrations of the player for this tournament
  const [processing, setProcessing] = useState(false);
  const [lastCheckedIn, setLastCheckedIn] = useState<any | null>(null); // last player checked in

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load last checked in from localStorage if available to keep state across refreshes
  useEffect(() => {
    const saved = localStorage.getItem('last_checked_in_player');
    if (saved) {
      try {
        setLastCheckedIn(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleQRResult = (result: string) => {
    if (!result) return;
    
    let token = result.trim();
    
    // Si c'est une URL complète (ex: https://domain.com/player/ABC1234), extraire le token
    if (token.includes('/player/')) {
      token = token.split('/player/').pop() || token;
    }

    // Nettoyer d'éventuels paramètres additionnels
    if (token.includes('?')) {
      token = token.split('?')[0];
    }
    
    setScannedToken(token);
    loadPlayerByToken(token);
  };

  const loadPlayerByToken = async (token: string) => {
    setScanMode('scanning');
    try {
      // 1. Résoudre le token
      const { data: tokenRow, error: tError } = await supabase
        .from('player_tokens')
        .select('player_id, tournament_id')
        .eq('token', token.trim())
        .maybeSingle();

      if (tError) throw tError;

      if (!tokenRow) {
        toast.error("QR Code ou jeton invalide");
        setScanMode('error');
        return;
      }

      // 2. Charger le joueur
      const { data: player, error: pError } = await supabase
        .from('players')
        .select('*')
        .eq('id', tokenRow.player_id)
        .maybeSingle();

      if (pError || !player) {
        toast.error("Données joueur introuvables");
        setScanMode('error');
        return;
      }

      // 3. Charger les inscriptions du joueur pour la journée scannée
      const { data: regs, error: rError } = await supabase
        .from('registrations')
        .select(`
          id, dossard, checked_in, paid, status,
          table_category_id,
          table_categories (
            id, name, day_number, color_code, start_time
          )
        `)
        .eq('player_id', tokenRow.player_id)
        .eq('tournament_id', tokenRow.tournament_id);

      if (rError) throw rError;

      setPlayerData(player);
      setPlayerRegs(regs || []);
      setScanMode('confirm');
    } catch (err) {
      console.error(err);
      toast.error("Erreur de communication Supabase");
      setScanMode('error');
    }
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanMode('scanning');
    
    try {
      const imageBitmap = await createImageBitmap(file);
      
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await detector.detect(imageBitmap);
        if (barcodes.length > 0) {
          handleQRResult(barcodes[0].rawValue);
        } else {
          toast.error('Aucun QR Code détecté dans cette image. Essayez de saisir le jeton manuellement.');
          setScanMode('idle');
        }
      } else {
        // Fallback si BarcodeDetector n'est pas supporté (ex: certains anciens Safari/iOS)
        toast.error("La détection automatique d'images n'est pas supportée par votre navigateur. Veuillez saisir le jeton manuellement.");
        setScanMode('idle');
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur de traitement d'image. Entrez le jeton manuellement.");
      setScanMode('idle');
    }
  };

  const handleConfirmCheckin = async () => {
    if (!playerData || playerRegs.length === 0) return;
    setProcessing(true);
    
    try {
      // Trouver la première inscription non pointée
      const firstUncheck = playerRegs.find(r => !r.checked_in) || playerRegs[0];
      
      const result = await assignDossard({
        registrationId: firstUncheck.id,
        tournamentId: tournament?.id || playerRegs[0]?.tournament_id,
        onlyThisRegistration: false // Pointer toutes les inscriptions de ce tournoi
      });

      const updatedInfo = {
        name: `${playerData.first_name} ${playerData.last_name}`,
        dossard: result.dossard,
        tableaux: playerRegs.map(r => r.table_categories?.name).join(', '),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      };

      setLastCheckedIn(updatedInfo);
      localStorage.setItem('last_checked_in_player', JSON.stringify(updatedInfo));

      toast.success("✨ Pointage validé avec succès ! ✓");
      setScanMode('success');
      
      // Auto-back to idle after 3 seconds
      setTimeout(() => {
        setScanMode('idle');
        setPlayerData(null);
        setPlayerRegs([]);
        setScannedToken(null);
        setTokenInput('');
      }, 3000);

    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur pointage : ${err.message || err}`);
      setScanMode('error');
    } finally {
      setProcessing(false);
    }
  };

  const dayRegs = playerRegs.filter(r => (r.table_categories?.day_number || 1) === day);
  const otherRegs = playerRegs.filter(r => (r.table_categories?.day_number || 1) !== day);

  return (
    <div className="min-h-screen bg-[#0f1f3d] text-white font-sans pb-12">
      
      {/* Header */}
      <header className="sticky top-0 bg-[#071328] py-4 px-4 shadow-md flex items-center justify-between border-b border-indigo-950 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/organizer/players')}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-all cursor-pointer text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base leading-tight">Scanner QR de Pointage</h1>
            <p className="text-[10px] sm:text-xs text-[#f97316] font-black uppercase tracking-widest mt-0.5">Journée {day}</p>
          </div>
        </div>
        <div className="text-xs font-black bg-indigo-900/40 border border-indigo-800 px-3 py-1.5 rounded-lg text-indigo-300">
          🔒 CLUB
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-6">

        <AnimatePresence mode="wait">
          
          {/* Écran d'attente (idle) */}
          {scanMode === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="bg-[#142647] rounded-3xl p-6 border border-indigo-950 text-center space-y-5 shadow-2xl">
                <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
                  <QrCode className="w-8 h-8" />
                </div>
                
                <div className="space-y-1">
                  <h2 className="text-lg font-black tracking-tight">Scanner le QR du Joueur</h2>
                  <p className="text-xs text-indigo-300 font-medium">Pour cette Journée {day}, scannez le QR code de l'espace joueur officiel ou saisissez son jeton secret.</p>
                </div>

                {/* Option Photo Caméra */}
                <div className="pt-2">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageCapture}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3.5 px-4 bg-[#f97316] hover:bg-[#e26210] active:scale-98 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg shadow-[#f97316]/10"
                  >
                    <Camera className="w-5 h-5 shrink-0" />
                    Prendre en Photo / Scanner QR
                  </button>
                </div>

                <div className="flex items-center gap-2.5 text-xs text-indigo-450 uppercase font-black tracking-widest py-1">
                  <div className="h-px bg-indigo-950 flex-1"></div>
                  <span>ou alternatif</span>
                  <div className="h-px bg-indigo-950 flex-1"></div>
                </div>

                {/* Saisie token manuelle */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="Saisir jeton secret..."
                    className="flex-1 px-4 py-3 bg-[#0d1b33] border border-indigo-950 focus:bg-[#071328] rounded-xl outline-none focus:ring-2 focus:ring-[#f97316] font-mono text-sm tracking-widest text-[#f97316] placeholder:text-slate-600 font-bold uppercase"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && tokenInput.trim()) {
                        handleQRResult(tokenInput.trim());
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (tokenInput.trim()) handleQRResult(tokenInput.trim());
                    }}
                    disabled={!tokenInput.trim()}
                    className="px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-extrabold rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Historique du dernier joueur pointé */}
              {lastCheckedIn && (
                <div className="bg-[#142647]/50 rounded-2xl p-4 border border-indigo-950/60 space-y-3">
                  <div className="flex items-center gap-2 border-b border-indigo-950/40 pb-2">
                    <History className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Dernier joueur pointé</span>
                    <span className="text-[9px] font-mono bg-indigo-900/30 text-indigo-400 px-1.5 py-0.5 rounded ml-auto">{lastCheckedIn.time}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-sm text-white">{lastCheckedIn.name}</h4>
                      <p className="text-[10px] text-indigo-300 leading-relaxed font-semibold line-clamp-1">{lastCheckedIn.tableaux}</p>
                    </div>
                    {lastCheckedIn.dossard && (
                      <span className="inline-flex items-center gap-0.5 font-mono font-black text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl uppercase">
                        Dossard {lastCheckedIn.dossard}
                      </span>
                    )}
                  </div>
                </div>
              )}

            </motion.div>
          )}

          {/* Écran de chargement/analyse de QR */}
          {scanMode === 'scanning' && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-[#142647] rounded-3xl p-12 border border-indigo-950 text-center space-y-4 shadow-2xl flex flex-col items-center justify-center my-6"
            >
              <Loader2 className="w-10 h-10 text-[#f97316] animate-spin" />
              <p className="text-indigo-200 font-extrabold text-sm tracking-wide">Analyse et chargement du profil joueur...</p>
            </motion.div>
          )}

          {/* Écran de confirmation (confirm) */}
          {scanMode === 'confirm' && playerData && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-4"
            >
              <div className="bg-[#142647] rounded-3xl p-5 border border-indigo-950 shadow-2xl space-y-4">
                
                {/* Carte d'identité joueur */}
                <div className="flex items-center gap-3 border-b border-indigo-950/60 pb-4">
                  <div className="w-11 h-11 bg-indigo-900/60 border border-indigo-800/40 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h3 className="font-extrabold text-white text-base leading-snug">{playerData.first_name} {playerData.last_name}</h3>
                    <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider truncate">{playerData.club || 'Club Libre'}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end">
                    <span className="text-xs font-black text-[#f97316] bg-[#f97316]/10 border border-[#f97316]/20 py-0.5 px-2 rounded-lg font-mono">
                      {playerData.points || 500} pts
                    </span>
                    {playerData.licence && (
                      <span className="text-[9px] text-indigo-400 font-mono mt-0.5">{playerData.licence}</span>
                    )}
                  </div>
                </div>

                {/* Tableaux pour la Journée active */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 text-left">Tableaux de la journée ({day})</h4>
                  {dayRegs.length === 0 ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-400 text-xs text-left font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Aucun tableau de ce jour dans les inscriptions de ce joueur.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dayRegs.map((reg, idx) => (
                        <div key={idx} className="bg-[#0d1b33] border border-indigo-950/60 rounded-xl p-3.5 flex justify-between items-center">
                          <div className="text-left">
                            <span className="font-black text-xs text-white flex items-center gap-1.5">
                              <Trophy className="w-3.5 h-3.5 text-indigo-400" />
                              {reg.table_categories?.name}
                            </span>
                            <span className="text-[9px] text-indigo-450 block font-bold mt-0.5 uppercase tracking-wide">
                              Journée {reg.table_categories?.day_number} {reg.table_categories?.start_time ? `• ${reg.table_categories.start_time}` : ''}
                            </span>
                          </div>
                          
                          <div>
                            {reg.checked_in ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                                <CheckCircle2 className="w-3" /> Présent
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg animate-pulse">
                                <Clock className="w-3" /> Absent
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tableaux autres journées */}
                {otherRegs.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-indigo-950/50">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-left">Inscriptions autres journées</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {otherRegs.map((reg, idx) => (
                        <span key={idx} className="text-[10px] px-2 py-1 bg-[#0d1b33]/60 border border-indigo-950/40 text-slate-400 rounded-lg font-bold">
                          {reg.table_categories?.name} (J{reg.table_categories?.day_number})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Boutons d'action */}
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <button
                    onClick={() => {
                      setScanMode('idle');
                      setPlayerData(null);
                      setPlayerRegs([]);
                      setScannedToken(null);
                      setTokenInput('');
                    }}
                    className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-slate-300 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-white/5"
                  >
                    <X className="w-4 h-4" />
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmCheckin}
                    disabled={processing || dayRegs.length === 0}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-900/10"
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Valider Pointage
                  </button>
                </div>

              </div>
            </motion.div>
          )}

          {/* Écran de réussite (success) */}
          {scanMode === 'success' && playerData && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#10b981] rounded-3xl p-8 text-center text-white space-y-5 shadow-2xl border-2 border-emerald-400 my-4"
            >
              <div className="w-16 h-16 bg-white/20 border border-white/40 rounded-full flex items-center justify-center mx-auto text-white animate-bounce shadow-inner">
                <Sparkles className="w-8 h-8 fill-white" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black tracking-tight">Pointage validé avec succès ! ✓</h3>
                <p className="text-sm font-extrabold text-emerald-50 leading-tight">
                  {playerData.first_name} {playerData.last_name}
                </p>
                <p className="text-xs text-emerald-100 font-semibold mt-1">présence validée et enregistrée.</p>
              </div>

              {lastCheckedIn?.dossard && (
                <div className="bg-white/15 border border-white/25 rounded-2xl p-4 inline-block font-mono">
                  <span className="block text-[10px] text-emerald-100 uppercase tracking-widest font-bold">DOSSARD ATTRIBUÉ</span>
                  <span className="text-4xl font-black italic tracking-tighter text-white">N° {lastCheckedIn.dossard}</span>
                </div>
              )}

              <p className="text-[10px] text-emerald-100 italic leading-relaxed pt-2">Reprise du pointage automatique...</p>
            </motion.div>
          )}

          {/* Écran d'erreur (error) */}
          {scanMode === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-rose-950/60 rounded-3xl p-6 border border-rose-900 shadow-2xl text-center space-y-4 my-6"
            >
              <div className="w-14 h-14 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto text-rose-500">
                <AlertCircle className="w-7 h-7" />
              </div>
              
              <div className="space-y-1 px-2">
                <h3 className="text-base font-black tracking-tight text-white">QR Code ou Jeton non reconnu</h3>
                <p className="text-xs text-rose-300 font-semibold leading-relaxed">
                  Ce code n'est relié à aucun joueur enregistré ou le jeton de connexion saisi est introuvable.
                </p>
              </div>

              <button
                onClick={() => {
                  setScanMode('idle');
                  setPlayerData(null);
                  setPlayerRegs([]);
                  setScannedToken(null);
                  setTokenInput('');
                }}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-1.5 mx-auto cursor-pointer"
              >
                Réessayer
              </button>
            </motion.div>
          )}

        </AnimatePresence>

      </div>
    </div>
  );
}
