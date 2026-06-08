# TournoisTT - Documentation Globale

## Description
TournoisTT est une application de gestion de tournois de Tennis de Table en temps réel. Elle permet d'organiser des tournois, de gérer les inscriptions, les poules, les phases finales et de suivre les scores en direct sur des tables dédiées (via QR codes).

## Technologies
- **Frontend** : React 18+ avec Vite.
- **Styling** : Tailwind CSS.
- **Icons** : Lucide React.
- **Animations** : Motion (framer-motion).
- **Backend / DB** : Supabase (PostgreSQL + Realtime).
- **Navigation** : React Router DOM.
- **Notifications** : React Hot Toast.

## Structure du Projet
- `/src/pages/organizer` : Interface de gestion pour l'organisateur.
- `/src/pages/player` : Interface simplifiée pour les joueurs/tables.
- `/src/components` : Composants réutilisables (UI et logique partagée).
- `/src/services` : Configuration des services externes (Supabase).
- `/src/utils` : Fonctions utilitaires (génération de bracket, calculs).
- `/src/types` : Définitions TypeScript.
