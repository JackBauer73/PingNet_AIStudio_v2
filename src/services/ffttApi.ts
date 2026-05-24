// Service de communication avec l'API FFTT via le proxy Supabase Edge Function
const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fftt-proxy`;
const ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Liste de licences de test en fallback local si la Edge Function n'est pas encore déployée
const LOCAL_DEMO_LICENCES: Record<string, any> = {
  "7512345": {
    licence: "7512345",
    nom: "DUPONT",
    prenom: "Jean",
    club: "PARIS 13 TT",
    numClub: "08750120",
    classement: 1250,
    mensuel: 1250,
    initial: 1200,
    categorie: "Senior",
    sexe: "M"
  },
  "8011223": {
    licence: "8011223",
    nom: "MARTIN",
    prenom: "Sophie",
    club: "AMIENS SPORT TENNIS DE TABLE",
    numClub: "07800001",
    classement: 850,
    mensuel: 850,
    initial: 800,
    categorie: "Cadette",
    sexe: "F"
  },
  "5944332": {
    licence: "5944332",
    nom: "LEFEBVRE",
    prenom: "Lucas",
    club: "LILLE METROPOLE TT",
    numClub: "07590050",
    classement: 1950,
    mensuel: 1950,
    initial: 1900,
    categorie: "Senior",
    sexe: "M"
  }
};

async function callProxy(params: Record<string, string>): Promise<unknown> {
  const url = new URL(PROXY_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`FFTT proxy error: ${res.status}`);
  }

  const json = await res.json() as { data?: unknown; error?: string };
  if (json.error) {
    throw new Error(json.error);
  }
  return json.data;
}

// ── Fiche joueur par numéro de licence ──
export async function fetchPlayerByLicence(licence: string) {
  const sanitized = licence.trim();
  try {
    const data = await callProxy({ action: 'joueur', licence: sanitized }) as any;
    return data;
  } catch (err) {
    console.warn("Échec de l'appel au proxy FFTT (Edge function non configurée ou indisponible), utilisation du fallback local de démonstration.", err);
    // En cas d'échec ou d'absence de configuration, on propose les licences locales de test pour ne pas bloquer le fonctionnement
    if (LOCAL_DEMO_LICENCES[sanitized]) {
      return LOCAL_DEMO_LICENCES[sanitized];
    }
    throw new Error("Licence introuvable ou service indisponible. En mode démo, essayez les licences : 7512345, 8011223 ou 5944332");
  }
}
