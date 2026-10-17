# Contrat Stock ↔ Apurement

Un lien explicite par mouvement achat. Date, numéro et nom fournisseur sont
partagés ; TVA, autorisation, BC et identité fiscale restent dans Apurement.
Marchandises, quantités, prix, ventes et devises restent dans Stock.

Coordination directe dans la transaction PostgreSQL, jamais HTTP interne.
Le verrou société précède toujours les verrous de lignes. Toutes les écritures
Stock/Apurement et validations partagent cette barrière ; les services peuvent
ensuite verrouiller leurs lignes sans inversion concurrente dans la même société.
Empreinte source, version facture et révision Stock issue du formulaire refusent
409 les onglets périmés. L'origine est auditée. Un ancien formulaire Stock sans
révision ne peut pas modifier une facture liée : rechargement obligatoire.

Stock → Apurement : total exact des seules lignes achat ; repli documenté sur
achat_montant_tnd uniquement en absence de lignes. Une TVA manuelle est conservée.
Apurement → Stock : en-tête ; correction monétaire uniquement après confirmation
explicite si une seule ligne, quantité 1, devise TND et cours 1. Dans ce cas, prix
unitaire et montants devise/TND restent égaux et exacts ; les identifiants et
quantités de ligne sont préservés. Tout cas complexe est refusé avec conflit à
résoudre dans les lignes Stock (B5), sans répartition arbitraire.
Suppression d'un mouvement lié refusée ; déliaison explicite pour brouillons.
Toute modification après validation laisse le snapshot intact et signale l'écart.
Une simple correction de TVA ou de numéro conserve le nom fournisseur Stock,
y compris son alias. Un changement de fournisseur passe par une correction
explicite dans Stock, puis la confirmation du BC correspondant dans la résolution.

Les preuves sont copiées à l'association dans un stockage SQL adressé par hash.
Les listes ne renvoient pas les octets. Pas de politique de purge implicite.
