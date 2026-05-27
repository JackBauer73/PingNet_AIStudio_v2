# Ping Manager — Design System

> Source de vérité visuelle pour la landing page Ping Manager et toute page qui doit s'y rattacher.
>
> **Référence canonique du code** : `src/landings/SportDynamic.tsx`.
> **Pour Gemini / AI Studio** : attache ce fichier en contexte ou colle-le dans les *system instructions* avant toute génération.

---

## 1. Stack technique

- **React 19** + **Vite 6** + **TypeScript**
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **Motion** (`motion/react`) pour les animations
- **Lucide React** pour toutes les icônes (jamais d'emoji, jamais d'SVG externe)
- **React Router DOM v7** pour la navigation

Toute nouvelle page **doit** rester dans cette stack — pas d'autre lib UI (pas de shadcn, pas de MUI, pas de Bootstrap).

---

## 2. Palette de couleurs — STRICTE

Quatre couleurs, point. Toute autre couleur est interdite (sauf les nuances slate/white pour le texte et les bordures neutres).

| Rôle | Hex | Usage |
|---|---|---|
| **Marine** | `#0f1f3d` | Surfaces sombres, footer, sections de contraste, texte principal (mode clair) |
| **Orange** | `#f97316` | **Accent dominant** — CTAs primaires, highlights, badges actifs, logos |
| **Bleu** | `#3b82f6` | Information secondaire, dates, badges "Live", icônes neutres |
| **Vert** | `#22c55e` | Succès, statut "ouvert", live pulsant, validations |

### Nuances dérivées autorisées
- **Marine sombre** : `#0a1729` (fond mode sombre principal), `#06101f` (sections plus sombres)
- **Orange foncé** : `#ea6a0a` (hover du orange)
- **Marine clair** : `#1a3056` (hover du marine)

### Neutres (Tailwind)
- Texte sombre : `text-[#0f1f3d]` (mode clair) / `text-white`, `text-slate-100`, `text-slate-300`, `text-slate-400` (mode sombre)
- Texte clair : `text-slate-600` (corps), `text-slate-500` (méta), `text-slate-400` (placeholder)
- Bordures : `border-slate-200` (clair) / `border-white/10` (sombre)
- Fonds neutres : `bg-white`, `bg-slate-50` (clair) / `bg-[#0a1729]`, `bg-[#0f1f3d]`, `bg-white/[0.03]` (sombre)

### ❌ INTERDIT
- Tout gradient multi-couleurs (`from-orange to-rose to-rouge` etc.) — ça donne un effet "généré par IA"
- Toute couleur Tailwind hors `slate`, `white`, `transparent`, et les 4 hex ci-dessus
- Rose, violet, jaune, cyan, fuchsia — bannis
- `bg-gradient-to-*` sauf pour des dégradés mono-teinte très subtils (ex: `from-white to-slate-50`)

---

## 3. Typographie

Deux polices, importées dans `index.html` via Google Fonts :

```css
--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;   /* corps */
--font-display: "Bricolage Grotesque", "Inter", sans-serif;   /* titres */
```

Utilisation Tailwind :
- Titres (h1, h2, h3) → `font-display font-bold` ou `font-extrabold`
- Corps → `font-sans` (défaut)
- Chiffres (scores, stats) → ajouter `tabular-nums`

### Échelle des titres
| Niveau | Classes |
|---|---|
| H1 hero | `font-display text-5xl md:text-7xl font-extrabold tracking-tighter leading-[0.95]` |
| H2 section | `font-display text-4xl md:text-5xl font-bold tracking-tight` |
| H3 card | `font-display text-xl font-bold` (ou `text-2xl` pour cards importantes) |
| Eyebrow (pré-titre) | `inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold` |

❌ Pas de serif (Playfair, Georgia…) — réservé à d'autres variantes.
❌ Pas de pixel/monospace en titre (sauf code inline `font-mono`).

---

## 4. Mode sombre

Implémenté via une **custom variant Tailwind v4** (déjà configurée dans `src/index.css`) :

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Toggle géré par un `useState` local et une classe `dark` sur le wrapper racine de la page :

```tsx
const [theme, setTheme] = useState<'light' | 'dark'>('light')
return <div className={theme === 'dark' ? 'dark' : ''}>...</div>
```

Toute classe de couleur doit avoir son pendant `dark:` :
```
bg-white dark:bg-[#0a1729]
text-[#0f1f3d] dark:text-white
border-slate-200 dark:border-white/10
```

---

## 5. Spacing & layout

