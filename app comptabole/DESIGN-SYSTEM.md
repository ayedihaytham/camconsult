# Design system — Direction « Ledger Rule »

Référence pour l'implémentation réelle de la refonte visuelle validée (voir les
maquettes d'aperçu). **Aucune couleur, aucune fonctionnalité, aucun champ,
aucune action n'a changé** — uniquement l'habillage visuel et la structure des
composants. Ce document sert de contrat entre les écrans migrés et à migrer.

## 1. Palette de couleurs — inchangée

Tous les tokens existants (`src/index.css`, bloc `:root`) sont conservés tels
quels. Rien n'est renommé, rien n'est retiré :

| Token | Rôle |
|---|---|
| `--background` / `--foreground` | fond de page / texte par défaut |
| `--card` | fond des panneaux (« feuilles ») |
| `--primary` (marine) | encre forte : titres de ligne héros, barres de tally, boutons primaires |
| `--accent` (émeraude) | liens interactifs, éléments de marque (rail) |
| `--secondary` / `--muted` | canevas de page (voir §3), fonds discrets |
| `--muted-foreground` | texte secondaire / méta |
| `--destructive` | suppression, écarts d'anomalie |
| `--success` / `--warning` | **jamais en texte** — voir §2 |
| `--border` | filets fins standards |
| `--sidebar*` | rail de navigation (fond marine profond) |

**Un seul token est réellement nouveau**, il manquait pour la règle des
tableaux denses (§4) :

```css
/* src/index.css, bloc :root, section « Neutres » */
--rule-strong: 215 18% 74%; /* filet renforcé toutes les 5 lignes (papier ledger) */
```

```js
// tailwind.config.js, theme.extend.colors
"rule-strong": "hsl(var(--rule-strong))",
```

Tout le reste (espacement, rayons, police mono) se fait avec l'échelle
Tailwind **déjà en place** — voir §3.

## 1bis. Alignement identité CAMCONSULT (site vitrine ↔ app)

Le site vitrine (`camconsult/`, Next.js) et cette app partagent désormais la
même identité visuelle — **marine + or**, façon « papier à en-tête » — pour
que le passage de l'un à l'autre (lien « Espace client ») soit continu.
Seuls les tokens de couleur ont changé de valeur ; leur **rôle** reste
identique à celui déjà défini plus haut :

