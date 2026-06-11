import React, { useState } from 'react';
import { supabase } from '../../supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { X, LogIn, Mail, Lock, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from '../layout/Logo';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminAuthModal({ isOpen, onClose }: AdminAuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      
      const { error, data } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) {
        if (error.message === 'Invalid login credentials') {
          throw new Error('Email ou mot de passe incorrect.');
        }
        throw error;
      }

      const isSuperAdminUser = data.user?.email === 'vandamme.vince73@gmail.com';
      if (!isSuperAdminUser) {
        // Log out immediately if not the system admin
        await supabase.auth.signOut();
        throw new Error('Cet espace est réservé exclusivement à l\'administrateur général.');
      }

      toast.success('Connexion Administrateur réussie !');
      onClose();
      navigate('/superadmin');
    } catch (error: any) {
      toast.error(error.message || 'Erreur d’authentification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="admin-auth-modal-root" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            id="admin-auth-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#070e17]/90 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            id="admin-auth-modal-box"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
            className="relative w-full max-w-md overflow-hidden bg-white dark:bg-[#0a1729] rounded-[2.25rem] border-2 border-red-500/30 dark:border-red-500/40 shadow-red-500/5 shadow-2.5xl p-8 sm:p-10 z-10"
          >
            {/* Close Button */}
            <button
              id="admin-auth-modal-close"
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-all cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div id="admin-auth-modal-header" className="text-center mb-8">
              <Logo className="w-16 h-16 mx-auto mb-4 animate-pulse" />
              <h3 className="text-2xl font-black font-display text-slate-900 dark:text-white tracking-tight uppercase">
                Console d'Administration
              </h3>
              <p className="text-xs text-red-500 dark:text-red-400 mt-2 font-bold max-w-[280px] mx-auto leading-relaxed uppercase tracking-wider">
                Espace Strictement Réservé
              </p>
            </div>

            {/* Form */}
            <form id="admin-auth-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest pl-1.5">
                  Identifiant Administrateur
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                     <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  </span>
                  <input
                    id="admin-email-input"
                    type="email"
                    required
                    placeholder="admin@pingmanager.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#0c1524] border border-slate-200 dark:border-[#2a3548] focus:border-red-500 dark:focus:border-red-500 focus:bg-white dark:focus:bg-[#0d1729] text-slate-900 dark:text-white rounded-2xl font-semibold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-sm focus:ring-4 focus:ring-red-500/10 dark:focus:ring-red-500/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest pl-1.5">
                  Mot de passe sécurisé
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  </span>
                  <input
                    id="admin-password-input"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#0c1524] border border-slate-200 dark:border-[#2a3548] focus:border-red-500 dark:focus:border-red-500 focus:bg-white dark:focus:bg-[#0d1729] text-slate-900 dark:text-white rounded-2xl font-semibold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-sm focus:ring-4 focus:ring-red-500/10 dark:focus:ring-red-500/10"
                  />
                </div>
              </div>

              <button
                id="admin-login-submit"
                type="submit"
                disabled={loading}
                className="w-full h-12 flex items-center justify-center gap-2.5 mt-6 py-3 px-4 bg-red-650 hover:bg-red-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-red-500/10 hover:shadow-red-500/20 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Connexion en cours...' : 'Se connecter au système'}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-red-500/80 dark:text-red-400/80 font-bold leading-normal uppercase tracking-wider">
              La création d'accès admin est verrouillée.
            </div>

            {/* Helper info inside modal */}
            <div id="admin-auth-note" className="mt-6 p-4.5 bg-red-50/20 dark:bg-red-950/20 rounded-2.5xl border border-red-500/10 dark:border-red-500/20 text-[11px] text-slate-500 dark:text-slate-400 space-y-2">
              <p className="font-bold text-red-600 dark:text-red-400 flex items-center gap-2 uppercase tracking-wider">
                <Shield className="w-4 h-4 text-red-500 shrink-0" />
                Avertissement de sécurité
              </p>
              <p className="leading-relaxed">
                Toutes les tentatives de connexion et sessions d'administration sont auditées et journalisées sous contrôle de sécurité renforcé.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