- Container principal : `max-w-7xl mx-auto px-6`
- Container étroit (formulaires, FAQ) : `max-w-3xl` ou `max-w-4xl`
- Padding vertical des sections : `py-24` (desktop standard), `py-20` (compact)
- Padding entre nav et hero : `pt-20 pb-24 md:pt-28 md:pb-32`
- Gap entre cards : `gap-5` (cards moyennes) ou `gap-6` (cards larges)
- Coins arrondis :
  - Boutons : `rounded-lg`
  - Cards : `rounded-2xl`
  - Pills/badges : `rounded-full`
  - Logo : `rounded-lg`

---

## 6. Composants — patterns canoniques

### 6.1 Bouton primaire (orange)
```tsx
<a href="..." className="group inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#f97316] hover:bg-[#ea6a0a] text-white font-bold transition-all">
  Démarrer un tournoi
  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
</a>
```

### 6.2 Bouton secondaire (outline)
```tsx
<a href="..." className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-[#0f1f3d] dark:border-white/30 text-[#0f1f3d] dark:text-white hover:bg-[#0f1f3d] hover:text-white dark:hover:bg-white/10 font-bold transition-all">
  Voir les tournois
</a>
```

### 6.3 Card standard
```tsx
<div className="p-6 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 hover:border-[#f97316] hover:shadow-lg hover:-translate-y-1 transition-all">
  ...
</div>
```

### 6.4 Eyebrow (pré-titre de section)
```tsx
<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3b82f6]/10 dark:bg-[#3b82f6]/20 text-[#3b82f6] text-xs font-semibold mb-3">
  <Calendar className="w-3 h-3" />
  Tournois ouverts
</div>
```
Variantes : remplacer `#3b82f6` par `#f97316` ou `#22c55e` selon le ton de la section.

### 6.5 Badge de statut (4 états)
| Statut | bg | text | dot |
|---|---|---|---|
| Ouvert | `bg-[#22c55e]/10` | `text-[#16a34a]` | `bg-[#22c55e]` |
| Presque plein | `bg-[#f97316]/10` | `text-[#f97316]` | `bg-[#f97316]` |
| Live | `bg-[#3b82f6]/10` | `text-[#3b82f6]` | `bg-[#3b82f6] animate-pulse` |
| À venir | `bg-slate-100` | `text-slate-600` | `bg-slate-400` |

```tsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold {bg} {text}">
  <span className="w-1.5 h-1.5 rounded-full {dot}" />
  Label
</span>
```

### 6.6 Icon container (feature card)
```tsx
<div className="w-12 h-12 rounded-xl bg-[#0f1f3d] flex items-center justify-center mb-4 group-hover:bg-[#f97316] transition-colors">
  <Icon className="w-6 h-6 text-white" />
</div>
```

### 6.7 Numéro d'étape (How it works)
```tsx
<div className="w-16 h-16 rounded-2xl bg-[#0f1f3d] border-2 border-[#f97316] flex items-center justify-center font-display font-extrabold text-[#f97316] text-xl mb-4 mx-auto">
  01
</div>
```

---

## 7. Sections — anatomie

Toute landing Ping Manager suit cet ordre (ou un sous-ensemble) :

1. **BackBar** (navigation interne, masquée en prod) — bandeau marine, optionnel
2. **Nav** (sticky, backdrop-blur, h-16)
3. **Hero** (titre H1 + sub + 2 CTAs + mock visuel à droite)
4. **Stats** (bandeau marine `py-12`, 4 chiffres centrés en orange)
5. **Tournaments** (grille de cards avec section title à gauche, lien "Tous les tournois" à droite)
6. **Features** (grille 3 colonnes, 6 cards, icon-container marine → orange au hover)
7. **How it works** (section marine, 4 étapes numérotées en ligne avec ligne orange en arrière-plan)
8. **Audience** (2 cards larges côte à côte)
9. **CTA final** (section pleine orange, titre blanc, bouton marine)
10. **Footer** (marine sombre, logo + liens + copyright)

Aucune section ne doit être inventée hors de ce catalogue sans valider le pattern d'abord.

---

## 8. Animations (Motion)

Pattern standard pour l'apparition d'éléments au scroll :

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ delay: index * 0.05 }}
>
```

Pattern pour le hero (apparition au load) :
```tsx
<motion.div
  initial={{ opacity: 0, y: 24 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6 }}
>
```

Pattern pour les éléments flottants (mock QR code) :
```tsx
<motion.div
  animate={{ y: [0, -8, 0] }}
  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