| Token | Avant | Après | Rôle (inchangé) |
|---|---|---|---|
| `--primary` | marine générique (`211 68% 18%`) | marine CAMCONSULT exact, `#0B2545` (`213 72% 16%`) | encre forte : titres, boutons primaires |
| `--accent` | émeraude (`160 84% 33%`) | or CAMCONSULT, `#C9A96A` (`40 47% 60%`) | marque, CTA (`Button variant="ledger"`), liens interactifs |
| `--accent-foreground` | blanc | marine (`213 72% 16%`) | texte sur fond `--accent` (l'or est toujours un **fond**, jamais du texte clair sur fond clair) |
| `--sidebar-primary` | — | or (`40 47% 60%`) | filet, icône et badge actifs du rail |
| `--sidebar-accent` | émeraude | marine éclairci (`212 44% 20%`) | fond interactif/actif attendu par les primitives shadcn |
| `--ring` | émeraude | or (`40 47% 60%`) | anneau de focus, aligné sur l'accent |
| `--success` | émeraude (coïncidait avec `--accent`) | inchangé (`160 84% 33%`) | seul porteur du vert désormais — la coïncidence de valeur avec l'ancien accent disparaît |

**La règle de contraste de l'or reste celle déjà validée pour l'émeraude
en §2** : jamais en texte de paragraphe, uniquement pastille/icône/fond de
bouton. `font-serif` (Playfair Display, chargée à côté d'Inter) est
réservée aux éléments de marque et aux grands titres (page de connexion,
libellé du rail) — jamais aux tableaux denses ni au corps de texte, qui
restent en `font-sans` (Inter) pour la lisibilité chiffrée.

## 2. Règles de contraste validées (audit WCAG réel)

Calculé sur fond blanc (`--card`) :

| Couleur | Ratio | Verdict texte (AA 4,5:1) | Usage |
|---|---|---|---|
| `--foreground` | ≈15,0:1 | ✓ AAA | texte, chiffres, barres pleines |
| `--primary` | ≈14,1:1 | ✓ AAA | barres de tally, lignes héros |
| `--destructive` | ≈5,8:1 | ✓ AA | **autorisé en texte** (« Supprimer », écart ≠ 0 en rouge) |
| `--muted-foreground` | ≈4,9:1 | ✓ AA | texte secondaire/méta |
| `--success` (émeraude) | ≈3,5:1 | ✗ trop faible en texte | **point/puce uniquement**, jamais le mot |
| `--warning` (orange) | ≈3,0:1 | ✗ trop faible en texte | **point/puce uniquement**, jamais le mot |

**Règle appliquée partout** : un statut (`StatusDot`) est toujours
`<span class="dot" /> + texte en --foreground` — la couleur ne porte jamais le
mot lui-même, sauf `--destructive` qui est assez contrasté pour être du texte
directement (ex. montant d'écart en rouge).

## 3. Système d'espacement — canevas / feuilles

- **Canevas de page** : `bg-muted` (au lieu de `bg-background`) sur le
  conteneur de contenu principal (`AppLayout` / la zone à droite du rail).
  Les tokens `--background` et `--muted` sont très proches en luminosité
  (98 % vs 95 %) — insuffisant seul pour séparer visuellement des panneaux
  sans ombre. `--muted` donne un vrai contraste perceptible contre les
  feuilles blanches (`bg-card`).
- **Feuilles** (panneaux de contenu, remplace les `Card` à ombre) :
  `bg-card border border-border rounded-sm` — `rounded-sm` calcule déjà à 6px
  avec le `--radius` actuel (10px − 4px), pas besoin d'un nouveau token de
  rayon.
- **Écart entre sections** : `gap-7` / `mt-7` (28px, déjà dans l'échelle
  Tailwind par défaut) entre feuilles empilées. `gap-5` (20px) à l'intérieur
  d'une grille de feuilles côte à côte (ex. les 3 panneaux du dashboard).
- **Topbar** : reste `bg-card` (blanc), `border-b-2 border-foreground` au lieu
  d'un simple `border-b` — sépare nettement la chrome fixe du canevas
  scrollable.

## 4. Tableaux denses

- **Filet renforcé toutes les 5 lignes** (`border-rule-strong` au lieu de
  `border-border` sur `tr:nth-child(5n)`) — convention du papier ledger, pas
  de zébrage (casse l'identité encre-sur-papier et n'aide pas plus qu'un
  comptage par 5).
- **Colonnes de référence** (RNE, TVA, Code, numéros de facture/déclaration…)
  en `font-mono text-muted-foreground` — déjà en place pour TVA/Code dans
  `SocietesListPage`, à généraliser aux autres identifiants.
- **Statut** = `StatusDot` (voir §2), jamais de badge plein coloré.
- **Actions** :
  - **Clic sur la ligne = action principale** (celle qu'on ferait le plus
    souvent : « Voir » pour une société, ouvrir le classeur pour une
    collecte, « Modifier » pour un mouvement de stock).
  - Le menu « ⋯ » (kebab) ne regroupe que les **actions secondaires et
    destructrices** (Dupliquer, Modifier si ce n'est pas l'action
    principale, Supprimer).
  - **Le kebab n'est pas systématique** : s'il n'y a que 1 ou 2 actions
    au total (ex. Modifier/Supprimer sur un mouvement de stock, Supprimer
    seul sur une collecte), elles restent en icônes directes — le kebab ne
    sert qu'à désencombrer les lignes à 3 actions ou plus.
  - Tri au clic sur les colonnes déjà triables aujourd'hui (comportement
    inchangé, seul l'indicateur visuel — un petit triangle — change de
    style).
- **En-tête collant** (`sticky top-0`) sur les tableaux longs.
- **Nombres** : `tabular-nums` partout où des chiffres s'empilent en colonne
  (quantités, montants, compteurs).

## 5. Pictogrammes par forme — pas seulement par couleur

Un repère visuel ne doit jamais dépendre uniquement d'une couleur pour être
identifié en scan rapide (voir §2 : deux des couleurs de statut sont trop
faibles en contraste pour porter seules l'information, et au-delà de
l'accessibilité, la forme se reconnaît plus vite que la lecture d'un texte) :

| Élément | Silhouette | Différenciation interne |
|---|---|---|
| Personne (avatar direct) | **cercle** | initiales |
| Groupe de discussion | **carré arrondi** (squircle) | initiales |
| Fichier / document | **carré arrondi**, pictogramme dédié | doc à lignes (PDF générique) vs doc à grille (tableur) — jamais juste « PDF »/« XLS » en texte seul |
| Statut (Actif/Inactif/…) | point carré 7×7 | couleur (voir §2) + mot toujours présent |

## 6. Rail de navigation hybride

- Architecture : primitives officielles shadcn `Sidebar` composées dans
  `src/components/layout/sidebar/`, avec tiroir sous `lg` (1024 px).
- Par défaut : **icône + libellé visibles** (pas de mode réduit par défaut).
- Bouton « Réduire » en pied de rail : bascule vers icône seule + info-bulle
  au survol (remplace le libellé).
- **État persisté** : déjà en place, `src/store/ui.ts` (`useUi`, middleware
  `persist`, clé `cabinet-ui`, ne persiste que `collapsed`). Rien à changer
  ici : `SidebarProvider` est contrôlé par cet état.
- Item actif : filet gauche or `--sidebar-primary` + fond interactif marine
  `--sidebar-accent`, pas de halo/pilule pleine.
- Groupes « Sociétés » et « États financiers » : chevron + sous-liste
  indentée avec filet gauche ; en mode icône, accès par menu flottant.

## 7. Périmètre validé

Direction étendue à **toute l'application** (chrome globale + composants
partagés `src/components/ui` et `src/components/common`, qui cascadent
automatiquement vers tous les écrans qui les consomment). Les écrans
spécifiques déjà passés en revue en détail : Dashboard, Sociétés, Collecte
de pièces, Gestion de stock, Bordereaux bancaires, rail de navigation,
topbar, connexion. Les autres écrans (Tâches, Employés, Structuration,
Messagerie, Journal, Paramètres) héritent des mêmes composants partagés
mais n'ont pas encore été revus individuellement pour du contenu bespoke
propre à chaque page.

## 8. Guide de style — synthèse

Référence rapide pour tout nouveau composant (voir §1–§6 pour le détail et
le raisonnement).

**Typographie**
| Usage | Classe | Notes |
|---|---|---|
| Titre de page (H1) | `font-serif text-2xl font-bold` (`LedgerPageHeader`/`PageHeader`) | seul niveau en serif (Playfair Display) — signature de marque |
| Titre de section (H2, feuilles) | `text-[0.86rem] font-bold` sans-serif | `LedgerSheetHeader` |
| Corps / tableaux / formulaires | `text-sm` Inter | jamais de serif sur du texte dense — lisibilité |
| Méta / labels | `text-xs font-bold uppercase tracking-wide` | boutons-liens, en-têtes de colonnes triables |

**Rayons** (cohérents sur toute l'app, jamais mélangés sur un même type de surface) :
- `rounded-full` — badges/pills, avatars, monogramme de marque.
- `rounded-2xl` — feuilles/cartes (`LedgerSheet`, `DataTable`), modales (`Dialog`, `Sheet`).
- `rounded-xl` — champs de formulaire (`Input`, `Select`, `Textarea`), boutons, listes de tabs.
- `rounded-lg` / `rounded-sm` — éléments internes plus petits (items de select/dropdown).

**États interactifs**
- Focus (champs) : bordure `--ring` + halo `ring-2 ring-ring/40` (pas d'offset) — jamais l'or clair de `--accent` seul, insuffisant en contraste non-textuel sur fond blanc (voir `--ring` dans `index.css`).
- Focus (boutons/icônes) : `ring-2 ring-ring ring-offset-2`.
- Hover (cartes cliquables) : léger soulèvement (`hover:-translate-y-0.5`) + `shadow-card-hover`, jamais de changement de couleur de fond brutal.
- Disabled : `opacity-50` + `pointer-events-none`/`cursor-not-allowed`, jamais de suppression du contraste du texte en dessous de AA.

**Couleur** — voir §1bis et §2 : `--primary` (marine) = encre/texte, `--accent` (or) = fond de bouton/badge/icône/décor uniquement (jamais texte de paragraphe), `--success`/`--warning` = pastille uniquement, `--chart-1..5` = wayfinding (séries de graphiques, badges de catégorie, filet d'accent par section topbar/KPI) — jamais une couleur choisie au hasard hors de cette liste.
