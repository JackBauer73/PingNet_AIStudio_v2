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
          const metadata = user.user_metadata || {};
          setClubName(metadata.club_name || '');
          setClubCity(metadata.club_city || '');
          setClubAddress(metadata.club_address || '');
          setClubPhone(metadata.club_phone || '');
          setClubWebsite(metadata.club_website || '');
          setPresidentName(metadata.president_name || '');
          setClubColor(metadata.club_color || 'indigo');
          setClubLogo(metadata.club_logo || '');
        }
      } catch (err) {
        console.error('Erreur de récupération du profil:', err);
      } finally {
        setLoading(false);
      }
    }
    getProfile();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // Limit to ~800KB for easy metadata storage
      toast.error("L'image est trop lourde. Veuillez choisir une image de moins de 800 Ko.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setClubLogo(reader.result as string);
      toast.success('Le logo a été chargé localement ! N\'oubliez pas d\'enregistrer.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading('Sauvegarde en cours...');

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          club_name: clubName.trim(),
          club_city: clubCity.trim(),
          club_address: clubAddress.trim(),
          club_phone: clubPhone.trim(),
          club_website: clubWebsite.trim(),
          president_name: presidentName.trim(),
          club_color: clubColor,
          club_logo: clubLogo // base64
        }
      });

      if (error) throw error;
      toast.success('Profil du club mis à jour avec succès !', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la sauvegarde du profil', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  // Trouver la couleur sélectionnée
  const selectedColorObj = CLUB_COLORS.find(c => c.value === clubColor) || CLUB_COLORS[0];

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 animate-pulse flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin mb-4" />
        <p>Chargement des informations du club...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto" id="settings-club-profile">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 border-l-4 border-indigo-500 pl-4">
          Profil de votre Club
        </h1>
        <p className="text-slate-500 mt-2 pl-4">
          Personnalisez la charte graphique et les informations officielles de votre club de Tennis de Table.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulaire des paramètres du Club */}
        <div className="lg:col-span-2 space-y-8">
          <form onSubmit={handleSaveProfile} className="space-y-8">
            
            {/* Section 1 : Identité & Charte */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <Building2 className="w-5 h-5 text-indigo-500" />
                Identité Visuelle & Logo
              </h2>

              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 rounded-2xl">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden relative">
                    {clubLogo ? (
                      <img src={clubLogo} alt="Logo du Club" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Trophy className="w-10 h-10 text-slate-400" />
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl cursor-pointer shadow-lg transition-all scale-95 hover:scale-100">
                    <Upload className="w-4 h-4" />
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Logo officiel</span>
                  <p className="text-sm text-slate-600 leading-relaxed mb-2">
                    Téléchargez un logo (PNG, JPG) pour représenter votre club sur les affiches, les interfaces de scoring et le site.
                  </p>
                  <p className="text-xs text-slate-400">Recommandé : image carrée, max. 500 Ko.</p>
                </div>
              </div>

              {/* Palette couleur d'identité */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-slate-400" /> Couleur principale du club
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {CLUB_COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setClubColor(color.value)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                        clubColor === color.value 
                          ? 'border-indigo-600 ring-2 ring-offset-2 ring-indigo-500 font-bold bg-slate-50' 
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full mb-1 bg-${color.value}-600 ${color.value === 'indigo' ? 'bg-indigo-600' : ''} ${color.value === 'emerald' ? 'bg-emerald-600' : ''} ${color.value === 'red' ? 'bg-red-600' : ''} ${color.value === 'blue' ? 'bg-blue-600' : ''} ${color.value === 'orange' ? 'bg-orange-600' : ''} ${color.value === 'purple' ? 'bg-purple-600' : ''}`} />
                      <span className="text-[10px] text-slate-500 truncate w-full">{color.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 2 : Coordonnées Officielles */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <User className="w-5 h-5 text-indigo-500" />
                Informations Administratives
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1"> Nom du Club </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tennis de Table Club Parisien"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-900 font-semibold"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1"> Président / Responsable </label>
                  <input
                    type="text"
                    placeholder="Ex: Jean Dupont"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-900"
                    value={presidentName}
                    onChange={(e) => setPresidentName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1"> Ville du Club </label>
                  <input
                    type="text"
                    placeholder="Ex: Paris"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-900"
                    value={clubCity}
                    onChange={(e) => setClubCity(e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> Adresse de la salle de Ping-Pong
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 12 Rue des Rackets, 75012 Paris"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-900"
                    value={clubAddress}
                    onChange={(e) => setClubAddress(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Téléphone de contact
                  </label>
                  <input
                    type="tel"
                    placeholder="Ex: 01 23 45 67 89"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-900"
                    value={clubPhone}
                    onChange={(e) => setClubPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-slate-400" /> Site Internet / Page Facebook
                  </label>
                  <input
                    type="url"
                    placeholder="Ex: https://www.ttclubparis.fr"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-900"
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
                className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:pointer-events-none"
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
            
            <div className="bg-slate-900 text-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[320px] border border-slate-800">
              
              {/* Blur accent color effect in the card card */}
              <div 
                className={`absolute -top-10 -right-10 w-44 h-44 rounded-full blur-3xl opacity-30 transition-all duration-500 ${
                  clubColor === 'indigo' ? 'bg-indigo-500' : ''
                } ${
                  clubColor === 'emerald' ? 'bg-emerald-500' : ''
                } ${
                  clubColor === 'red' ? 'bg-red-500' : ''
                } ${
                  clubColor === 'blue' ? 'bg-blue-500' : ''
                } ${
                  clubColor === 'orange' ? 'bg-orange-500' : ''
                } ${
                  clubColor === 'purple' ? 'bg-purple-500' : ''
                }`} 
              />

              {/* Top part */}
              <div className="relative z-10 flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black tracking-widest uppercase bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
                    <Sparkles className="w-3 h-3" /> CLUB OFFICIEL
                  </span>
                  <h3 className="text-xl font-bold truncate max-w-[170px] mt-2">
                    {clubName || "Nom de votre Club"}
                  </h3>
                  <p className="text-xs text-slate-400 block font-mono">
                    ID: {userEmail ? userEmail.split('@')[0].toUpperCase() : 'CLUB'}
                  </p>
                </div>

                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center overflow-hidden">
                  {clubLogo ? (
                    <img src={clubLogo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Trophy className="w-7 h-7 text-indigo-400" />
                  )}
                </div>
              </div>

              {/* Middle/Bottom Card details */}
              <div className="relative z-10 pt-12 space-y-4">
                <div className="flex gap-4 border-t border-slate-800/80 pt-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block">VILLE</span>
                    <span className="text-white font-bold">{clubCity || "Non renseigné"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">RESPONSABLE</span>
                    <span className="text-white font-bold truncate max-w-[100px] block">{presidentName || "Non renseigné"}</span>
                  </div>
                </div>

                <div className="space-y-1 bg-white/5 p-3 rounded-xl border border-white-[5%] text-xs text-slate-300">
                  <p className="truncate flex items-center gap-1.5 font-mono">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    {clubAddress || "Adresse de la salle physique"}
                  </p>
                  <p className="truncate flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    {clubPhone || "Aucun téléphone renseigné"}
                  </p>
                </div>
              </div>
            </div>

            {/* Note sur les configurations */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 mt-6 space-y-2">
              <p className="font-bold flex items-center gap-1 text-slate-700">
                <BadgeHelp className="w-4 h-4 text-indigo-500" />
                Où s'affichent ces données ?
              </p>
              <p>
                Le nom du club, le logo et la couleur d'identité sont diffusés en direct sur l'interface publique d'auto-arbitrage de chaque table (que les joueurs scannent via le QR code) ainsi que dans vos supports d'impression.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
