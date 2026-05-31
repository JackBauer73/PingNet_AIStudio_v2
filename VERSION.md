# Version History - Ping Manager

This document keeps track of all released versions and updates of Ping Manager, adhering strictly to **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH`.

## Configuration active
- **Version actuelle :** `0.10.0`
- **Statut :** Pointage et QR Codes individualisés par journée du tournoi dans l'Espace Joueur pour éviter le pointage involontaire des jours futurs.
- **Date :** 2026-05-31

---

## Règles de Versionning (Semantic Versioning)
1. **MAJOR (X._._)** : Changement majeur entraînant des ruptures de compatibilité (ex: migration lourde de base de données sans rétrocompatibilité, modification structurelle complète des rôles).
2. **MINOR (_.X._)** : Ajout de fonctionnalités nouvelles sans casser l’existant (ex: nouveaux rapports d'arbitrage, intégration de capteurs de score, filtres avenants).
3. **PATCH (_._.X)** : Corrections de bugs mineurs, améliorations visuelles ou textuelles mineures (ex: modification d'une coquille, ajustement d’un espacement CSS, renommage d'un menu).

---

## Historique des versions

### v0.10.0 (2026-05-31) - *Version Actuelle*
Pointage et QR Codes spécifiques par journée :
1. **QR Codes de pointage par Journée :** Dans l'Espace Joueur, le joueur dispose désormais d'un QR code distinct pour chaque journée de tournoi où il a au moins un tableau. Les codes d'embarquement intègrent le paramètre de requête `?day=X`.
2. **Scan intelligent restrictif (Jour J uniquement) :** Lorsque l'organisateur scanne à l'accueil via l'appareil de pointage de la Journée X, le scanneur n'émerge et ne valide **uniquement** que ses catégories de la Journée X. Les inscriptions des journées futures (comme la Journée Y où le joueur n'est peut-être pas présent) restent sagement non pointées.
3. **Pavage transparent et intuitif :** Des onglets fluides et réactifs permettent d'interchanger instantanément de QR Code dans l'Espace Joueur.

### v0.9.4 (2026-05-31)
Nettoyage automatique des comptes joueurs sans inscriptions :
1. **Suppression sécurisée du profil :** Lors de la suppression d'une inscription de série du joueur, le système vérifie s'il reste d'autres séries d'inscrites pour ce joueur sur l'ensemble du tournoi.
2. **Nettoyage des tables orphelines :** Si c'est sa dernière inscription (tous jours confondus), le profil physique du joueur (table `players`) ainsi que son jeton joueur (`player_tokens`) sont automatiquement supprimés de la base de données.
3. **Retour visuel clair :** Un message de notification confirme à l'administrateur que le joueur a été intégralement retiré du tournoi.

### v0.9.3 (2026-05-30)
Contrôles d'ajustement interactifs pour l'impression des QR Codes :
1. **Sélecteurs interactifs en temps réel :** Ajout de boutons d'incrémentation/décrémentation en haut de la page `PrintQR.tsx` permettant à l'organisateur de forcer le nombre de journées (de 1 à 10) et de tables (de 0 à 60).
2. **Flexibilité accrue :** Résolution définitive du blocage si le tournoi a été configuré sans dates de fin valides ou si le nombre de tables en base de données ne correspond pas à l'installation réelle.

### v0.9.2 (2026-05-30)
Amélioration de la génération des QR codes multi-jours :
1. **Génération QR par jour réel :** Calcul dynamique du nombre total de jours réels selon les dates du tournoi (`date` et `end_date`), combiné aux journées déclarées sur les catégories.
2. **Garantie d'impression :** Assure qu'un QR code unique imprimable A4 d'accueil est généré pour chaque jour du tournoi, même si aucun tableau n'est encore configuré pour ce jour spécifique.

### v0.9.1 (2026-05-30)
Résolution des erreurs de routage sur collage d'URL :
1. **Nettoyage Robuste de l'Input Jeton :** Extraction automatique du token brut lorsque le joueur saisit ou colle une URL complète (qu'il s'agisse de `/player/xxx`, `?token=xxx` ou contenant des paramètres ou ancres).
2. **Compatibilité de Redirection :** Nettoyage identique lors des redirections de premier niveau si un lien de type ancien `?token=URL` est transmis par erreur au point d'entrée `/`.

### v0.9.0 (2026-05-30)
Ajout du Pointage Club sécurisé par QR Code et par Journée :
1. **QR Code par Journée :** Intégration dans `PrintQR.tsx` d'un QR d'accueil imprimable de taille A4 par journée de compétition, listant les tableaux associés du jour.
2. **Interface Pointage Club (`/organizer/checkin-scan/:dayNumber`) :** Création d'une interface sécurisée mobile-first permettant aux organisateurs de scanner le QR code d'un joueur, d'obtenir sa fiche profil et ses inscriptions du jour, et d'enregistrer d'un clic sa présence (checked_in) avec attribution automatique du dossard. Saisie manuelle de jetons disponible en secours.
3. **Intégration d'accès rapide :** Bouton "Scanner QR" ajouté directement dans le bandeau supérieur de l'espace d'administration des joueurs (`Players.tsx`).
4. **Nettoyage auto-checkin :** Suppression définitive du pointage automatique autonome par le joueur à l'ouverture du lien pour garantir que seuls les bénévoles/organisateurs du club valident la présence au gymnase.

### v0.8.0 (2026-05-30)
Création d'une page dédiée "Espace Joueur" sécurisée par jeton (`/player/:token`) :
1. **Nouvelle architecture `/player/:token` :** Page publique autonome, isolée de l'administration, conçue mobile-first (responsive) avec animations fluides (`motion/react`) et design aux couleurs institutionnelles.
2. **Suivi Live des Matchs & Poules :** Chargement en temps réel des informations du joueur, de ses inscriptions, des groupes de poules (avec mise en évidence), des matchs à venir avec affichage des tables, et résultats des tournois (sets et brackets traduits).
3. **Mise à jour Realtime Supabase :** Abonnement aux canaux PostgreSQL pour rafraîchir dynamiquement les tableaux et les rencontres sans avoir besoin de recharger la page.
4. **QR Code Unifié & Redirection :** QR Code pointant directement vers l'espace joueur (sans pointage autonome pour laisser le contrôle au club). Redirection automatique transparente des anciennes requêtes de type `/?token=xxx` vers la nouvelle page `/player/xxx`.
5. **Intégration d'Emails :** Alignement de toutes les fonctions de routage et d'envoi d'e-mails pour pointer de manière dynamique vers `/player/:token`.

### v0.7.4 (2026-05-30)
Intégration d'un système de pointage moderne par scan de QR Code :
1. **QR Code de Pointage :** Remplacement du bouton textuel de copie de lien autonome par un QR Code généré dynamiquement et disposé de manière centrale dans la modale de réussite d'inscription. Un texte explicatif invite le joueur à prendre une capture d'écran de son QR Code de pointage.
2. **Scan Automatique & Intelligent :** Lorsqu'un organisateur ou un joueur scanne le QR Code à son arrivée, l'application effectue un pointage automatique de sa présence dans tous ses tableaux, affiche une notification festive "Présence validée avec succès par QR Code !" puis nettoie de manière transparente l'URL d'accès.
3. **Rappel QR Code dans l'Espace Joueur :** Intégration du QR Code dynamique dans l'Espace personnel du joueur (recherche par jeton) permettant de retrouver son code à n'importe quel moment.

### v0.7.3 (2026-05-29)
Simplification ergonomique de la modale de réussite et nettoyage d'actions redondantes :
1. **Suppression de l'action email manuelle :** Enlèvement du bouton "M'envoyer par E-mail" redondant (avec mailto) de la fenêtre de succès, car la confirmation d'inscription par courrier électronique est déjà automatisée et expédiée immédiatement en arrière-plan par le serveur/SMTP.
2. **Bouton Copie Pleine Largeur :** Agrandissement et mise en relief du bouton de copie du lien de pointage autonome pour une interaction optimale sur smartphone.

### v0.7.2 (2026-05-29)
Restauration complète de l'E-mail dans le flux d'inscription, tout en conservant l'ergonomie réduite et optimisée de la modale de réussite :
1. **Champs d'E-mail rétablis :** Réintroduction des champs de saisie pour l'Email de contact dans les formulaires d'enrôlement (licencié et manuel).
2. **Automatique E-mail SMTP :** Réactivation de l'expédition automatique du courriel de confirmation d'inscription dès l'envoi de la fiche.
3. **Bouton d'expédition "M'envoyer par E-mail" :** Restauration avec l'action mailto dans la vue de succès pour une souplesse de transmission optimale.
4. **Conservation de l'optimisation visuelle :** Préservation de la taille compacte de la modale de réussite d'inscription.

### v0.7.1 (2026-05-29)
Optimisation et ergonomie de la fenêtre modale de succès d'inscription d'un joueur et du formulaire d'enrôlement :
1. **Réduction de la taille de la modale :** Ajustement des paddings, espacements inter-éléments et de la largeur maximale (`max-w-md`) pour un rendu compact et épuré.
2. **Retrait des alertes SMS perturbantes :** Suppression de l'encart d'avertissement jaune relatant l'envoi facturé ou fictif d'alertes par SMS pour éviter toute confusion utilisateur.
3. **Suppression de l'email :** Suppression de la demande de l'adresse e-mail dans les formulaires d'inscriptions et retrait du bouton "Envoyer par e-mail" dans la fiche de réussite.
4. **Bouton Copie Pleine Largeur :** Unification du bouton d'action principal pour copier directement le lien de pointage autonome.

### v0.7.0 (2026-05-29)
Mise en place de l'Option A avec l'envoi automatisé et instantané d'e-mails aux joueurs :
1. Envoi immédiat et automatique à la validation d'une nouvelle inscription par un joueur.
2. Envoi groupé et manuel depuis l'espace Bureau Organisateur lorsque le club clique sur le bouton "Renvoyer identifiants".

#### Corrections & Améliorations
- **Moteur d'E-mail automatisé :** Création d'un service standardisé `/src/services/emailService.ts` qui interagit avec l'Edge Function Supabase `/functions/v1/send-player-email` pour sécuriser l'envoi gratuit ou sous protocole SMTP LWS.
- **Délivrance Unifiée :** Amélioration du bouton "Renvoyer identifiants" de l'Espace Club pour router intelligemment par SMS (si téléphone) et/ou E-mail (si messagerie) selon les canaux de contact fournis par l'athlète.
- **Robustesse de l'UI :** Intégration non-bloquante avec gestion d'erreurs d'envoi et notifications toasters sur l'avancement de la transmission.

### v0.6.12 (2026-05-29)
Ajout d'une option d'envoi de jeton secret par e-mail en un clic par protocole universel `mailto:` qui pré-remplit instantanément le destinataire, le sujet de la compétition, le jeton confidentiel et le lien d'accès de pointage direct pour le joueur.

#### Corrections & Améliorations
- **Bouton d'envoi E-mail direct :** Ajout de l'action `M'envoyer par E-mail ✉️` intégrant le support dynamique des variables de session joueur locales pour ouvrir instantanément l'application de messagerie préférée du joueur.
- **Gratuité 100% préservée :** La méthode par `mailto:` contourne de façon élégante, instantanée et gratuite tout intermédiaire payant d'API externe ou de serveur SPF/DKIM complexe, garantissant la viabilité économique du logiciel.

