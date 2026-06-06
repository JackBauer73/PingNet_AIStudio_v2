# Spécifications de Design — Ping Manager

Ce document constitue la **source unique de vérité visuelle, ergonomique et technique (UX/UI)** pour l'ensemble de l'application **Ping Manager**, qui est conçue spécialement pour l'organisation simplifiée et l'arbitrage en direct des tournois de tennis de table.

---

## 1. Philosophie visuelle & Identité

Ping Manager incarne une image à la fois **professionnelle, sportive, technologique et épurée** (Sport-Tech). L’interface est dépouillée de tout élément superflu pour garantir une lisibilité maximale des données critiques (scores en cours, tables actives, classement des poules) dans un environnement de tournoi souvent bruyant et dynamique.

### Principes directeurs :
*   **La clarté avant tout** : Des rapports de contrastes élevés, des tailles de police adaptées et une hiérarchie spatiale rigoureuse.
*   **Tactile & Mobile First** : L'arbitrage s'effectuant au bord des tables, toutes les interfaces de saisie de scores sont taillées pour une utilisation à une main sur smartphone.
*   **Zéro Cluttering (Anti-AI-Slop)** : Pas de fioritures artificielles, pas d'indicateurs de télémétrie superflus, et pas d'emojis pour illustrer des métadonnées. L'esthétique naît de la justesse de la typographie, des marges et du comportement des composants.

---

## 2. Palette de Couleurs — Strictes

La charte colorimétrique s'inspire directement du dynamisme du tennis de table. Elle associe des teintes de fond stables à des accents sportifs très contrastés.

### 2.1 Les Couleurs Clés (Hexadécimales)

| Rôle / Teinte | Hex | Classe Tailwind principale | Usage principal |
| :--- | :--- | :--- | :--- |
| **Marine** (Stable) | `#0f1f3d` | `bg-[#0f1f3d]` / `text-[#0f1f3d]` | Surfaces sombres, footer, sections contrastées, texte clair |
| **Orange** (Sportif) | `#f97316` | `bg-[#f97316]` / `text-[#f97316]` | **Accent actif principal** (rappelle la balle de ping-pong), CTAs, badges |
| **Bleu** (Info) | `#3b82f6` | `bg-[#3b82f6]` / `text-[#3b82f6]` | Informations secondaires, heures, badges "Live" d'information |
| **Vert** (Succès) | `#22c55e` | `bg-[#22c55e]` / `text-[#22c55e]` | Succès, badges de statut "ouvert", live clignotant, validations |
| **Indigo** (Admin) | `#6366f1` | `bg-indigo-600` / `text-indigo-600` | Espace administratif de l'organisateur (distinct de l'espace joueur) |
| **Émeraude** (Statut) | `#10b981` | `bg-emerald-600` / `text-emerald-600` | Matchs de poules clos, qualifications validées |

### 2.2 Nuances dérivées autorisées

*   **Marine sombre (Dark Canvas)** : `#0a1729` (Fond du mode sombre standard)
*   **Marine profond** : `#06101f` (Fonds de cartes héro ou sections sombres secondaires)
*   **Orange foncé (Hover)** : `#ea6a0a` (Pour les interactions au survol des boutons oranges)
*   **Marine clair (Hover/Focus)** : `#1a3056` (Pour les interactions au survol des boutons marine)

### 2.3 Les Neutres

*   **Texte sombre (Clair)** : `text-[#0f1f3d]` (Mode clair)
*   **Texte clair (Sombre)** : `text-white`, `text-slate-100`, `text-slate-300`, `text-slate-400`
*   **Texte secondaire** : `text-slate-600` / `text-slate-500` (Corps & légendes)
*   **Bordures neutres** : `border-slate-200` (En mode clair) / `border-white/10` (En mode sombre)
*   **Fonds neutres** : `bg-white`, `bg-slate-50` (Clair) / `bg-[#0a1729]`, `bg-white/[0.03]` (Sombre / Bento-Grid)

### 2.4 ❌ COULEURS INTERDITES
*   **Pas de dégradés multicolores** (ex. `from-[#f97316] to-pink-500 to-red-600`) — cela donne un aspect non contrôlé et nuit à la lisibilité.
*   **Pas de couleurs exotiques** comme le violet, le jaune stabilo, le fuchsia ou le cyan sauvage.
*   **Pas de dégradés sur fonds transparents**.

---

## 3. Typographie & Paire de Polices

La typographie remplit des rôles sémantiques clairs :

1.  **Titres & Impact National (Display)** : Utiliser **Bricolage Grotesque**, **Space Grotesk** ou **Outfit**. Ces polices apportent une identité athlétique, géométrique et contemporaine aux en-têtes majeurs.
2.  **Texte de l'UI & Navigation (Sans)** : **Inter** (Sans-Serif). Choisi pour sa neutralité et sa clarté extrême sur écrans mobiles de toutes résolutions.
3.  **Scores, Tables, Chronomètres (Mono)** : **JetBrains Mono** ou **Fira Code** (`font-mono` avec `tabular-nums`). Garantit que les chiffres des scores et des tables conservent la même largeur exacte lors des modifications en rafale, évitant les sauts d'échelle visuels (flickering).

```css
/* Déclaré sous Tailwind CSS '@theme' dans index.css */
--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
--font-display: "Bricolage Grotesque", "Inter", sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
```

---

## 4. Mode Sombre (Dark Mode)

Le mode sombre est implémenté via une variante personnalisée (Tailwind classes injectées sous `.dark`) pour s’adapter aux gymnases à forte réflexion lumineuse ou lors des soirées de tournois :

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Chaque élément doit comporter ses variantes de couleur équivalentes :
*   Fonds : `bg-white` ➔ `dark:bg-[#0a1729]`
*   Textes : `text-[#0f1f3d]` ➔ `dark:text-white`
*   Bordures : `border-slate-200` ➔ `dark:border-white/10`

