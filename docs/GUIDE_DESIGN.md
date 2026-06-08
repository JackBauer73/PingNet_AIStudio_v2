# Guide de Design — Ping Manager

Ce document définit les fondations visuelles, ergonomiques et l'expérience utilisateur (UX/UI) de l'application **Ping Manager**, conçue spécialement pour la gestion simplifiée et l'arbitrage en direct des tournois de tennis de table.

---

## 1. Philosophie et Identité Visuelle

L'application doit renvoyer une image à la fois **professionnelle, sportive, technologique et épurée**. L'accent est mis sur la lisibilité maximale des données clés (scores, tables actives, appel des joueurs) dans un environnement de tournoi souvent bruyant et stressant.

### Palette de Couleurs
La charte colorimétrique s'inspire du dynamisme du tennis de table en associant des fonds stables à des accents contrastés :
- **Fonds Principaux** : Slate-50 (off-white doux) pour la clarté en mode clair, et Slate-950 ou Deep Navy (`#0a1729`) pour une immersion esthétique sombre et reposante pour les yeux lors des longues journées de compétition.
- **Accent d'Action** : Orange Sportif (`#f97316`) — rappelle la couleur officielle de la balle de tennis de table, utilisé pour guider l'action principale, notifier les statuts actifs ou signaler un arbitrage immédiat.
- **Accents Secondaires** : Indigo (`#6366f1`) pour l'espace administratif organisationnel, et Emeraude (`#10b981`) pour les validations, les qualifications et les matchs terminés.

### Typographie
Le choix typographique repose sur des rôles sémantiques stricts :
1. **Texte de l'UI & Navigation** : **Inter** (Sans-Serif). Choisi pour sa lisibilité exceptionnelle sur écran mobile et sa neutralité contemporaine.
2. **Titres et Impact National** : **Space Grotesk** ou **Outfit**. Apporte un caractère géométrique, moderne et athlétique à l'interface.
3. **Chronomètres, Tables & Scores** : **JetBrains Mono** ou **Fira Code** (Monospace). Garantit que les chiffres des scores et les numéros de tables ou de dossards conservent exactement la même largeur lors des changements rapides, évitant ainsi tout décalage visuel (flickering).

---

## 2. Architecture des Layouts et Parcours Utilisateur

L'application est découpée en deux mondes distincts partageant les mêmes données en temps réel.

### A. L'Espace Public & Joueur (Sans connexion requise)
- **La Page d'Accueil (Landing Page)** : Un portail d'accueil épuré présentant l'événement, les statistiques globales en temps réel (nombre de joueurs pointés, progression des matchs) et un moteur de recherche par numéro de licence. Elle intègre directement un formulaire d'inscription dynamique pour les joueurs non encore inscrits.
- **La Vue de Table (Table View)** : L'interface ultime de saisie. Accessible via QR Code collé sur la table physique (URL de type `/table/{numero}`). Elle se focalise sur deux joueurs, l'emplacement du score et des boutons tactiles géants, garantissant un arbitrage rapide sans erreur de saisie.
- **Le Dashboard Public** : Permet aux spectateurs sur grand écran de suivre en direct l'affectation des tables et de voir défiler les matchs en cours et les résultats récents.

### B. L'Espace Organisateur (Connexion requise)
Présenté sous forme d'un panneau d'administration fluide avec un menu latéral persistant (Sidebar) pour le format Desktop et un menu de navigation bas (Bottom Navigation) optimisé pour le tactile mobile.
- **Le Tableau de Bord (Dashboard Principal)** : Une disposition en grille (Bento-Grid) affichant les statistiques clés de l'événement et permettant des actions rapides (clôturer une phase, lancer une alerte générale, configurer le tournoi).
- **Le Gestionnaire de Joueurs** : Une table interactive permettant le pointage rapide (présence), la gestion des paiements, la modification de catégorie et l'attribution automatique de dossards uniques.
- **La Console des Poules et Console de Bracket** : Deux espaces de supervision d'algorithmes permettant d'initier la génération automatique en un seul clic et de suivre de manière visuelle l'avancement des rencontres.

---

## 3. Ergonomie Mobile & Contraintes Tactiles

L'arbitrage s'effectue généralement au bord de la table de ping-pong, smartphone à la main par des arbitres d'un jour. Cela impose des règles d'utilisabilité draconiennes :
- **Zones Spacieuses** : Tous les éléments actionnables (boutons de scores, boutons de validation) ont une hauteur minimale de **44px** pour éviter les faux-clics.
- **Visual Feedback Immédiat** : Chaque pression sur un bouton de score ou de validation déclenche une micro-animation ou un changement d'état visuel immédiat (comme des vagues d'impact ou des changements de couleur haut contraste).
- **Zéro Cluttering** : Pas de barres latérales encombrantes sur mobile. La navigation s'effectue via un menu inférieur accessible au pouce, plaçant les fonctions vitales à portée de main.

---

## 4. Principes d'Animation et de Transition

Les transitions visuelles sont utilisées pour donner une impression de fluidité organique et structurer la hiérarchie spatiale :
- **Entrées de Page** : Un léger effet d'apparition en fondu enchaîné (fade-in) avec un décalage vertical ascendant de quelques pixels permet d'introduire le contenu de manière élégante.
- **Changement de Phase** : Lors de la génération des poules ou du tableau final, des animations de type "shimmer" (vague de chargement brillante) guident l'attente de l'utilisateur.
- **Déplacement dans le Bracket** : Les lignes de connexion entre les cases du tableau final s'illuminent ou s'animent lorsque les joueurs progressent d'un tour à l'autre, guidant le regard sur la suite de la compétition.