### v0.6.11 (2026-05-29)
Amélioration de l'accès au jeton (token) de pointage directement depuis l'application sans e-mail ni SMS (qui sont payants et non configurés) et résolution du cas où le token ne se chargeait pas en mode déconnecté / anonyme (politiques RLS de Supabase manquantes).

#### Corrections & Améliorations
- **Bouton de Copie du Jeton :** Intégration d'un bouton de copie en un clic du Jeton de pointage secret directement dans la fenêtre modale de succès d'inscription.
- **Bouton Copier le lien direct :** Ajout d'un bouton pour copier d'un seul clic un lien direct de connexion/pointage autonome avec le token inclus dans l'URL.
- **Règles RLS Supabase pour player_tokens :** Ajout des politiques RLS de sélection, d'insertion et de mise à jour publiques (`Public Read/Insert/Update/Delete`) indispensables pour que l'insertion lors de l'inscription et la recherche anonyme de token fonctionnent à 100%. Également ajouté le support RLS d'insertion et de mise à jour pour `players` de manière anonyme. Un script de mise à jour SQL a été consigné dans `/supabase_update.sql`.
- **Note explicite de Gratuité :** Ajout d'un panneau explicatif clair informant que l'application n'envoie volontairement aucun e-mail ou SMS d'office afin d'éviter tout coût de communication et de préserver la gratuité d'usage.

