import { supabase } from '../supabase';

export async function sendPlayerInvite(registrationId: string) {
  const { data: reg, error } = await supabase
    .from('registrations')
    .select('*, players(first_name, last_name)')
    .eq('id', registrationId)
    .single();

  if (error || !reg) throw new Error('Inscription introuvable.');

  const token = crypto.randomUUID();
  const tokenExp = new Date();
  tokenExp.setDate(tokenExp.getDate() + 1); // Valid until tomorrow

  const { error: updateError } = await supabase
    .from('registrations')
    .update({
      player_token: token,
      player_token_exp: tokenExp.toISOString(),
    })
    .eq('id', registrationId);

  if (updateError) throw updateError;

  const origin = window.location.origin;
  const magicLink = `${origin}/player/auth?token=${token}`;
  console.log(`[Magic Link generated] ${reg.players?.first_name} ${reg.players?.last_name}: ${magicLink}`);
  return { token, magicLink };
}

export async function resendPlayerLink(email: string, tournamentId: string) {
  const { data: reg, error } = await supabase
    .from('registrations')
    .select('*, players(first_name, last_name)')
    .eq('email', email)
    .eq('tournament_id', tournamentId)
    .maybeSingle();

  if (error || !reg) throw new Error('Inscription introuvable avec cette adresse email pour ce tournoi.');

  const token = reg.player_token || crypto.randomUUID();
  const tokenExp = new Date();
  tokenExp.setDate(tokenExp.getDate() + 1);

  const { error: updateErr } = await supabase
    .from('registrations')
    .update({
      player_token: token,
      player_token_exp: tokenExp.toISOString(),
    })
    .eq('id', reg.id);

  if (updateErr) throw updateErr;

  const origin = window.location.origin;
  const magicLink = `${origin}/player/auth?token=${token}`;
  return { token, magicLink };
}
