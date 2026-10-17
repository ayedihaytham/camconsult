# Facturation électronique (El Fatoora / TEIF)

Statut : **étapes 1 et 2 réalisées** — génération, contrôle, **signature XAdES** avec le certificat du cabinet et téléchargement du message TEIF. Aucun dépôt
automatique chez TTN (étape 3) : le fichier signé se dépose à la main sur le portail El Fatoora.
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
c'est ce fichier, octet pour octet, qui est signé à l'étape 2 (voir ci-dessous).

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

## Signature électronique (étape 2)
Conforme à la spécification TTN « Signature électronique, plateforme El Fatoora » (pack, fichier `Specifications_Techniques_Signature_Fournisseur_V3.0.pdf`).

### Parcours (administrateur)
1. **Facturation › Signature** : charger le fichier du certificat du cabinet (`.p12` / `.pfx`) et son mot de passe. Le serveur vérifie le fichier (clé RSA ≥ 2048 bits, certificat
   valide, clé correspondant au certificat), le **chiffre** puis l'enregistre. La signature est déverrouillée dans la foulée.
2. **Déverrouiller la signature** : le mot de passe est ressaisi quand la signature est verrouillée. Le serveur garde la clé **en mémoire 15 minutes**, puis l'oublie (un redémarrage du
   serveur la verrouille aussi). 5 mots de passe incorrects en 15 minutes bloquent les essais pendant la fenêtre restante.