### v0.6.10 (2026-05-29)
Résolution de l'avertissement React alertant d'un changement de composant non contrôlé à contrôlé lors de la saisie d'informations ou de l'import d'une licence FFTT.

#### Corrections & Améliorations
- **Garantie de valeur par défaut :** Ajout de valeurs par défaut de chaîne vide (`|| ''`) pour les attributs dynamiques `formData.email` et `formData.phone` de l'input d'édition.
- **Moyennage non destructif du State :** Correction de la fonction de modification du licencié FFTT à l'aide de `setFormData(prev => ...)` afin de préserver l'ensemble des champs du profil joueur, évitant ainsi de rendre les inputs temporairement non définis (`undefined`).

### v0.6.9 (2026-05-29)
Correction de l'erreur SQL `column players.token does not exist` par l'adoption complète de la table autonome `player_tokens` pour stocker, vérifier et requêter les jetons de pointage des joueurs.

#### Corrections & Améliorations
- **Modèle de données découplé :** Retrait complet des requêtes essayant d'interroger la colonne inexistante `token` sur la table `players`.
- **Intégration de player_tokens :** Résolution et insertion des tokens au moment de l'inscription via la table relationnelle `player_tokens`.
- **Pointage autonome robuste :** Lecture sécurisée à deux étapes dans la Landing page (résolution du `player_id` par token puis chargement du profil complet) évitant tout crash de base de données.

