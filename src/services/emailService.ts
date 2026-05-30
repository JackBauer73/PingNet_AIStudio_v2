import { supabase } from '../supabase';

const EMAIL_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-player-email`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface SendEmailParams {
  playerId: string;
  firstName: string;
  lastName: string;
  email: string;
  token: string;
  tournamentName: string;
  directUrl: string;
  dossard?: number;
}

export async function sendPlayerEmail(params: SendEmailParams) {
  if (!params.email) {
    console.warn(`Aucune adresse e-mail disponible pour envoyer les identifiants au joueur ${params.firstName} ${params.lastName}`);
    return { success: false, reason: 'Aucune adresse e-mail fournie' };
  }

  try {
    const response = await fetch(EMAIL_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({
        player_id: params.playerId,
        first_name: params.firstName,
        last_name: params.lastName,
        email: params.email,
        token: params.token,
        tournament_name: params.tournamentName,
        direct_url: params.directUrl,
        dossard: params.dossard || null
      })
    });

    if (!response.ok) {
      throw new Error(`Erreur lors de l'envoi de l'e-mail (status ${response.status})`);
    }

    const json = await response.json();
    return { success: true, data: json };
  } catch (error: any) {
    console.warn(`Échec de l'envoi de l'e-mail via l'Edge function (possiblement non configurée).`, error.message);
    return { success: false, error: error.message };
  }
}
