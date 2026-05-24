import { supabase } from '../supabase';

const SMS_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-player-sms`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface SendSmsParams {
  playerId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  parentPhone?: string | null;
  isMinor?: boolean;
  tempPassword?: string;
  dossard?: number;
}

export async function sendPlayerCredentials(params: SendSmsParams) {
  const generatedPassword = params.tempPassword || Math.random().toString(36).slice(-8);
  const targetPhone = params.isMinor && params.parentPhone ? params.parentPhone : params.phone;

  if (!targetPhone) {
    console.warn(`Aucun numéro de téléphone disponible pour envoyer les identifiants au joueur ${params.firstName} ${params.lastName}`);
    return { success: false, tempPassword: generatedPassword, reason: 'Aucun numéro de téléphone fourni' };
  }

  try {
    const response = await fetch(SMS_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({
        player_id: params.playerId,
        first_name: params.firstName,
        last_name: params.lastName,
        phone: targetPhone,
        is_minor: !!params.isMinor,
        parent_phone: params.parentPhone || null,
        temp_password: generatedPassword,
        dossard: params.dossard
      })
    });

    if (!response.ok) {
      throw new Error(`Erreur lors de l'envoi du SMS (status ${response.status})`);
    }

    const json = await response.json();
    return { success: true, tempPassword: generatedPassword, data: json };
  } catch (error: any) {
    console.warn(`Échec de l'envoi du SMS via l'Edge function (possiblement non configurée ou en démo local).`, error.message);
    // Retourne false sans jamais bloquer l'application ou le pointage
    return { success: false, tempPassword: generatedPassword, error: error.message };
  }
}