### v0.6.8 (2026-05-29)
Ajout du choix multiple des séries par cases à cocher à l'inscription joueur, collecte de l'adresse email et du numéro de téléphone de contact, génération instantanée d'un jeton (token) joueur unique secret et espace pointage public en temps réel via token directement sur la page d'accueil.

#### Fonctionnalités Majeures & Améliorations
- **Inscription Multi-Tableaux par cases à cocher :** Les joueurs peuvent désormais cocher toutes les séries désirées simultanément (dans la limite du classement FFTT compatible et du nombre maximal autorisé par jour de compétition).
- **Enregistrement des contacts :** Saisie obligatoire du numéro de téléphone et de l'email à l'inscription pour délivrer les accès.
- **Espace Jeton Joueur (Token) :** Formulaire direct de saisie de token sur la Landing page permettant de charger la fiche du joueur et de procéder à un self-pointage ("Présent") d'une simple pression d'un bouton.
- **Chargement automatique URL :** Capacité de détecteur d'URL de type `/?token=MON_TOKEN` pour charger directement l'espace personnel du joueur en un clic.

### v0.6.7 (2026-05-28)
Scission de l'état `useTournament` pour distinguer le filtre de club de l'organisateur connecté et l'affichage exhaustif des tournois publics sur la Landing Page et autres vues publiques.

#### Bug Fixes & Improvements
- **Scission de useTournament :** Introduction de l'option `forcePublic` pour contourner la session d'organisateur et lister l'ensemble des tournois du système sur la Landing Page publique.
- **Ségrégation du Stockage Local :** Utilisation de clés autonomes `public_selected_tournament_id` et `organizer_selected_tournament_id` dans le localStorage pour éviter tout mélange d'indexation de tournois.
- **Compatibilité des Pages Publiques :** Intégration du mode public forcé dans la page d'accueil (`Landing.tsx`) et la vue des scores en direct (`LiveScores.tsx`).

