# Banc d'essai de l'extraction (module Gestion de stock)

Compare plusieurs modèles de vision sur **vos propres pièces** : exactitude champ par champ, durée, jetons et coût.
Le script (`app comptabole/server/scripts/benchmark-extraction.mjs`) ne fait que lire : rien n'est enregistré dans l'application.

## 1. Préparer les documents

1. Créez le dossier `app comptabole/benchmark/` (ignoré par Git : les pièces clients ne sont jamais commitées).
2. Déposez-y **une page par pièce** (PDF d'une page, PNG ou JPG). Visez 20 pièces variées : factures d'achat et de vente (lisibles et mauvaises), déclarations douanières, lignes multiples, scans inclinés.
3. Pour **mesurer l'exactitude**, ajoutez à côté de chaque pièce un fichier de vérité, **relu par un humain**, du même nom :
   `facture-01.pdf` → `facture-01.expected.json` (pour une page d'un PDF multi-pages : `nom.p2.expected.json`).

```json
{
  "type": "achat",
  "date": "2023-01-02",
  "numFacture": "6608000533",
  "partie": "SOCIETE DES CIMENTS D'ENFIDHA",
  "devise": "EUR",
  "lignes": [
    { "designation": "Portland Cement CEM I 42,5 N", "quantite": 1000, "prixUnitaire": 52, "montantDevise": 52000 }
  ]
}
```

Pour une déclaration douanière : `{ "type": "douane", "numDeclaration": "447898", "date": "2023-01-03", "regime": "E" }`.
Seuls les champs présents dans le fichier sont notés. Sans fichier de vérité, le rapport HTML affiche les lectures côte à côte.

PDF scannés : le script a besoin de poppler (`choco install poppler`) pour transformer les pages en images. Les PDF numériques et les images n'en ont pas besoin.

## 2. Lancer

La clé `ANTHROPIC_API_KEY` est lue dans `app comptabole/.env`.

```bash
cd "app comptabole"
npm run benchmark:extraction -- \
  --claude claude-sonnet-5-5,claude-haiku-4-5-20251001 \
  --societe "01-RUSPINA" \
  --price claude-sonnet-5-5=3,15
```

- `--claude` : identifiants de modèles, séparés par des virgules (autant que vous voulez).
- `--price modèle=entrée,sortie` : prix en dollars par million de jetons, **à relever sur les pages de tarifs des fournisseurs** (les valeurs ci-dessus ne sont que des exemples). Sans prix, le script affiche les jetons mais pas le coût.
- `--societe` : raison sociale injectée dans la consigne (elle sert à distinguer achat et vente).
- `--repeat 3` : répète chaque lecture (mesure la régularité), `--dir`, `--out` : dossiers d'entrée et de sortie.

## 3. Lire le résultat

Un tableau s'affiche dans le terminal, et un rapport `benchmark-results/rapport-….html` détaille chaque pièce (vert = tous les champs justes, rouge = écarts).

- **Champs justes** : part des champs vérifiés lus correctement (type, date, n° de facture ou de déclaration, tiers, devise, régime).
- **Lignes retrouvées** : part des lignes de produits attendues retrouvées (quantité et montants à 0,5 % près) ; **lignes exactes** : part des lignes lues qui sont justes (mesure les lignes inventées).
- **Durée** et **jetons** : le coût réel par page vient de ces jetons.

Critère de choix conseillé : d'abord les **lignes et montants** (une erreur de chiffre est la plus coûteuse), puis le n° de facture, puis le coût.

## 4. Appliquer le choix, sans toucher au code

Variables d'environnement de l'application (fichier `.env` du serveur, puis recréer le conteneur) :

| Variable | Rôle | Défaut |
|---|---|---|
| `CLAUDE_EXTRACT_MODEL` | modèle Claude utilisé | `claude-sonnet-5-5` |

Les documents du banc d'essai sont envoyés aux fournisseurs testés (Anthropic) : n'y mettez que des pièces que vous avez le droit de leur transmettre.
