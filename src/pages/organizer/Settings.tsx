import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';
import { Save, User, Building2, MapPin, Phone, Globe, Upload, BadgeHelp, Palette, Sparkles, Trophy } from 'lucide-react';
import { motion } from 'motion/react';

const CLUB_COLORS = [
  { name: 'Indigo Sport', value: 'indigo', class: 'bg-indigo-600 border-indigo-200 text-indigo-100 ring-indigo-500' },
  { name: 'Émeraude Vitesse', value: 'emerald', class: 'bg-emerald-600 border-emerald-200 text-emerald-100 ring-emerald-500' },
  { name: 'Rouge Smash', value: 'red', class: 'bg-red-600 border-red-200 text-red-100 ring-red-500' },
  { name: 'Bleu Royal', value: 'blue', class: 'bg-blue-600 border-blue-200 text-blue-100 ring-blue-500' },
  { name: 'Orange Énergie', value: 'orange', class: 'bg-orange-600 border-orange-200 text-orange-100 ring-orange-500' },
  { name: 'Violet Élite', value: 'purple', class: 'bg-purple-600 border-purple-200 text-purple-100 ring-purple-500' },
];

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  
  // Profil du club
  const [clubName, setClubName] = useState('');
  const [clubCity, setClubCity] = useState('');
  const [clubAddress, setClubAddress] = useState('');
  const [clubPhone, setClubPhone] = useState('');
  const [clubWebsite, setClubWebsite] = useState('');
  const [presidentName, setPresidentName] = useState('');
  const [clubColor, setClubColor] = useState('indigo');
  const [clubLogo, setClubLogo] = useState(''); // Contient le logo en Base64 ou URL

  useEffect(() => {
    async function getProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || '');
          
          // Récupération depuis la table SQL dédiée club_profiles
          let profileData = null;
          try {
            const { data, error } = await supabase
              .from('club_profiles')
              .select('*')
              .eq('id', user.id)
              .maybeSingle();
            
            if (!error && data) {
              profileData = data;
            }
          } catch (dbErr) {
            console.warn("La table 'club_profiles' n'est peut-être pas encore complètement accessible ou vide, utilisation du repli user_metadata.", dbErr);
          }

          if (profileData) {
            setClubName(profileData.club_name || '');
            setClubCity(profileData.club_city || '');
            setClubAddress(profileData.club_address || '');
            setClubPhone(profileData.club_phone || '');
            setClubWebsite(profileData.club_website || '');
            setPresidentName(profileData.president_name || '');
            setClubColor(profileData.club_color || 'indigo');
            setClubLogo(profileData.club_logo || '');

            if (profileData.club_name) localStorage.setItem('organizer_club_name', profileData.club_name);
            if (profileData.club_phone) localStorage.setItem('organizer_club_phone', profileData.club_phone);
            if (user.email) localStorage.setItem('organizer_club_email', user.email);
            localStorage.setItem('organizer_user_id', user.id);
          } else {
            // Repli historique sur l'utilisateur de session (sans surcharge inutile)
            const metadata = user.user_metadata || {};
            const cName = metadata.club_name || '';
            const cPhone = metadata.club_phone || '';
            setClubName(cName);
            setClubCity(metadata.club_city || '');
            setClubAddress(metadata.club_address || '');
            setClubPhone(cPhone);
            setClubWebsite(metadata.club_website || '');
            setPresidentName(metadata.president_name || '');
            setClubColor(metadata.club_color || 'indigo');
            setClubLogo(metadata.club_logo || '');

            if (cName) localStorage.setItem('organizer_club_name', cName);
            if (cPhone) localStorage.setItem('organizer_club_phone', cPhone);
            if (user.email) localStorage.setItem('organizer_club_email', user.email);
            localStorage.setItem('organizer_user_id', user.id);
          }
        }
      } catch (err) {
        console.error('Erreur générale de récupération du profil:', err);
      } finally {
        setLoading(false);
      }
    }
    getProfile();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 120;
        const MAX_HEIGHT = 120;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setClubLogo(compressedDataUrl);
          toast.success('Le logo a été chargé et optimisé avec succès (format vignette) ! N\'oubliez pas d\'enregistrer.');
        } else {
          toast.error("Erreur lors de l'optimisation de l'image.");
        }
      };
      img.onerror = () => {
        toast.error("Erreur lors du chargement de l'image.");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading('Sauvegarde en cours...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur déconnecté");

      // 1. Sauvegarde principale dans la table SQL dédiée club_profiles
      const { error: dbError } = await supabase
        .from('club_profiles')
        .upsert({
          id: user.id,
          club_name: clubName.trim(),
          club_city: clubCity.trim(),
          club_address: clubAddress.trim(),
          club_phone: clubPhone.trim(),
          club_website: clubWebsite.trim(),
          president_name: presidentName.trim(),
          club_color: clubColor,
          club_logo: clubLogo, // base64 d'image vignette
          updated_at: new Date().toISOString()
        });

      if (dbError) {
        console.error("Erreur d'écriture dans la table SQL club_profiles :", dbError);
        throw new Error("Impossible d'écrire dans la base SQL : " + dbError.message);
      }

      // 2. Sauvegarde allégée complémentaire dans l'authentification (sans le LOGO lourd pour éviter bloquer les Jetons de session)
      try {
        await supabase.auth.updateUser({
          data: {
            club_name: clubName.trim(),
            club_city: clubCity.trim(),
            club_address: clubAddress.trim(),
            club_phone: clubPhone.trim(),
            club_website: clubWebsite.trim(),
            president_name: presidentName.trim(),
            club_color: clubColor,
            // Surtout pas de logo base64 lourd ici
          }
        });
      } catch (authError) {
        console.warn("Mise à jour secondaire des métadonnées utilisateur passée en second plan:", authError);
      }

      localStorage.setItem('organizer_club_name', clubName.trim());
      localStorage.setItem('organizer_club_phone', clubPhone.trim());
      localStorage.setItem('organizer_club_email', userEmail);
      localStorage.setItem('organizer_user_id', user.id);

      toast.success('Profil du club enregistré avec succès dans la base de données !', { id: toastId });
    } catch (err: any) {
      console.error("Détail de l'erreur détectée lors de la sauvegarde du profil:", err);
      const isMissingColumn = err.message && (
        err.message.includes('column') || 
        err.message.includes('club_address') || 
        err.message.includes('club_profiles') ||
        err.message.includes('cache')
      );
      
      if (isMissingColumn) {
        toast.error("⚠️ Des colonnes SQL sont manquantes ou obsolètes dans 'club_profiles' !", { id: toastId, duration: 8000 });
        setTimeout(() => {
          alert(
            "⚠️ ERREUR : La structure de votre table 'club_profiles' n'est pas à jour.\n\n" +
            "Pour corriger ce problème instantanément, copiez-collez et exécutez ce code SQL dans votre éditeur de requêtes Supabase (SQL Editor) :\n\n" +
            "ALTER TABLE public.club_profiles ADD COLUMN IF NOT EXISTS club_address TEXT;\n" +
            "ALTER TABLE public.club_profiles ADD COLUMN IF NOT EXISTS club_city TEXT;\n" +
            "ALTER TABLE public.club_profiles ADD COLUMN IF NOT EXISTS club_phone TEXT;\n" +
            "ALTER TABLE public.club_profiles ADD COLUMN IF NOT EXISTS club_website TEXT;\n" +
            "ALTER TABLE public.club_profiles ADD COLUMN IF NOT EXISTS president_name TEXT;\n" +
            "ALTER TABLE public.club_profiles ADD COLUMN IF NOT EXISTS club_color TEXT DEFAULT 'indigo';\n" +
            "ALTER TABLE public.club_profiles ADD COLUMN IF NOT EXISTS club_logo TEXT;\n" +
            "NOTIFY pgrst, 'reload schema';\n\n" +
            "Après exécution du script SQL, cliquez à nouveau sur 'Enregistrer' !"
          );
        }, 500);
      } else {
        toast.error(err.message || 'Erreur lors de la sauvegarde du profil', { id: toastId });
      }
    } finally {
      setSaving(false);
    }
  };

  // Trouver la couleur sélectionnée
  const selectedColorObj = CLUB_COLORS.find(c => c.value === clubColor) || CLUB_COLORS[0];

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 animate-pulse flex flex-col items-center justify-center min-h-[50vh]" id="settings-loading">
        <div className="w-12 h-12 rounded-full border-4 border-[#20324e] border-t-[#f97316] animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Chargement des informations du club...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto" id="settings-club-profile">
      {/* Header */}
      <div className="mb-10 animate-fade-in">
        <h1 className="text-3xl font-black tracking-tight text-white border-l-4 border-[#f97316] pl-4">
          Profil de votre Club
        </h1>
        <p className="text-slate-400 mt-2 pl-4 text-sm font-semibold">
          Personnalisez la charte graphique et les informations officielles de votre club de Tennis de Table.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulaire des paramètres du Club */}
        <div className="lg:col-span-2 space-y-8">
          <form onSubmit={handleSaveProfile} className="space-y-8">
            
            {/* Section 1 : Identité & Charte */}
            <div className="bg-[#152031] rounded-[2rem] border border-[#2a3548] shadow-2xl p-8 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <Building2 className="w-5 h-5 text-[#f97316]" />
                Identité Visuelle & Logo
              </h2>

              <div className="flex flex-col sm:flex-row items-center gap-6 p-5 bg-[#0e1726]/50 border border-[#20324e] rounded-2xl">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl bg-[#0e1726] border-2 border-dashed border-[#20324e] hover:border-[#f97316]/50 flex flex-col items-center justify-center overflow-hidden relative transition-all">
                    {clubLogo ? (
                      <img src={clubLogo} alt="Logo du Club" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-500 group-hover:text-[#f97316] transition-colors">
                        <Upload className="w-6 h-6 mb-1" />
                        <span className="text-[8px] font-bold text-center uppercase tracking-wider px-1">Upload Logo</span>
                      </div>
                    )}
                  </div>
                  <label className="absolute -bottom-1 -right-1 bg-[#f97316] text-[#081425] hover:bg-[#ea580c] p-1.5 rounded-lg cursor-pointer shadow-lg transition-all scale-95 hover:scale-100 border border-[#0c1624]">
                    <Upload className="w-3.5 h-3.5 font-bold" />
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Logo officiel</span>
                  <p className="text-sm text-slate-300 leading-relaxed mb-2">
                    Téléchargez un logo (PNG, JPG) pour représenter votre club sur les affiches, les interfaces de scoring et le site.
                  </p>
                  <p className="text-xs text-slate-500">Le logo est automatiquement recadré et compressé au format vignette pour optimiser l'envoi réseau.</p>
                </div>
              </div>

              {/* Palette couleur d'identité */}
              <div>
                <label className="block text-xs font-bold text-slate-450 uppercase tracking-widest mb-3 ml-1 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-400" /> Couleur principale du club
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {CLUB_COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setClubColor(color.value)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                        clubColor === color.value 
                          ? 'border-[#f97316] bg-[#0e1726]/80 ring-2 ring-[#f97316]/30 font-black text-white' 
                          : 'border-[#20324e] bg-[#0e1726]/30 text-slate-400 hover:bg-[#0e1726]/60 hover:border-slate-500'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full mb-1 border-2 border-[#0c1624] shadow-sm ${
                        color.value === 'indigo' ? 'bg-indigo-600' :
                        color.value === 'emerald' ? 'bg-emerald-500' :
                        color.value === 'red' ? 'bg-red-500' :
                        color.value === 'blue' ? 'bg-blue-600' :
                        color.value === 'orange' ? 'bg-[#f97316]' :
                        color.value === 'purple' ? 'bg-purple-500' : 'bg-slate-400'
                      }`} />
                      <span className="text-[10px] text-slate-400 truncate w-full mt-1 font-semibold">{color.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 2 : Coordonnées Officielles */}
            <div className="bg-[#152031] rounded-[2rem] border border-[#2a3548] shadow-2xl p-8 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <User className="w-5 h-5 text-[#f97316]" />
                Informations Administratives
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1"> Nom du Club </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tennis de Table Club Parisien"
                    className="w-full px-4 py-3 bg-[#0e1726] border border-[#20324e] rounded-xl focus:ring-2 focus:ring-[#f97316]/50 focus:border-[#f97316] outline-none transition-all text-white font-semibold"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1"> Président / Responsable </label>
                  <input
                    type="text"
                    placeholder="Ex: Jean Dupont"
                    className="w-full px-4 py-3 bg-[#0e1726] border border-[#20324e] rounded-xl focus:ring-2 focus:ring-[#f97316]/50 focus:border-[#f97316] outline-none transition-all text-white"
                    value={presidentName}
                    onChange={(e) => setPresidentName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1"> Ville du Club </label>
                  <input
                    type="text"
                    placeholder="Ex: Paris"
                    className="w-full px-4 py-3 bg-[#0e1726] border border-[#20324e] rounded-xl focus:ring-2 focus:ring-[#f97316]/50 focus:border-[#f97316] outline-none transition-all text-white"
                    value={clubCity}
                    onChange={(e) => setClubCity(e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#f97316]" /> Adresse de la salle de Ping-Pong
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 12 Rue des Rackets, 75012 Paris"
                    className="w-full px-4 py-3 bg-[#0e1726] border border-[#20324e] rounded-xl focus:ring-2 focus:ring-[#f97316]/50 focus:border-[#f97316] outline-none transition-all text-white"
                    value={clubAddress}
                    onChange={(e) => setClubAddress(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Téléphone de contact
                  </label>
                  <input
                    type="tel"
                    placeholder="Ex: 01 23 45 67 89"
                    className="w-full px-4 py-3 bg-[#0e1726] border border-[#20324e] rounded-xl focus:ring-2 focus:ring-[#f97316]/50 focus:border-[#f97316] outline-none transition-all text-white"
                    value={clubPhone}
                    onChange={(e) => setClubPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" /> Site Internet / Page Facebook
                  </label>
                  <input
                    type="url"
                    placeholder="Ex: https://www.ttclubparis.fr"
                    className="w-full px-4 py-3 bg-[#0e1726] border border-[#20324e] rounded-xl focus:ring-2 focus:ring-[#f97316]/50 focus:border-[#f97316] outline-none transition-all text-white"
                    value={clubWebsite}
                    onChange={(e) => setClubWebsite(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Bouton Enregistrer */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || !clubName.trim()}
                className="flex items-center gap-2 px-8 py-4 bg-[#f97316] text-[#081425] rounded-2xl font-black hover:bg-[#ea580c] active:scale-95 transition-all shadow-lg shadow-[#ea580c]/25 disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-sm"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Sauvegarde...' : 'Enregistrer le Profil'}
              </button>
            </div>

          </form>
        </div>

        {/* Colonne de droite : Aperçu Card du Club "Ping Ident" */}
        <div className="lg:col-span-1 space-y-6">
          <div className="sticky top-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3 ml-1">Aperçu en Temps Réel</span>
            
            <div className="bg-[#152031] text-white rounded-[2rem] p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[320px] border border-[#2a3548]">
              
              {/* Blur accent color effect in the card card */}
              <div 
                className={`absolute -top-10 -right-10 w-44 h-44 rounded-full blur-3xl opacity-20 transition-all duration-500 ${
                  clubColor === 'indigo' ? 'bg-indigo-500' :
                  clubColor === 'emerald' ? 'bg-emerald-500' :
                  clubColor === 'red' ? 'bg-red-500' :
                  clubColor === 'blue' ? 'bg-blue-500' :
                  clubColor === 'orange' ? 'bg-[#f97316]' :
                  clubColor === 'purple' ? 'bg-purple-500' : ''
                }`} 
              />

              {/* Top part */}
              <div className="relative z-10 flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black tracking-widest uppercase bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20 px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
                    <Sparkles className="w-3 h-3 fill-current" /> CLUB OFFICIEL
                  </span>
                  <h3 className="text-xl font-bold truncate max-w-[170px] mt-2">
                    {clubName || "Nom de votre Club"}
                  </h3>
                  <p className="text-xs text-slate-400 block font-mono">
                    ID: {userEmail ? userEmail.split('@')[0].toUpperCase() : 'CLUB'}
                  </p>
                </div>

                <div className="w-14 h-14 rounded-2xl bg-[#0e1726]/80 flex items-center justify-center overflow-hidden border border-[#20324e]">
                  {clubLogo ? (
                    <img src={clubLogo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Trophy className="w-7 h-7 text-[#f97316]" />
                  )}
                </div>
              </div>

              {/* Middle/Bottom Card details */}
              <div className="relative z-10 pt-12 space-y-4">
                <div className="flex gap-4 border-t border-[#20324e] pt-4 text-xs font-mono">
                  <div className="flex-1">
                    <span className="text-slate-400 block text-[10px] font-bold">VILLE</span>
                    <span className="text-white font-black uppercase text-sm mt-1 block">{clubCity || "PARIS"}</span>
                  </div>
                  <div className="flex-1 border-l border-[#20324e] pl-4">
                    <span className="text-slate-400 block text-[10px] font-bold">RESPONSABLE</span>
                    <span className="text-white font-black mt-1 block truncate max-w-[130px]" title={presidentName}>
                      {presidentName || <span className="text-slate-500 italic font-medium">Non renseigné</span>}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 bg-[#0e1726]/60 p-3.5 rounded-xl border border-[#20324e]/60 text-xs text-slate-300">
                  <p className="truncate flex items-center gap-2 font-mono">
                    <MapPin className="w-4 h-4 text-[#f97316] flex-shrink-0" />
                    <span className="truncate">{clubAddress || "Adresse de la salle physique"}</span>
                  </p>
                  <p className="truncate flex items-center gap-2 font-mono">
                    <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{clubPhone || "Aucun téléphone renseigné"}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Note sur les configurations */}
            <div className="p-5 bg-[#111c2d] rounded-2xl border border-[#20324e] text-xs text-slate-400 mt-6 space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-slate-200">
                <BadgeHelp className="w-4 h-4 text-[#f97316]" />
                Où s'affichent ces données ?
              </p>
              <p className="leading-relaxed">
                Le nom du club, le logo et la couleur d'identité sont diffusés en direct sur l'interface publique d'auto-arbitrage de chaque table (que les joueurs scannent via le QR code) ainsi que dans vos supports d'impression.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
