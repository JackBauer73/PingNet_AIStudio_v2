import React, { useState, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { MessageSquarePlus, X, Star, Camera, Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { supabase } from '../../supabase';

type FeedbackType = 'bug' | 'suggestion' | 'avis';

export default function FeedbackWidget() {
  const location = useLocation();
  const params = useParams();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Formulaire
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [attachScreenshot, setAttachScreenshot] = useState(true);
  
  // Stockage temporaire du canvas de capture
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  // Fonction de prise de capture d'écran propre
  const handleOpenWidget = async () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    
    setIsCapturing(true);
    setScreenshotBlob(null);
    setScreenshotPreview(null);
    
    // Attendre un tout petit peu pour s'assurer que l'animation n'est pas bloquée
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // Sauvegarder la fonction getComputedStyle d'origine
    const originalGetComputedStyle = window.getComputedStyle;
    
    try {
      // Masquer temporairement le bouton de feedback de la capture pour qu'il n'apparaisse pas
      const fabBtn = document.getElementById('global-feedback-fab');
      if (fabBtn) fabBtn.style.opacity = '0';

      // Patch temporaire de window.getComputedStyle pour intercepter et neutraliser les couleurs 'oklch'
      window.getComputedStyle = function (elt, pseudoElt) {
        const style = originalGetComputedStyle.call(window, elt, pseudoElt);
        
        return new Proxy(style, {
          get(target, prop) {
            const originalValue = Reflect.get(target, prop);
            
            const cleanValue = (val: any, propertyKey: string | symbol) => {
              if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab') || val.includes('okl'))) {
                const keyStr = String(propertyKey).toLowerCase();
                if (keyStr.includes('background')) {
                  return 'rgb(15, 31, 61)'; // Bleu marine signature de l'application
                }
                if (keyStr.includes('border')) {
                  return 'rgb(42, 53, 72)'; // Bordures foncées élégantes
                }
                if (keyStr.includes('color')) {
                  return 'rgb(255, 255, 255)'; // Blanc par défaut pour les textes
                }
                return 'rgba(0, 0, 0, 0)';
              }
              return val;
            };

            if (typeof originalValue === 'function') {
              if (prop === 'getPropertyValue') {
                return function(propertyName: string) {
                  const val = target.getPropertyValue(propertyName);
                  return cleanValue(val, propertyName);
                };
              }
              return originalValue.bind(target);
            }
            
            return cleanValue(originalValue, prop);
          }
        });
      };
      
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: 0.8, // Légère réduction pour optimiser la mémoire et charger plus vite
        ignoreElements: (element) => {
          // Ignorer le bouton flottant de feedback s'il n'était pas caché
          return element.id === 'global-feedback-fab' || element.id === 'global-feedback-panel';
        }
      });
      
      if (fabBtn) fabBtn.style.opacity = '1';

      // Convertir en Blob pour l'envoi futur
      canvas.toBlob((blob) => {
        if (blob) {
          setScreenshotBlob(blob);
          const previewUrl = URL.createObjectURL(blob);
          setScreenshotPreview(previewUrl);
        }
      }, 'image/png');
      
    } catch (err) {
      console.error('Erreur lors de la capture d\'écran automatique:', err);
    } finally {
      // Toujours restaurer la fonction getComputedStyle originale
      window.getComputedStyle = originalGetComputedStyle;
      setIsCapturing(false);
      setIsOpen(true);
    }
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Veuillez saisir votre message.');
      return;
    }

    setIsSending(true);
    let screenshotPath: string | null = null;

    try {
      // 1. Upload de la capture d'écran si activée et disponible
      if (attachScreenshot && screenshotBlob) {
        const fileId = `${crypto.randomUUID()}.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('feedback-screenshots')
          .upload(fileId, screenshotBlob, {
            contentType: 'image/png',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error("Échec du téléversement de l'image:", uploadError);
          // On ne bloque pas l'envoi de la suggestion si l'image échoue
        } else if (uploadData) {
          screenshotPath = uploadData.path;
        }
      }

      // 2. Récupérer le jeton joueur du contexte s'il y en a un
      const playerToken = params.token || null;

      // 3. Récupérer l'identifiant du tournoi du stockage local s'il existe
      let tournamentId: string | null = null;
      try {
        tournamentId = localStorage.getItem('selected_tournament_id') || 
                       localStorage.getItem('organizer_selected_tournament_id') || 
                       localStorage.getItem('public_selected_tournament_id');
      } catch (stErr) {
        // Ignorer silencieusement si inaccessible
      }

      // 4. Insertion en base de données
      const { error: insertError } = await supabase
        .from('feedback')
        .insert({
          type,
          message: message.trim(),
          rating: type === 'avis' ? rating : null,
          page_url: location.pathname,
          user_agent: navigator.userAgent,
          app_version: '0.20.0',
          tournament_id: tournamentId,
          player_token: playerToken,
          screenshot_path: screenshotPath,
          status: 'nouveau'
        });

      if (insertError) {
        throw insertError;
      }

      toast.success('Merci ! Votre retour a bien été envoyé.');
      
      // Réinitialiser le formulaire
      setMessage('');
      setType('bug');
      setRating(5);
      setScreenshotBlob(null);
      setScreenshotPreview(null);
      setIsOpen(false);

    } catch (err: any) {
      console.error("Erreur d'envoi de retour:", err);
      toast.error(`Une erreur est survenue lors de l'envoi : ${err.message || err}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Bouton Flottant (FAB) */}
      <button
        id="global-feedback-fab"
        onClick={handleOpenWidget}
        disabled={isCapturing}
        className="fixed bottom-4 right-4 z-50 flex items-center justify-center bg-[#f97316] text-white rounded-full shadow-xl hover:bg-orange-600 active:scale-95 transition-all w-12 h-12 lg:w-14 lg:h-14 mb-16 lg:mb-0 cursor-pointer border border-orange-500/20"
        aria-label="Donner un retour ou signaler un bug"
      >
        {isCapturing ? (
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        ) : isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageSquarePlus className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Panneau de feedback flottant */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="global-feedback-panel"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-20 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[440px] max-w-md bg-[#0f1f3d] border border-[#2a3548] rounded-2xl shadow-2xl p-3.5 text-white mb-14 lg:mb-0 font-sans max-h-[calc(100vh-120px)] overflow-y-auto"
          >
            {/* Header du panneau */}
            <div className="flex justify-between items-center pb-2 border-b border-[#2a3548] mb-3">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="w-4.5 h-4.5 text-[#f97316]" />
                <h3 className="font-extrabold text-xs tracking-tight">Signaler ou Évaluer</h3>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1a2b4c]/60 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSendFeedback} className="space-y-3">
              {/* Type de feedback */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Type de Retour</label>
                <div className="grid grid-cols-3 gap-1 bg-[#1a2b4c]/60 p-1 rounded-xl border border-[#2a3548]/50">
                  {(['bug', 'suggestion', 'avis'] as FeedbackType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`py-1 text-[11px] font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                        type === t 
                          ? 'bg-[#f97316] text-white shadow-md' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {t === 'bug' ? 'Bug 🐛' : t === 'suggestion' ? 'Idée 💡' : 'Avis ⭐'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notation par étoiles (uniquement si Avis) */}
              {type === 'avis' && (
                <div className="space-y-0.5 text-center bg-[#1a2b4c]/40 p-1.5 rounded-xl border border-[#2a3548]/30">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Votre Note</label>
                  <div className="flex justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-0.5 hover:scale-110 active:scale-90 transition-transform cursor-pointer"
                      >
                        <Star 
                          className={`w-5.5 h-5.5 ${
                            star <= rating 
                              ? 'fill-amber-400 text-amber-400' 
                              : 'text-slate-650 hover:text-slate-400'
                          }`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message de description */}
              <div className="space-y-1">
                <label htmlFor="feedback-desc" className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Description
                </label>
                <textarea
                  id="feedback-desc"
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    type === 'bug' 
                      ? "Ex: Le score s'affiche mal sur mobile..." 
                      : type === 'suggestion'
                      ? "Ex: Ce serait super d'ajouter un filtre..."
                      : "Ex: Très pratique pour notre tournoi !"
                  }
                  required
                  className="w-full bg-[#0c1524] border border-[#2a3548] rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors focus:ring-1 focus:ring-slate-500 min-h-[50px]"
                />
              </div>

              {/* Capture d'écran */}
              {screenshotPreview && (
                <div className="space-y-1 bg-[#1a2b4c]/40 p-2 rounded-xl border border-[#2a3548]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Camera className="w-3 h-3 text-emerald-400" />
                      Capture d'Écran Automatique
                    </span>
                    <div className="flex items-center gap-2">
                      {attachScreenshot && (
                        <div className="h-6 w-12 rounded border border-[#2a3548] overflow-hidden">
                          <img 
                            src={screenshotPreview} 
                            alt="Aperçu" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <input
                        type="checkbox"
                        id="attach-screenshot"
                        checked={attachScreenshot}
                        onChange={(e) => setAttachScreenshot(e.target.checked)}
                        className="rounded border-[#2a3548] text-[#f97316] focus:ring-0 focus:ring-offset-0 cursor-pointer h-4 w-4"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Contexte en lecture seule technique */}
              <div className="text-[8px] font-mono text-slate-500 leading-normal space-y-0.5 pt-1.5 border-t border-[#2a3548]/40">
                <div className="flex justify-between">
                  <span>Page courante :</span>
                  <span className="text-slate-400 truncate max-w-[280px]">{location.pathname}</span>
                </div>
              </div>

              {/* Bouton d'envoi */}
              <button
                type="submit"
                disabled={isSending}
                className="w-full flex items-center justify-center gap-1.5 bg-[#f97316] hover:bg-orange-600 disabled:bg-[#f97316]/50 text-white py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-md shadow-orange-500/10 cursor-pointer disabled:cursor-not-allowed transform active:scale-[0.98] transition-all"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    Envoyer
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
