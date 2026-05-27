# Version History - Ping Manager

This document keeps track of all released versions and updates of Ping Manager, adhering strictly to **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH`.

## Configuration active
- **Version actuelle :** `0.6.4`
- **Statut :** Vue consultable passive des scores & tables en direct sans accès en écriture
- **Date :** 2026-05-27

---

## Règles de Versionning (Semantic Versioning)
1. **MAJOR (X._._)** : Changement majeur entraînant des ruptures de compatibilité (ex: migration lourde de base de données sans rétrocompatibilité, modification structurelle complète des rôles).
2. **MINOR (_.X._)** : Ajout de fonctionnalités nouvelles sans casser l’existant (ex: nouveaux rapports d'arbitrage, intégration de capteurs de score, filtres avenants).
3. **PATCH (_._.X)** : Corrections de bugs mineurs, améliorations visuelles ou textuelles mineures (ex: modification d'une coquille, ajustement d’un espacement CSS, renommage d'un menu).

---

## Historique des versions

### v0.6.4 (2026-05-27) - *Version Actuelle*
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
