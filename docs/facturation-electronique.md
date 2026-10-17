# Facturation électronique (El Fatoora / TEIF)

Statut : **étape 1 réalisée** — génération, contrôle et téléchargement du message TEIF **non signé**. Aucune signature, aucun dépôt chez TTN.
Plan complet et décisions : voir la conversation d'origine ; ce document décrit ce qui existe et ce qui reste à confirmer.

## Ce que fait l'étape 1
Pour une facture d'honoraires du cabinet (module Facturation, administrateur seulement) :

1. **Contrôle de conformité** (`GET /api/facturation/:id/einvoice`) : liste de points *bloquants* ou *à vérifier*, chacun avec l'endroit où corriger
   (cabinet, société cliente, facture). Rien n'est enregistré.
2. **Préparation** (`POST …/einvoice/preparer`) : produit le message TEIF 1.8.9 (facture, `I-11`), l'enregistre avec son empreinte SHA-256 dans
   `facture_einvoice` (statut `prete`) et le journalise. `POST …/einvoice/regenerer` le refait tant qu'il est `prete`.
3. **Téléchargement** (`GET …/einvoice/xml`) : fichier `<numéro>.xml` (règle de nom du dépôt TTN), sans mise en cache.

Le fichier se dépose ensuite **à la main** sur le portail El Fatoora. Une facture électronique « signée » ou « déposée » (stades futurs) ne peut plus
être annulée ici (il faudra un avoir).

## Correspondance facture → TEIF
| Donnée | Élément TEIF | Remarque |
| --- | --- | --- |
| Matricule fiscal du cabinet / du client | `MessageSenderIdentifier` / `MessageRecieverIdentifier` et `PartnerIdentifier` (`I-01`) | validé par `shared/mf.js` (13 car., clé sans I/O/U, code TVA A/B/D/N/P, catégorie C/M/N/P/E, établissement 3 chiffres) |
| Numéro `AAAA-0001` | `Bgm/DocumentIdentifier`, type `I-11` « Facture » | 30 car. au plus, sans espace, accent ni « / » |
| Date d'émission / échéance | `Dtm/DateText` `I-31` / `I-32`, format `ddMMyy` | |
| Cabinet / client | `PartnerDetails` `I-62` / `I-64` : nom, adresse (rue, ville, code postal, pays), registre de commerce (`I-815`, cabinet seulement) | rue et ville ≤ 35 car. |
| RIB du cabinet | `PytSection` `I-114` « Paiement par virement bancaire au RIB … » | omis si vide |
| Note de la facture | `Ftx/FreeTextDetail` `I-48` | omise si vide |
| Ligne | `Lin` : `ItemCode` `L<n>`, description, quantité (unité `UNIT`), `LinTax` `I-1602`, prix unitaire HT `I-183`, total ligne `I-171` | |
| Totaux | `InvoiceMoa` : `I-176` HT, `I-182` base, `I-181` TVA seule, `I-180` TTC avec montant en lettres | TTC = HT + TVA + timbre |
| TVA / timbre | `InvoiceTax` : `I-1601` timbre (taux 0, montant `I-178`), `I-1602` TVA (base `I-177`, montant `I-178`) | timbre omis s'il est nul |

Conventions : montants avec **point et 3 décimales** (« 700.000 »), caractères interdits en XML retirés, texte échappé, montant en lettres en
**majuscules sans accent** (règle partagée avec l'impression : `shared/montantEnLettres.js`). La sortie est déterministe (mêmes octets pour les mêmes données) :
c'est ce fichier qui sera signé à l'étape suivante.

### Règle d'arrondi (bloquante)
TTN attend que le total HT soit la somme des totaux de lignes (`I-171`). Chez nous, le total HT de la facture est arrondi **une seule fois** depuis des
lignes non arrondies (`shared/factureTotaux.js`). Si la somme des lignes arrondies au millime diffère du total, la préparation est **refusée** avec un message
(« ajustez les quantités ou les prix ») : aucun arrondi silencieux. Un prix unitaire ou une quantité à plus de 3 décimales est aussi refusé.

## Validation du message
- **Contrôle interne** (`server/teif/validerTeif.js`) à chaque préparation.
- **Test de conformité au schéma TTN 1.8.9** (`server/teif/xsd.test.js`) : lit le schéma dans le pack `samples/Specifications_techniques_Elfatoora (2).zip`
  (document de TTN, non versionné ; test ignoré s'il est absent) et valide le XML avec `xmllint-wasm`. Le schéma utilise des *assertions XSD 1.1* que libxml2 ne
  sait pas exécuter : elles sont retirées pour ce test (leurs règles — matricule fiscal, numéro de facture — sont couvertes par `shared/mf.js` et `validerTeif.js`).
- **Vérification complète à faire par vous**, hors application : valider le XML téléchargé avec un validateur XSD **1.1** (Xerces-J avec XSD 1.1, ou Saxon-EE)
  contre `1_8_9_XSD_withoutSig.xsd`, puis le déposer sur le portail El Fatoora de test.

## À confirmer auprès de TTN ou de votre comptable
1. **Version du message** : `1.8.9` envoyée (1.8.8 acceptée par le schéma ; le guide v2.0 documente 1.8.7).
2. **Type de document** : `I-11` Facture (choix retenu). `I-13` « Note d'honoraire » existe : acceptation et usage à confirmer pour des honoraires.
3. **Unité** de quantité (`UNIT`, comme l'exemple TTN) et code article (`L1`, `L2`…).
4. **TVA à 0 % / exonération / suspension** : le pack ne détaille pas le traitement ; avertissement affiché.
5. **Retenue à la source** (`I-1604`) : présente dans le guide mais **absente de tous les schémas** (un XML qui l'utilise serait refusé) ; non gérée.
6. **Avoirs** (`I-12`, référence `I-89`) : convention de signe non documentée ; hors étape 1 (décision D4).
7. **Registre de commerce du client** (`I-815`) : non envoyé (le champ RNE de la société n'est pas équivalent) ; contacts (`CtaSection`) non envoyés (facultatifs).
8. **Caractères accentués** : conservés dans les descriptions ; la spécification de signature recommande d'éviter les caractères spéciaux.
9. **Documents anciens** : pack de 2016 à 2021 ; confirmer que les règles sont toujours en vigueur (obligation, version, certificat).

## Étapes suivantes (non réalisées)
- **Signature XAdES** (certificat qualifié TunTrust/ANCE, politique de signature TTN, transformations XPath « exclure `ds:Signature` et `RefTtnVal` » + c14n exclusive,
  RSA-SHA256) : la clé privée ne doit jamais être en clair dans `.env` ni en base ; décision à prendre (fichier chiffré sur le serveur ou signature locale hors serveur).
- **Dépôt et suivi** : web service SOAP `saveEfact` / `consultEfact` (adresse du WSDL en HTTP : HTTPS à confirmer), identifiants TTN en variables d'environnement,
  stockage de la référence TTN et du QR (`RefTtnVal`), copie de facture avec QR, états déposée / validée / rejetée.
- **Avoirs** et **retenue à la source** après confirmation.
