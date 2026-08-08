import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Shield, 
  User, 
  RefreshCw, 
  ShieldAlert, 
  ArrowUpCircle, 
  ArrowDownCircle,
  Copy,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../supabase';

interface ProfileItem {
  id: string;
  email: string | null;
  role: 'organizer' | 'admin';
  created_at: string;
}

export default function AdminOrganizers() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Script SQL de la spécification à afficher si la table profiles ou RLS manque
  const setupSQL = `-- Créez la table profiles dans votre console Supabase :
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'organizer' check (role in ('organizer','admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "Read own or admin reads all" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "Admin updates roles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email)
  select id, email from auth.users on conflict (id) do nothing;

update public.profiles set role = 'admin' where email = 'vandamme.vince73@gmail.com';`;

  const loadProfiles = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserEmail(user.email || null);
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Si la table n'existe pas, gérer gracieusement sans crasher
        if (error.code === '42P01') {
          setTableMissing(true);
        } else {
          throw error;
        }
      } else {
        setTableMissing(false);
        setProfiles(data as ProfileItem[] || []);
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des profils d\'organisateurs:', err);
      toast.error('Erreur lors de la récupération des profils.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleUpdateRole = async (targetProfile: ProfileItem, newRole: 'organizer' | 'admin') => {
    const { id, email, role } = targetProfile;

    // Garde-fou 1 : empêcher de se rétrograder soi-même si c'est le dernier admin
    if (email === currentUserEmail) {
      const adminsCount = profiles.filter(p => p.role === 'admin').length;
      if (adminsCount <= 1 && newRole === 'organizer') {
        toast.error('Garde-fou UI : Vous ne pouvez pas vous rétrograder car vous êtes le dernier admin !');
        return;
      }
      if (!window.confirm('Voulez-vous vraiment vous rétrograder vous-même ? Vous n\'aurez plus accès à cette console.')) {
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Le rôle de ${email || 'l\'utilisateur'} est désormais : ${newRole} ✓`);
      loadProfiles(true);
    } catch (err: any) {
      console.error('Erreur modification rôle:', err);
      toast.error('Impossible de mettre à jour le rôle (Avez-vous exécuté le script SQL avec les politiques RLS ?).');
    }
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(setupSQL);
    setCopied(true);
    toast.success('Script SQL copié dans le presse-papiers !');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 select-none">
      {/* En-tête de la page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1b2b41] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[#f97316] text-[10px] uppercase font-black tracking-widest bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-lg w-max mb-2">
            Superadmin
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            Gestion des Rôles Organisateurs
          </h1>
          <p className="text-xs text-slate-450 mt-1">
            Gérer les privilèges d’accès club (Organisateur) et d’administration globale (Admin).
          </p>
        </div>

        <button
          onClick={() => loadProfiles(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#152031] border border-[#2a3548] text-xs font-bold rounded-lg hover:border-slate-550 transition-all cursor-pointer disabled:opacity-50 text-white self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#f97316] ${refreshing ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : tableMissing ? (
        /* Message préventif si la table "profiles" n'a pas été provisionnée sur Supabase */
        <div className="bg-[#101927] border border-orange-550/20 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-500/10 text-[#f97316] rounded-xl shrink-0 border border-orange-500/10">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Table d'autorisations « Profiles » absente</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                La table <code className="bg-slate-950 font-mono px-1.5 py-0.5 rounded text-orange-400">profiles</code> ou les fonctions associées n'ont pas encore été définies sur votre base de données Supabase.
                Veuillez copier et exécuter le script SQL suivant dans la console SQL de votre tableau de bord Supabase pour activer la gestion des rôles.
              </p>
            </div>
          </div>

          <div className="relative bg-slate-950 border border-[#223146] rounded-xl overflow-hidden font-mono text-[10px] text-slate-350 p-4 max-h-[250px] overflow-y-auto">
            <button
              onClick={handleCopySQL}
              className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1.5 bg-[#152031] border border-[#2a3548] text-white hover:bg-slate-800 rounded-md transition text-[9px] cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
              {copied ? 'Copié' : 'Copier'}
            </button>
            <pre className="whitespace-pre-wrap">{setupSQL}</pre>
          </div>
        </div>
      ) : (
        <div className="bg-[#101927] border border-[#223146] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[#223146] flex items-center gap-3">
            <Users className="w-5 h-5 text-[#f97316]" />
            <h3 className="font-extrabold text-sm text-white">Listes des comptes organisateurs ({profiles.length})</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#223146] bg-[#0c1624] text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">
                  <th className="py-4 px-6 md:w-1/2">Adresse e-mail du compte</th>
                  <th className="py-4 px-6 text-center">Rôle actuel</th>
                  <th className="py-4 px-6 text-center">Date d'inscription</th>
                  <th className="py-4 px-6 text-right">Actions sur les rôles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#223146]/50">
                {profiles.map((profile) => {
                  const isSelf = profile.email === currentUserEmail;
                  const registerDateStr = new Date(profile.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });

                  return (
                    <tr key={profile.id} className="hover:bg-[#121d2d]/30 transition text-xs font-semibold text-slate-200">
                      <td className="py-4 px-6 select-all flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 shadow uppercase ${
                          profile.role === 'admin' ? 'bg-orange-500/10 text-[#f97316]' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {profile.email ? profile.email.charAt(0) : 'U'}
                        </div>
                        <div className="min-w-0">
                          <span className="truncate block font-bold text-white max-w-xs md:max-w-lg" title={profile.email || ''}>
                            {profile.email || 'Pas d\'adresse email'}
                          </span>
                          {isSelf && (
                            <span className="text-[9px] font-black uppercase text-[#f97316] bg-orange-500/10 border border-orange-500/10 px-1.5 py-0.2 rounded-full mt-0.5 inline-block">
                              Votre compte
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-6 text-center">
                        <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md ${
                          profile.role === 'admin' 
                            ? 'bg-orange-500/10 text-[#f97316] border border-orange-500/20' 
                            : 'bg-slate-800/60 text-slate-400'
                        }`}>
                          {profile.role === 'admin' ? '🛡️ Admin' : '👥 Organisateur'}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-slate-400 font-medium font-mono text-[11px] text-center">
                        {registerDateStr}
                      </td>

                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {profile.role === 'organizer' ? (
                            <button
                              id={`promote-btn-${profile.id}`}
                              onClick={() => handleUpdateRole(profile, 'admin')}
                              className="flex items-center gap-1 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider bg-orange-500/10 hover:bg-[#f97316] text-[#f97316] hover:text-white rounded-lg transition-all cursor-pointer border border-orange-500/20 hover:border-transparent"
                            >
                              <ArrowUpCircle className="w-3.5 h-3.5" /> Promouvoir Admin
                            </button>
                          ) : (
                            <button
                              id={`demote-btn-${profile.id}`}
                              onClick={() => handleUpdateRole(profile, 'organizer')}
                              className="flex items-center gap-1 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white rounded-lg transition-all cursor-pointer border border-[#223146]"
                            >
                              <ArrowDownCircle className="w-3.5 h-3.5" /> Rétrograder Club
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