3. **Facture électronique › Signer la facture** (après préparation, avec confirmation) : le message préparé est signé et enregistré. Il ne peut plus être régénéré, modifié ni annulé
   (le déclencheur `facture_einvoice_pieces_figees_trg` l'impose aussi en base). Téléchargement : XML signé (par défaut) ou sans signature.

### Sécurité du certificat
- Fichier **chiffré** en base (`signature_certificat.p12_chiffre`) : AES-256-GCM, clé dérivée (HKDF-SHA256) de la variable serveur **`SIGNATURE_CLE_SECRET`** (32 caractères au moins, jamais en base
  ni dans le dépôt). Sans cette variable, la signature est **désactivée** (503 au chargement d'un certificat).
- Le **mot de passe du certificat n'est jamais enregistré**, ni journalisé, ni renvoyé ; les messages d'erreur n'en contiennent pas.
- La clé privée n'est jamais écrite sur disque ; elle n'existe qu'en mémoire du serveur pendant le déverrouillage.
- **À faire côté serveur** : définir `SIGNATURE_CLE_SECRET` (`openssl rand -hex 32`) dans `/opt/camconsult/.env`, et vérifier que `docker-compose.yml` la transmet (ligne ajoutée dans `deploy/docker-compose.yml`) ;
  la **sauvegarder séparément** de la base (coffre de mots de passe). Si elle est perdue ou changée, le certificat enregistré devient illisible : il suffit de le recharger.
- Journal d'activité : chargement, remplacement, suppression, déverrouillage, verrouillage et signature sont tracés (sans secret). Le contrôle de configuration signale l'absence ou la faiblesse de la clé.

### Ce qui est signé (spécification V3.0)
- Un seul bloc `ds:Signature Id="SigFrs"` (XAdES-B enveloppée) placé après `InvoiceBody`, avant tout `RefTtnVal` ajouté plus tard par TTN.
- Référence 1 (`r-id-frs`, `URI=""`) : message sans `ds:Signature` ni `RefTtnVal`, canonicalisation exclusive, SHA-256. Référence 2 : propriétés signées `xades-SigFrs`. Signature RSA-SHA256.
- Propriétés signées : heure (UTC), certificat (`SigningCertificateV2` : empreinte SHA-1 comme dans l'exemple officiel, `IssuerSerialV2`), politique `urn:2.16.788.1.2.1.3` avec
  l'empreinte SHA-256 `ZKLu5TojntPu+bUfZyjaEDvkYsAh7eyyV+Hf8nUSQEE=` — **recalculée sur le PDF publié** à l'adresse de la politique (identique à l'exemple), rôle « Fournisseur ».
- Le bloc est écrit sans retrait autour : retirer la signature redonne exactement le message préparé, dont l'empreinte est celle de la référence 1. On ne signe que le fichier préparé : si les
  données (facture, cabinet, client) ont changé depuis, la signature est refusée (« régénérez le fichier »).
- La canonicalisation (`server/signature/c14n.js`) travaille sur l'arbre que l'application a elle-même produit ; elle est vérifiée par la bibliothèque indépendante `xml-crypto` (accord exact sur
  le message complet et sur des textes difficiles), qui relit aussi les deux empreintes et la valeur de signature du fichier signé.

### Dépendances ajoutées
- **`node-forge` 1.4.0** (production, BSD-3-Clause) : seule utilisation = lire le fichier PKCS#12 (`node:crypto` ne le sait pas). `npm audit` signale l'avis **GHSA-86w9-cpqp-85rv** (vérification de signature
  RSA PKCS#1 v1.5 trop permissive, versions ≤ 1.4.0, **aucun correctif publié**). **Risque accepté** : l'application n'appelle jamais la vérification de signature de node-forge (les signatures sont créées
  et contrôlées avec `node:crypto`) ; la lecture du .p12 n'est accessible qu'à l'administrateur connecté, pour un fichier qu'il téléverse lui-même. À réévaluer quand un correctif sort.
- **`xml-crypto` 6.4.0** (développement seulement, MIT) : vérificateur indépendant utilisé par les tests ; absent de l'image de production.

### Vérifications faites / à faire par vous
- **Faites (tests automatiques)** : chiffrement et falsification du coffre, lecture de .p12 (3DES, AES-256, formats OpenSSL 3 modernes et hérités), certificat expiré / clé faible / sans clé,
  déverrouillage et expiration, limite d'essais, c14n contre `xml-crypto`, empreintes et signature relues indépendamment, `IssuerSerialV2` et `CertDigest` comparés au certificat de l'exemple officiel
  TTN, parcours complet sur PostgreSQL jetable (chargement chiffré, signature, immutabilité, journal sans secret). Tous avec des certificats **fictifs**.
- **À faire** : signer une facture de test avec **votre vrai certificat** (mot de passe saisi dans l'application uniquement), télécharger le XML signé, le contrôler avec l'outil
  **ETSI Signature Conformance Checker** (compte gratuit à créer ; profil « ETSI EN 319 132-1 v1.0.0 Building Blocks and Baseline »), puis le déposer sur le portail de test El Fatoora.
- **Certificats hébergés** (ID-Trust, DigiGo, Mobile ID…) : la spécification les accepte, mais ils n'offrent en général pas de fichier `.p12` exportable ; ils ne fonctionnent pas avec cette étape.

### Points à confirmer auprès de TTN / de l'ANCE
1. La spécification indique que « la solution de signature électronique doit être homologuée auprès de l'ANCE » : demander si cela vise un éditeur de solution ou aussi un outil interne qui signe
   les factures de son propre cabinet. L'acceptation réelle par TTN se constate au premier dépôt.
2. Empreinte et version actuelles de la politique de signature (le PDF publié correspond à l'exemple V3.0 du 29/05/2026).
3. `SigningCertificateV2` avec une empreinte SHA-1 (reprise de l'exemple officiel) et rôle « Fournisseur » : suivis à la lettre ; à reconfirmer si TTN refuse.
4. Le chiffrement `.p12` « moderne » (PBES2/AES) est pris en charge ; un certificat dont le fichier utiliserait un algorithme rare pourrait être refusé au chargement avec un message explicite.

## Étapes suivantes (non réalisées)
- **Dépôt et suivi** : web service SOAP `saveEfact` / `consultEfact` (adresse du WSDL en HTTP : HTTPS à confirmer), identifiants TTN en variables d'environnement,
  stockage de la référence TTN et du QR (`RefTtnVal`), copie de facture avec QR, états déposée / validée / rejetée.
- **Avoirs** et **retenue à la source** après confirmation.