---

## 5. Spacing, Layout & Échelle de taille

Pour maintenir l'uniformité du rythme visuel, les proportions suivantes doivent être adoptées :

*   **Paddings de section** : `py-24` (Standard de respiration de page) / `py-20` (Paddings compacts)
*   **Largeur maximale de bloc (Container)** :
    *   Squelette global : `max-w-7xl mx-auto px-6`
    *   Section d'inscription ou formulaires restreints : `max-w-3xl` ou `max-w-4xl`
*   **Espacement de grilles** : `gap-5` pour les petites cartes, `gap-6` voire `gap-8` pour les grandes structures Bento.
*   **Bords arrondis (Border Radius)** :
    *   Cartes (Cards) : `rounded-2xl`
    *   Boutons (Buttons/Actions) : `rounded-xl` ou `rounded-lg`
    *   Badges / Pilules : `rounded-full`
    *   Conteneurs d’icônes ou miniatures : `rounded-xl`

---

## 6. Composants Canoniques — Modèles Réels de Balisage

Pour assurer l'harmonie, réutilisez strictement les composants décrits ci-dessous dans React (en important toujours les icônes de `lucide-react`).

### 6.1 Bouton Principal (Orange Sportif)
```tsx
import { ArrowRight } from 'lucide-react';

<a href="..." className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#f97316] hover:bg-[#ea6a0a] text-white font-bold transition-all shadow-md active:scale-95">
  Inscrire un joueur
  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
</a>
```

### 6.2 Bouton Secondaire (Outline / Mode Sombre Compatible)
```tsx
<button className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border-2 border-[#0f1f3d] dark:border-white/30 text-[#0f1f3d] dark:text-white hover:bg-[#0f1f3d] hover:text-white dark:hover:bg-white/10 font-bold transition-all">
  Voir les détails
</button>
```

### 6.3 Carte Standard Bento / Dashboard
```tsx
<div className="p-6 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 hover:border-[#f97316] hover:shadow-xl transition-all duration-300">
  {/* Contenu de la fente */}
</div>
```

### 6.4 En-tête de section (Eyebrow & H2)
```tsx
import { Trophy } from 'lucide-react';

<div className="text-left">
  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-semibold mb-3">
    <Trophy className="w-3.5 h-3.5" />
    En direct de l'événement
  </div>
  <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-[#0f1f3d] dark:text-white">
    Tableau et Résultats
  </h2>
</div>
```

### 6.5 Badge de Statut des Tableaux (4 États)
```tsx
// Classement dynamique selon l'état :
// Ouvert  ➔ bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20
// Plein   ➔ bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20
// Live    ➔ bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20 (ajouter animate-pulse)
// Clos    ➔ bg-slate-100 text-slate-500 border-slate-200

<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-[#22c55e]/10 text-[#16a34a] border-[#22c55e]/20">
  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
  Inscriptions Ouvertes
</span>
```

---

## 7. Interfaces de Saisie de Scores & Ergonomie Tactile

Les arbitres de tables (par exemple, les joueurs de repos désignés) manipulent l'espace à une main sur le bord de la table. Les contraintes suivantes s'appliquent sur la page `/table/{numero}` :

*   **Zone d’impact physique de 44px minimum** pour éviter les faux contacts et glissements de doigts humides.
*   **Boutons de score géants** avec un fort contraste, réagissant instantanément à la pression (visual feedback d'activation via shadow ou scale).
*   **Vérification de score réglementaire en arrière-plan** empêchant la confirmation de scores invalides (ex. sets terminés à 11-10 ou sans écart de deux points).

---

## 8. Animations (Motion)

Toutes les animations sont régulées par la bibliothèque `motion/react` et doivent rester sobres, directes et informatives :

*   **Apparition de page (Fade In vertical)** :
    ```tsx
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
    ```
*   **Apparition échelonnée des listes ou grilles bento** :
    ```tsx
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
    >
    ```
*   *Interdit* : Pas d’animations de type rotation, pas de rebondissements exagérés (springs distordus), et pas de ralentissements de plus de 0,6 seconde.

---

## 9. Les Anti-Patterns (Erreurs de Style à Bannir)

*   ❌ Les emojis (comme 🎉, 🏓, ✉️) utilisés directement comme icônes d'action ou d'information dans les parties administratives de l'organisateur. Toujours employer Lucide React.
*   ❌ L'affichage du format brut du serveur (ex. afficher `"finished"` aux yeux des joueurs au lieu de `"Terminé"` ou `"Pools"` au lieu de `"Poules"`).
*   ❌ Les grands espaces sans limites maximales (`max-w-*`). Les listes de joueurs ou d'arbitres ne doivent jamais toucher les bords extrêmes des écrans d'ordinateurs larges (Desktop wide).
*   ❌ Les bruitages ou animations clignotantes agressives qui perturbent la lecture.

---

## 10. Checklist de validation d'intégration

Avant d'intégrer ou de déployer des modifications esthétiques :
- [ ] Le ratio de contraste du texte par rapport au background est d'au moins 4.5:1.
- [ ] Le mode sombre a été testé et vérifié sur chaque nouvelle classe ou widget.
- [ ] Les scores utilisent bien la graisse `font-mono` pour demeurer immobiles lors du défilement des chiffres.
- [ ] Aucune couleur étrangère à la palette restreinte (§ 2) n'a été insérée.
- [ ] Les icônes utilisées proviennent à 100% de la bibliothèque `lucide-react`.