### v0.6.6 (2026-05-27)
Résolution de bugs d'authentification Supabase et de persistence liés au multi-comptes et à la navigation lors de la déconnexion.

#### Bug Fixes & Improvements
- **Race Condition de Session Supabase :** Introduction de `sessionOverride` dans le hook `useTournament.ts` lors des événements de `onAuthStateChange` pour éliminer le délai d'obtention de la session fraîche sans appels de race conditions indésirables.
- **Pollution de Session Multi-comptes :** Nettoyage automatique de la valeur `selected_tournament_id` dans le `localStorage` dès le déclenchement de l'événement de déconnexion (`SIGNED_OUT`) ou du clic d'action de déconnexion dans les menus de navigation (`Sidebar.tsx` et `BottomNav.tsx`).
- **Modal de Connexion non sollicité :** Inversion de l'ordre d'appel asynchrone dans `handleLogout` de la barre latérale et la navigation mobile. L'application redirige désormais en premier lieu vers la route publique `/` pour sortir des routes protégées avant d'émettre le `auth.signOut()` de Supabase, évitant la réouverture automatique du formulaire d'identification.

### v0.6.4 (2026-05-27)
Consultation publique passive des tables et scores en direct pour les spectateurs et joueurs avec restriction d'accès aux modifications.

#### New Features & Access Controls
- **Page de scores live publique (/live-scores) :** Création d'une interface de consultation élégante, passive (lecture seule), permettant d'apprécier les scores en temps réel sans possibilité de cliquer pour modifier.
- **Redirection directe :** Mise à jour du bouton public de la Landing Page pour rediriger vers cette interface de consultation au lieu des écrans réservés aux organisateurs.

### v0.6.3 (2026-05-27)
Intégration et ajustement du logo officiel flambant de l'application **Ping Manager** (le trophée en flammes) sur l'ensemble de l'écosystème numérique.