>
```

❌ Pas de spring exagérés, pas d'animations qui durent > 1s, pas de rotation 360°, pas de glitch/blink/scanlines.

---

## 9. Icônes (Lucide)

- Toutes les icônes viennent de `lucide-react`
- Tailles standard : `w-3 h-3` (inline xs), `w-4 h-4` (boutons, badges), `w-5 h-5` (corps), `w-6 h-6` (icon containers), `w-7 h-7` (hero icons)
- Couleur héritée par défaut (`currentColor`) — sinon classe Tailwind explicite
- **Toujours** une icône Lucide pour illustrer un point — jamais d'emoji 🎉, jamais d'image PNG

Icônes utilisées dans la landing actuelle (à réutiliser en priorité) :
`Users, Layers, Trophy, Activity, QrCode, Archive, Zap, Smartphone, CheckCircle2, Calendar, MapPin, Clock, Wifi, ArrowRight, ArrowLeft, Sun, Moon`

---

## 10. Données mock & intégration Supabase

Les données mock de la landing sont dans `src/data/tournaments.ts`. Format :

```ts
interface Tournament {
  id: string
  name: string
  club: string
  city: string
  date: string         // ISO
  dateLabel: string    // "Sam. 8 juin"
  timeLabel: string    // "09:00 — 18:00"
  format: string
  series: string
  registered: number
  capacity: number
  status: 'open' | 'almost_full' | 'live' | 'upcoming'
}
```

**Pour brancher les vraies données** : remplacer cet import par un hook Supabase qui mappe la table `tournaments` (cf. `DOCS_DATABASE.md`) vers ce format. Le composant `TournamentCard` n'a pas besoin d'être modifié.

Champs Supabase → mock :
- `tournaments.name` → `name`
- `tournaments.location` → `city`
- `tournaments.date` + formatage `Intl.DateTimeFormat('fr-FR')` → `dateLabel`
- `tournaments.status` (`registration`/`pools`/`bracket`/`finished`) → mappé sur `open`/`live`/`live`/`upcoming`
- `COUNT(players WHERE tournament_id = …)` → `registered`
- `tournaments.nb_tables * 4` (heuristique) ou nouveau champ `capacity` → `capacity`

---

## 11. Adapter aux vraies fonctionnalités Ping Manager

Quand l'IA ajoute une page liée à une fonctionnalité réelle (Bracket, Poules, Joueurs, etc.) :

1. **Garder** : palette, typo, spacing, patterns de cards/boutons/badges, animations
2. **Adapter** : la donnée affichée, la copy, les icônes Lucide pertinentes
3. **Vérifier** : aucun composant nouveau n'introduit une couleur hors palette, un gradient multi-couleurs, ou un emoji
4. **Mode sombre** : toute nouvelle section doit avoir ses classes `dark:` (cf. §4)

Exemples de pages probables à créer plus tard :
- Page **Bracket** publique (suivi d'un tournoi par les spectateurs) → réutiliser le pattern Card + statusBadge, ajouter une grille de matches
- Page **Détail tournoi** (clic sur une TournamentCard) → garder le layout hero + sections, lister les joueurs inscrits avec des cards plus petites
- Page **Profil joueur** → AudienceCard pattern adapté, ajouter stats avec le pattern "Stats grid" (§7 point 4)

---

## 12. Anti-patterns — résumé express

❌ Gradients multi-couleurs (effet "IA generic")
❌ Emojis ou icônes externes (toujours Lucide)
❌ Couleurs hors palette (pas de rose, violet, jaune…)
❌ Polices serif ou pixel sur cette variante
❌ Scanlines, blink, glitch, CRT — réservés à d'autres variantes
❌ `text-xs` pour du contenu informatif (uniquement labels)
❌ Sections sans `max-w-*` (le contenu ne doit jamais toucher les bords sur desktop)
❌ Inventer un nouveau type de composant alors qu'un pattern existe déjà

---

## 13. Checklist avant de livrer une nouvelle page

- [ ] Palette respectée (4 hex + slate/white)
- [ ] Typo : `font-display` sur les titres, `font-sans` ailleurs
- [ ] Mode sombre : toutes les classes ont leur `dark:` équivalent
- [ ] Toutes les icônes viennent de `lucide-react`
- [ ] Container `max-w-7xl mx-auto px-6` sur les sections principales
- [ ] Padding vertical `py-24` (ou `py-20`)
- [ ] Boutons : CTA primaire en orange, secondaire en outline marine
- [ ] Animations Motion : `initial` + `whileInView` + `viewport={{ once: true }}`
- [ ] Aucun gradient multi-couleur, aucun emoji, aucune couleur hors palette
- [ ] La page reste lisible et cohérente avec `SportDynamic.tsx` ouvert à côté
