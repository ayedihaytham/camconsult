# Phase 0 — contrats de domaine

La [spécification](SPECIFICATION.md) gouverne le domaine ; la demande utilisateur
autorise les phases successives sans arrêt d'approbation. Achats seulement.

- Une autorisation possède plusieurs BC ; un BC possède un fournisseur ; une
  facture appartient à un seul BC. Toutes les références portent la société.
- Admin et responsable des collaborateurs : préparation, revue et validation.
  Collaborateur : préparation sur son périmètre. Compte société : aucun accès.
- Montants bigint en millimes, chaînes JSON ; taux entier en points de base.
  Arrondi provisoire demi supérieur par facture, jamais présenté comme officiel.
- Dates partielles conservées sans jour inventé. Avoirs hors périmètre.
- Revue des anomalies liée à la version des données ; toute modification invalide
  les acquittements antérieurs. Blocages non acquittables.
- Déclaration : brouillon → prêt à valider → validé (immuable). Dépôts séparés :
  déposé → accepté/rejeté, avec preuve. Rectification = nouvelle version.
- Pas de suppression de données fiscales. Les FK société restent restrictives.
  Preuves et exports figés par empreinte ; aucune suppression automatique.

## Sources vérifiées

Stock possède plusieurs lignes achat par mouvement ; les ventes sont exclues.
Fournisseurs lit ces achats sans référentiel d'identité fiscale partagé.
Collecte et noeuds stockent des data URLs modifiables/supprimables : copier la
preuve dans un objet immuable avant utilisation fiscale. Notifications existantes
incluent des clients : destinataires internes explicitement filtrés.

Échantillons privés trouvés dans Downloads (aucune copie Git) : BCD de 108160
octets, 208 enregistrements (EF 220, 206 DF 521, TF 198), et Excel avec feuilles
Factures / Société. La plage Excel couvre 143 lignes mais comporte 46 cellules
et trois lignes candidates, dont une invalide ; elle ne contient pas 140 factures.

## Fondations retenues et implémentées

DDL additive dans `server/apurement/schema.sql`, enregistrée par ensureSchema.
Modules `amounts`, `domain`, `permissions`, `audit` et tests synthétiques.
API sous `/api/apurement`, erreurs `{error:message,code,fields?}` compatibles
avec le client existant. Versions attendues obligatoires sur modifications.

Codes de contrôle : DATE_INCOMPLETE, BC_MANQUANT, IDENTITE_NON_VERIFIEE,
TVA_MANUELLE, HORS_PERIODE, AVANT_BC, ECART_STOCK, PIECE_MANQUANTE,
DOUBLON_POSSIBLE, ARRONDI_NON_VALIDE. Blocages distincts des avertissements.