#### Visual/Asset Enhancements
- **Composant Vectoriel SVG Haute Fidélité :** Création et déploiement d'un composant `<Logo />` reprenant très précisément le visuel de la coupe/trophée enflammée (teintes teal/or/orange) pour un rendu extrêmement précis et vectoriel sans aucune dépendance réseau ou raster.
- **Remplacement Global :** Remplacement de l'émoji tennis de table `🏓` et de l'ancien badge textuel "TT" par cette nouvelle identité visuelle unifiée dans les composants phares :
  - `Landing.tsx` (Espace Public & Joueurs).
  - `Sidebar.tsx` (Menu latéral de l'Espace Club - Bureau).
  - `Header.tsx` (Entête principal de l'Espace Club - Mobile).
  - `BottomNav.tsx` (Panneau mobile pour l'Espace Club).

### v0.6.2 (2026-05-27)
Uniformisation de l'identité de l'application sur tous les écrans d'administration des clubs (Espace Organisateur) et d'arbitrage pour s'appeler uniformément **Ping Manager** (retrait de TournoisTT).

#### Updates & Refinements
- **Administration des Clubs :** Changement du logo textuel dans la barre de navigation latérale (`Sidebar`) et le menu mobile en haut du tableau de bord (`Header` et `BottomNav`) pour afficher "Ping Manager".
- **Feuilles de match digitales :** Uniformisation du bandeau de bas de page de l'arbitrage mobile (`TableView`) sous le nom "Ping Manager".

### v0.6.1 (2026-05-27)
Uniformisation de l'identité de l'application sur tous les écrans (organisateurs et joueurs) pour s'appeler uniformément **Ping Manager** (retrait des suffixes v2 résiduels).

#### Updates & Refinements
- **Marque Unique :** Modification de toutes les occurrences pour "Ping Manager" dans le Dashboard de l'organisateur, les métadonnées de l'application et la configuration du preview.

### v0.6.0 (2026-05-27)
Refonte de l'Espace Joueurs public pour introduire une véritable Landing Page d'application sportive et dynamique (Ping Manager), avec sélection individuelle des tournois via des cartes stylisées et ergonomiques, et suppression du menu déroulant du Header au profit de cette navigation directe.

#### Visual & Modern UX
- **Landing Page Applicative de Marque (Ping Manager) :**
  - Section Hero avec slogan dynamique, badges sportifs et présentation épurée du service.
  - Section de Statistiques globales pour donner de l'impact aux compétitions.
  - Grille de cartes de tournois au style distinctif et sportif, affichant le statut dynamique, l'emplacement, la date et le taux de remplissage.
  - Section "Comment ça marche" (How it works) animée par Motion avec les 4 étapes numérotées du parcours d'un joueur.
  - Section de réassurance "La plateforme pour tous".
  - Section CTA (Call to Action) finale flamboyante aux couleurs de Ping Manager pour lancer son tournoi.
- **Routage et Navigation Dynamique :**
  - Clic sur une carte de tournoi pour ouvrir l'espace spécifique de suivi et inscription de ce tournoi.
  - Suppression définitive du menu de sélection déroulant dans le Header public pour un parcours utilisateur plus fluide et cohérent.
  - Bouton de retour à l'accueil pour faciliter la navigation multi-tournois sans altérer l'interface d'inscription.
- **Application Strict du Design System (DESIGN_SYSTEM.md) :**
  - Palette rigoureuse de couleurs (Marine `#0f1f3d`, Orange `#f97316`, Bleu `#3b82f6`, Vert `#22c55e`).
  - Utilisation de la typographie `font-display` (Bricolage Grotesque) pour tous les titres sportifs et accrocheurs.
  - Animations modernes fluides via Motion (fade-in, slide-up, translate subtils).

### v0.5.0 (2026-05-26) - *Baseline Historique*
Version stabilisée de l'application de gestion de tournois de Tennis de Table, recentrée sur la gestion optimale d'un événement unique à la fois.

#### Visual & Navigation UX
- **Refonte des Menus de Navigation :**
  - Renommé le menu "Tableau" par "**Phase Finale**" pour une meilleure clarté d'arbitrage.
  - Renommé le menu "Direct" par "**Live Score**" (gestion/visualisation temps réel).
  - Renommé le menu "Tables" par "**Gestion des Tables**".
- **Nettoyage Multitournoi :** Suppression du sélecteur de tournoi en haut de l'en-tête (Header) pour se focaliser sur l'événement unique optimisé.
- **Accès direct Landing Page :** Permet à l'organisateur connecté de retourner sur la page d'accueil d'inscription publique en cliquant directement sur le logo "TT TournoisTT".
- **Intégration du Badge v0.5.0 :** Ajout d'un indicateur de version discret dans la barre latérale (Sidebar) de l'organisateur et dans le pied de page (Footer) de la Landing Page publique.

#### Moteur d'Inscriptions & Règles Métiers (Inscriptions par Journée)
- **Périodes d'Inscription Configurables :** Possibilité pour l'organisateur de configurer des dates et heures d'ouverture et de clôture d'inscription distinctes par journée de tournoi.
- **Contrôles d'Accès Temporels :** Validation stricte côté joueur lors de l'inscription pour empêcher l'enregistrement sur les séries d'une journée dont les inscriptions ne sont pas ouvertes ou sont déjà closes.
- **Indicateurs de Statut Visuels :** Affichage d'un badge dynamique pour chaque série (⏳ *Débute le*, 🔒 *Inscriptions closes*, ✅ *Fermeture dans Xh/jours*).
- **Statut "Brouillon" Public :** La Landing Page publique affiche un message clair "Inscriptions à Venir ⏳" lorsque le tournoi est en mode Brouillon (`draft`).

---

### v0.1.0 à v0.4.0 - *Versions de Développement initiales*
- Initialisation de la pile technologique (React + Vite + Tailwind + Supabase).
- Création du système de Poules dynamique, des feuilles de match de tennis de table.
- Gestion des participants, import de fichiers sous licence, et affectation intelligente des tables d'arbitrage.
