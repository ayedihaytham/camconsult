create table if not exists app_meta (
  id                   int primary key default 1,
  admin_identifiant    text not null,
  admin_password_hash  text not null,
  admin_nom            text not null,
  admin_role           text not null,
  constraint app_meta_singleton check (id = 1)
);

create table if not exists societes (
  id             uuid primary key default gen_random_uuid(),
  raison_sociale text not null,
  rne            text not null default '',
  tva            text not null default '',
  theme          text not null default 'PME',
  code           text not null,
  identifiant    text not null default '',
  mot_de_passe   text not null default '',
  statut         text not null default 'actif',
  telephone      text not null default '',
  email          text not null default '',
  adresse        text not null default '',
  cree_le        date not null default current_date
);

create table if not exists employes (
  id                 uuid primary key default gen_random_uuid(),
  nom                text not null,
  prenom             text not null,
  identifiant        text not null unique,
  mot_de_passe       text not null,
  type               text not null default 'Assistant',
  email              text not null default '',
  statut             text not null default 'actif',
  societes_assignees jsonb not null default '[]'::jsonb,
  permissions        jsonb not null default '{}'::jsonb,
  cree_le            date not null default current_date
);

create table if not exists noeuds (
  id          uuid primary key default gen_random_uuid(),
  libelle     text not null,
  description text not null default '',
  type        text not null default 'dossier',
  societe_id  uuid references societes(id) on delete cascade,
  parent_id   uuid references noeuds(id) on delete cascade,
  format      text,
  taille      text,
  data_url    text,
  maj_le      date not null default current_date
);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  auteur_id       text not null,
  contenu         text not null default '',
  envoye_le       timestamptz not null default now(),
  statut          text not null default 'envoye',
  piece_jointe    jsonb
);

create table if not exists journal (
  id     uuid primary key default gen_random_uuid(),
  at     timestamptz not null default now(),
  actor  text not null,
  action text not null,
  entity text not null,
  label  text not null
);

-- Conversations de groupe (les conversations directes restent dérivées : conv-<employeId>)
create table if not exists conversations (
  id         uuid primary key default gen_random_uuid(),
  type       text not null default 'groupe',
  titre      text not null default '',
  membre_ids jsonb not null default '[]'::jsonb,
  cree_le    timestamptz not null default now()
);

-- Collecte de pièces : classeur que le comptable confie au client pour saisie.
-- Une collecte = 1 société + 1 période ; onglets demandés = jsonb de clés.
create table if not exists collectes (
  id          uuid primary key default gen_random_uuid(),
  societe_id  uuid not null references societes(id) on delete cascade,
  periode     text not null,
  statut      text not null default 'brouillon', -- brouillon | transmis | valide | a_corriger
  onglets     jsonb not null default '[]'::jsonb,
  devise      text not null default 'EUR',
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now(),
  transmis_le timestamptz,
  valide_le   timestamptz
);

-- Une ligne de checklist par onglet demandé (commentaire client + suivi).
create table if not exists collecte_sections (
  id          uuid primary key default gen_random_uuid(),
  collecte_id uuid not null references collectes(id) on delete cascade,
  onglet      text not null,
  commentaire text not null default '',
  unique (collecte_id, onglet)
);

-- Lignes de saisie d'un onglet (schéma des colonnes défini côté code).
create table if not exists collecte_lignes (
  id          uuid primary key default gen_random_uuid(),
  collecte_id uuid not null references collectes(id) on delete cascade,
  onglet      text not null,
  ordre       int not null default 0,
  data        jsonb not null default '{}'::jsonb,
  cree_le     timestamptz not null default now()
);

-- Récap d'anomalies : notes libres + cases manquantes ciblées + réponses du client.
create table if not exists collecte_notes (
  id          uuid primary key default gen_random_uuid(),
  collecte_id uuid not null references collectes(id) on delete cascade,
  onglet      text not null default '',
  kind        text not null default 'note',   -- note | manque | reponse
  parent_id   uuid,                            -- kind=reponse -> id du manque
  auteur      text not null default 'admin',   -- admin | client
  ref         text not null default '',        -- kind=manque : « Ligne 3 · Montant »
  cible_ordre int,                             -- kind=manque : index de ligne (null = tableau entier)
  cible_col   text,                            -- kind=manque : clé de colonne (null = tableau entier)
  texte       text not null default '',
  resolu      boolean not null default false,
  cree_le     timestamptz not null default now()
);
alter table collecte_notes add column if not exists cible_ordre int;
alter table collecte_notes add column if not exists cible_col text;

-- Pièces jointes réellement déposées (PDF/photo), au niveau de la collecte
-- ou rattachées à un onglet précis (onglet = '' -> pièce générale).
create table if not exists collecte_fichiers (
  id          uuid primary key default gen_random_uuid(),
  collecte_id uuid not null references collectes(id) on delete cascade,
  onglet      text not null default '',
  nom         text not null,
  format      text,
  taille      text,
  data_url    text not null,
  depose_par  text not null default '',
  cree_le     timestamptz not null default now()
);

-- Bordereaux bancaires : registre interne du cabinet (comptable seul).
-- 1 bordereau = 1 opération bancaire groupant plusieurs lignes.
create table if not exists bordereaux (
  id             uuid primary key default gen_random_uuid(),
  type           text not null default 'remise_cheque', -- virement | remise_traite | remise_cheque
  volet          text not null default 'client',        -- client (411) | fournisseur (401)
  numero         text not null default '',
  date_operation date,
  pointe         boolean not null default false,
  note           text not null default '',
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now()
);

create table if not exists bordereau_lignes (
  id           uuid primary key default gen_random_uuid(),
  bordereau_id uuid not null references bordereaux(id) on delete cascade,
  ordre        int not null default 0,
  cheque       text not null default '',
  tiers        text not null default '',
  montant      numeric not null default 0,
  facture      text not null default '',
  remarque     text not null default ''
);

-- Gestion de stock (par société) : une ligne = un mouvement achat + vente
-- appariés, avec écart de quantité (doit tendre vers 0 — régime suspensif
-- douanier : tout ce qui est acheté doit être revendu/réexporté).
create table if not exists stock_mouvements (
  id                    uuid primary key default gen_random_uuid(),
  societe_id            uuid not null references societes(id) on delete cascade,
  ordre                 int not null default 0,
  nature_marchandise    text not null default '',

  achat_date            date,
  achat_num_facture     text not null default '',
  achat_doc_type        text not null default '',
  fournisseur           text not null default '',
  achat_quantite        numeric not null default 0,
  achat_pu              numeric not null default 0,
  achat_montant_devise  numeric not null default 0,
  achat_devise          text not null default 'EUR',
  achat_cours           numeric not null default 0,
  achat_montant_tnd     numeric not null default 0,

  vente_date            date,
  vente_num_facture     text not null default '',
  vente_doc_type        text not null default '',
  client                text not null default '',
  vente_quantite        numeric not null default 0,
  vente_pu              numeric not null default 0,
  vente_montant_devise  numeric not null default 0,
  vente_devise          text not null default 'EUR',
  vente_cours           numeric not null default 0,
  vente_montant_tnd     numeric not null default 0,

  douane_num_declaration text not null default '',
  douane_date           date,
  douane_regime         text not null default '',
  douane_reference      text not null default '',

  -- Document source (PDF/image, encodé en data URL) conservé pour pouvoir
  -- comparer les chiffres saisis/extraits à la pièce d'origine.
  achat_doc_data_url    text,
  vente_doc_data_url    text,
  douane_doc_data_url   text,

  note                  text not null default '',
  cree_le               timestamptz not null default now(),
  maj_le                timestamptz not null default now()
);
alter table stock_mouvements add column if not exists achat_doc_data_url text;
alter table stock_mouvements add column if not exists vente_doc_data_url text;
alter table stock_mouvements add column if not exists douane_doc_data_url text;

-- Notifications in-app : un enregistrement par destinataire.
-- user_key = 'admin' pour le responsable du cabinet, sinon l'uuid de l'employé.
create table if not exists notifications (
  id       uuid primary key default gen_random_uuid(),
  user_key text not null,
  type     text not null,
  titre    text not null,
  corps    text not null default '',
  lien     text not null default '/taches',
  lu       boolean not null default false,
  cree_le  timestamptz not null default now()
);

-- Tâches : travail confié par l'admin à un collaborateur, rattaché à une société.
-- Backlog permanent ; statut a_faire | en_cours | termine.
create table if not exists taches (
  id          uuid primary key default gen_random_uuid(),
  titre       text not null,
  description text not null default '',
  societe_id  uuid not null references societes(id) on delete cascade,
  assigne_id  uuid references employes(id) on delete set null,
  statut      text not null default 'a_faire',
  cree_par    text not null default '',
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now(),
  termine_le  timestamptz
);

-- États financiers : balance comptable par société/exercice, reclassée par
-- code AFFECTAT (grille de reclassement) — étape 1 du module, alimente plus
-- tard le Bilan/CPC (pas encore construit).
create table if not exists balances (
  id         uuid primary key default gen_random_uuid(),
  societe_id uuid not null references societes(id) on delete cascade,
  exercice   text not null default '',
  note       text not null default '',
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now(),
  unique (societe_id, exercice)
);

create table if not exists balance_lignes (
  id         uuid primary key default gen_random_uuid(),
  balance_id uuid not null references balances(id) on delete cascade,
  ordre      int not null default 0,
  compte     text not null default '',
  libelle    text not null default '',
  debit      numeric not null default 0,
  credit     numeric not null default 0,
  -- Code de reclassement (ex. CP01, AC03, CH02, PR01) — case vide tant que
  -- non assigné ; solde = debit - credit, calculé à la volée (pas stocké).
  affectat   text not null default ''
);

-- Grille de reclassement — référentiel unique partagé par tout le cabinet
-- (pas par société). Les codes existants, pour l'écran d'admin.
create table if not exists grille_affectat_codes (
  code    text primary key,
  libelle text not null default '',
  -- Destination dans le Bilan/Etat de résultat (étape 2) — clé fixe définie
  -- côté frontend (src/lib/etatsFinanciers/postes.ts), vide tant que non
  -- assignée. Plusieurs codes peuvent pointer vers le même poste.
  poste   text not null default '',
  cree_le timestamptz not null default now(),
  maj_le  timestamptz not null default now()
);
alter table grille_affectat_codes add column if not exists poste text not null default '';

-- Mapping appris : dernière association compte -> code AFFECTAT validée par
-- un comptable, réutilisée pour pré-remplir les futurs imports (toutes
-- sociétés confondues — un même plan comptable revient d'un exercice à
-- l'autre).
create table if not exists grille_comptes (
  compte         text primary key,
  affectat_code  text not null default '',
  libelle_compte text not null default '',
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now()
);

-- Ajouts idempotents sur bases existantes
alter table noeuds   add column if not exists cree_le date not null default current_date;
alter table app_meta add column if not exists last_login timestamptz;
alter table employes add column if not exists last_login timestamptz;
-- Rôle du compte : collaborateur (équipe interne) ou societe_employe (employé d'une société cliente)
alter table employes add column if not exists role text not null default 'collaborateur';
alter table employes add column if not exists societe_id uuid references societes(id) on delete cascade;
alter table collectes add column if not exists recap_statut text not null default 'none';
alter table collectes add column if not exists echeance date;
alter table collectes add column if not exists derniere_relance_le timestamptz;
alter table collectes add column if not exists relance_cadence_jours int not null default 3;
alter table collectes add column if not exists rappel_avant_envoye boolean not null default false;
alter table journal add column if not exists entity_id uuid;

create index if not exists noeuds_parent_idx on noeuds(parent_id);
create index if not exists noeuds_societe_idx on noeuds(societe_id);
create index if not exists messages_conv_idx on messages(conversation_id);
create index if not exists journal_at_idx on journal(at desc);
create index if not exists taches_societe_idx on taches(societe_id);
create index if not exists taches_assigne_idx on taches(assigne_id);
create index if not exists taches_statut_idx on taches(statut);
create index if not exists notifications_user_idx on notifications(user_key, cree_le desc);
create index if not exists collectes_societe_idx on collectes(societe_id);
create index if not exists collecte_sections_idx on collecte_sections(collecte_id);
create index if not exists collecte_lignes_idx on collecte_lignes(collecte_id, onglet, ordre);
create index if not exists collecte_notes_idx on collecte_notes(collecte_id);
create index if not exists collecte_fichiers_idx on collecte_fichiers(collecte_id);
create index if not exists journal_entity_idx on journal(entity, entity_id);
create index if not exists bordereaux_type_idx on bordereaux(type, date_operation desc);
create index if not exists bordereau_lignes_idx on bordereau_lignes(bordereau_id, ordre);
create index if not exists stock_mouvements_societe_idx on stock_mouvements(societe_id, ordre);
create index if not exists employes_role_idx on employes(role);
create index if not exists employes_societe_idx on employes(societe_id);
create index if not exists balances_societe_idx on balances(societe_id);
create index if not exists balance_lignes_idx on balance_lignes(balance_id, ordre);

-- Grille de reclassement — pré-remplissage du mapping AFFECTAT -> poste
-- validé avec le cabinet (voir DESIGN-SYSTEM / mémoire du projet). N'écrase
-- jamais une valeur déjà là (ON CONFLICT DO NOTHING) : un comptable qui a
-- déjà réassigné un code garde sa main.
insert into grille_affectat_codes (code, libelle, poste) values
  ('AC01', 'Immobilisations incorporelles', 'actif.immo_incorp_brut'),
  ('AC02', 'Immobilisations financières', 'actif.immo_fin'),
  ('AC03', 'Immobilisations corporelles', 'actif.immo_corp_brut'),
  ('AC04', 'Amortissements des immobilisations corporelles', 'actif.immo_corp_amort'),
  ('AC08', 'Stocks', 'actif.stocks'),
  ('AC10', 'Clients et comptes rattachés', 'actif.clients'),
  ('AC12', 'Autres actifs courants', 'actif.autres_courants'),
  ('AC15', 'Liquidités et équivalents de liquidités', 'actif.liquidites'),
  ('CP01', 'Capital social', 'passif.capital_social'),
  ('CP02', 'Réserve légale', 'passif.reserve_legale'),
  ('CP03', 'Réserve facultative', 'passif.reserve_facultative'),
  ('CP04', 'Résultat reporté', 'passif.resultat_reporte'),
  ('P02', 'Autres passifs financiers (associés)', 'passif.autres_passifs_financiers'),
  ('P03', 'Provisions', 'passif.provisions'),
  ('P04', 'Fournisseurs et comptes rattachés', 'passif.fournisseurs'),
  ('P05', 'Autres passifs courants', 'passif.autres_passifs_courants'),
  ('P06', 'Emprunts', 'passif.emprunts'),
  ('PR01', 'Ventes de marchandises', 'cpc.ventes_marchandises'),
  ('CH02', 'Achats consommés', 'cpc.achats_consommes'),
  ('CHPR1', 'Variation de stock', 'cpc.achats_consommes'),
  ('CH03', 'Charges de personnel', 'cpc.charges_personnel'),
  ('CH06', 'Cotisations sociales sur rémunération des dirigeants', 'cpc.charges_personnel'),
  ('CH04', 'Dotations aux amortissements et provisions', 'cpc.dotations_amort_provisions'),
  ('CH05', 'Charges externes', 'cpc.charges_externes'),
  ('CH07', 'Charges financières', 'cpc.charges_financieres'),
  ('CH12', 'Impôts et taxes', 'cpc.impots_taxes'),
  ('CH08', 'Autres produits ordinaires', 'cpc.autres_produits_ordinaires'),
  ('CH09', 'Autres charges ordinaires', 'cpc.autres_charges_ordinaires'),
  ('CH10', 'Impôt sur les sociétés', 'cpc.impot_societes'),
  ('CH11', 'Impôt sur les sociétés (autres)', 'cpc.impot_societes'),
  ('CH44', 'Reprises sur provisions antérieures', 'cpc.reprises_provisions')
on conflict (code) do update set
  poste   = case when grille_affectat_codes.poste = '' then excluded.poste else grille_affectat_codes.poste end,
  libelle = case when grille_affectat_codes.libelle = '' then excluded.libelle else grille_affectat_codes.libelle end;

-- États financiers, étape 3 : mouvements non déductibles de la seule balance
-- (le solde de fin d'exercice ne dit rien des acquisitions/cessions ni des
-- emprunts contractés/remboursés dans l'année) — saisie manuelle dédiée,
-- une ligne par société/exercice/masse.
create table if not exists immo_mouvements (
  id            uuid primary key default gen_random_uuid(),
  societe_id    uuid not null references societes(id) on delete cascade,
  exercice      text not null default '',
  masse         text not null check (masse in ('incorporelles', 'corporelles', 'financieres')),
  acquisitions  numeric not null default 0,
  cessions      numeric not null default 0,
  dotations     numeric not null default 0,
  reprises      numeric not null default 0,
  maj_le        timestamptz not null default now(),
  unique (societe_id, exercice, masse)
);

create table if not exists financement_mouvements (
  id                        uuid primary key default gen_random_uuid(),
  societe_id                uuid not null references societes(id) on delete cascade,
  exercice                  text not null default '',
  emprunts_contractes       numeric not null default 0,
  emprunts_rembourses       numeric not null default 0,
  dividendes_distribues     numeric not null default 0,
  capital_numeraire         numeric not null default 0,
  -- Ajustement d'exploitation du Flux (méthode indirecte) : intérêts sur
  -- placements courus et non échus — ne peut pas être déduit de la balance
  -- (pas de sous-compte dédié), saisi manuellement comme les autres
  -- mouvements de cette table.
  interets_courus_non_echus numeric not null default 0,
  maj_le                    timestamptz not null default now(),
  unique (societe_id, exercice)
);
alter table financement_mouvements add column if not exists interets_courus_non_echus numeric not null default 0;

-- TDRF : réintégrations/déductions fiscales, saisie libre (jugement
-- professionnel propre à chaque exercice, rien de tout ça n'est dans la
-- balance).
create table if not exists tdrf_lignes (
  id         uuid primary key default gen_random_uuid(),
  societe_id uuid not null references societes(id) on delete cascade,
  exercice   text not null default '',
  ordre      int not null default 0,
  kind       text not null check (kind in ('reintegration', 'deduction')),
  libelle    text not null default '',
  montant    numeric not null default 0,
  maj_le     timestamptz not null default now()
);

-- TDRF (suite) : paramètres du calcul de l'impôt (Annexe n°2, note commune
-- n°26/2016) — CA, taux, plancher, CSS, acomptes : rien de tout ça n'est
-- dans la balance, saisie manuelle par société/exercice comme les autres
-- tables ci-dessus. Taux par défaut = régime commun tunisien (IS 20 %,
-- minimum d'impôt 0,2 % du CA local, plancher 500 DT), modifiables au cas
-- par cas (régimes particuliers, changements de loi de finances d'une année
-- à l'autre). CA scindé local/export et taux IS séparé pour l'export : les
-- sociétés partiellement exportatrices bénéficient d'un taux réduit sur
-- leurs bénéfices (régime commun ~15 %) et d'un taux encore plus favorable
-- sur la part export (~10 %), et le minimum d'impôt ne porte que sur le CA
-- local (la part export en est exclue) — tout reste modifiable par
-- l'expert-comptable, ces pourcentages ne sont que des valeurs de départ.
create table if not exists tdrf_parametres (
  id                      uuid primary key default gen_random_uuid(),
  societe_id              uuid not null references societes(id) on delete cascade,
  exercice                text not null default '',
  chiffre_affaires_local  numeric not null default 0,
  chiffre_affaires_export numeric not null default 0,
  taux_imposition         numeric not null default 0.20,
  taux_export             numeric not null default 0.20,
  taux_minimum            numeric not null default 0.002,
  plancher_minimum        numeric not null default 500,
  contribution_sociale    numeric not null default 0,
  excedents_acomptes      numeric not null default 0,
  maj_le                  timestamptz not null default now(),
  unique (societe_id, exercice)
);
alter table tdrf_parametres add column if not exists chiffre_affaires_export numeric not null default 0;
alter table tdrf_parametres add column if not exists taux_export numeric not null default 0.20;

create index if not exists immo_mouvements_societe_idx on immo_mouvements(societe_id, exercice);
create index if not exists financement_mouvements_societe_idx on financement_mouvements(societe_id, exercice);
create index if not exists tdrf_lignes_societe_idx on tdrf_lignes(societe_id, exercice, ordre);
create index if not exists tdrf_parametres_societe_idx on tdrf_parametres(societe_id, exercice);

-- Notes aux états financiers (étape 4).
-- Le texte des principes comptables (sections "Présentation des états
-- financiers" / "Respect des normes" / "Bases de mesure") est quasi
-- identique d'un client à l'autre : un modèle unique cabinet, avec des
-- jetons {{SOCIETE}}/{{EXERCICE}}/{{DATE_CLOTURE}} substitués à l'affichage,
-- surchargeable par société/exercice si un client a une particularité.
create table if not exists notes_modele (
  id      text primary key default 'default',
  texte   text not null default '',
  maj_le  timestamptz not null default now()
);

-- Fiche société : infos statutaires, objet social, structure du capital —
-- changent rarement, réutilisées chaque exercice (l'évolution du capital
-- est déjà suivie via financement_mouvements.capital_numeraire).
create table if not exists fiche_societe (
  societe_id       uuid primary key references societes(id) on delete cascade,
  forme_juridique  text not null default '',
  statut_fiscal    text not null default '',
  date_creation    date,
  capital_initial  numeric not null default 0,
  parts_initiales  int not null default 0,
  valeur_nominale  numeric not null default 0,
  -- objet_social: [{ titre, texte }] ; associes: [{ nom, valeurParts, parts }]
  objet_social     jsonb not null default '[]',
  associes         jsonb not null default '[]',
  maj_le           timestamptz not null default now()
);

-- Notes par société/exercice : surcharge éventuelle du modèle de texte +
-- blocs narratifs libres (faits marquants, régularisation intergroupe,
-- restructuration financière...) propres à cet exercice.
create table if not exists notes_exercice (
  societe_id      uuid not null references societes(id) on delete cascade,
  exercice        text not null default '',
  texte_override  text not null default '',
  -- blocs_libres: [{ titre, texte }]
  blocs_libres    jsonb not null default '[]',
  maj_le          timestamptz not null default now(),
  primary key (societe_id, exercice)
);

create index if not exists notes_exercice_societe_idx on notes_exercice(societe_id);

insert into notes_modele (id, texte) values ('default',
'Les états financiers de la Sté {{SOCIETE}} arrêtés au {{DATE_CLOTURE}} par la gérance sont établis en respect des caractéristiques qualitatives que doivent revêtir l''information financière, conformément aux dispositions de la norme générale NCT 1.

Caractéristiques qualitatives de l''information : L''information financière élaborée doit ainsi garantir :

L''Intelligibilité : Une présentation claire pour l''ensemble des utilisateurs (associés, banques, administration fiscale).

La Pertinence : Des données utiles à la prise de décision économique, tenant compte du seuil de signification.

La Fiabilité : Une image fidèle de la situation patrimoniale, neutre, vérifiable et exempte d''erreurs significatives.

La Comparabilité : Une permanence stricte des méthodes permettant la comparaison avec les exercices précédents.

Unité monétaire : La comptabilité est tenue et les états financiers sont présentés en Dinar Tunisien (TND).

État de résultat : La méthode retenue pour la présentation de l''état de résultat est la méthode autorisée par le modèle de référence tunisien, classant les charges par nature (par opposition par destination, selon l''option retenue par l''entité).

État de flux de trésorerie : Il est élaboré selon la méthode indirecte, à partir du résultat net de l''exercice retraité des éléments sans incidence sur la trésorerie et de la variation du besoin en fonds de roulement, ventilé entre les activités d''exploitation, d''investissement et de financement.

II- RESPECT DES NORMES COMPTABLES TUNISIENNES

Les états financiers de la Sté {{SOCIETE}} arrêtés au {{DATE_CLOTURE}} sont établis et présentés en respect des prescriptions des Normes Comptables Tunisiennes (NCT), issues du décret n° 96-2459 du 30/12/1996.

Déclaration de conformité : La gérance atteste qu''aucune divergence significative n''existe par rapport aux normes comptables tunisiennes et aux principes comptables retenus pour l''élaboration de ces états financiers.

Traitement des divergences : L''absence de divergence significative confirme qu''aucune dérogation aux règles du référentiel comptable national n''a été nécessaire pour présenter l''image fidèle de la situation financière et du patrimoine de la société à la date de clôture.

III- BASES DE MESURE ET PRINCIPES COMPTABLES

Les principes et méthodes comptables retenus pour l''arrêté des comptes de l''exercice {{EXERCICE}} sont ceux préconisés par les normes comptables généralement admises en Tunisie et conformément aux dispositions de la loi n° 96-112 du 30/12/1996 relative au système comptable des entreprises.

L''application de ce cadre légal repose sur le respect rigoureux des conventions comptables de base ci-après :

Convention de la continuité d''exploitation : Les états financiers ont été préparés sur l''hypothèse que la société poursuivra ses activités dans un avenir prévisible, excluant toute évaluation sur la base de valeurs de liquidation forcée.

Convention de l''indépendance des exercices (Spécialisation) : Les transactions, produits et charges sont rattachés à l''exercice de leur survenance, indépendamment de la date de leur encaissement ou de leur décaissement effectif.

Convention de coût historique : Les éléments d''actif et de passif sont maintenus en comptabilité à leur coût d''origine exprimé en TND, sauf réévaluation non autorisée par la réglementation fiscale en vigueur.

Convention de prudence : Les appréciations dans un environnement d''incertitude sont opérées. Les charges probables constatées au {{DATE_CLOTURE}} sont provisionnées, tandis que les produits ne sont enregistrés que s''ils sont définitivement acquis à la clôture.'
) on conflict (id) do nothing;

-- Correction ponctuelle et idempotente : la première version du modèle
-- (ci-dessus) décrivait à tort la méthode directe pour le Flux de
-- trésorerie ; le document réel du cabinet utilise la méthode indirecte.
-- Ne touche jamais un texte déjà personnalisé par le cabinet (le filtre
-- "like" ne matche plus une fois corrigé ou réécrit).
update notes_modele
set texte = replace(
      texte,
      'État de flux de trésorerie : Il est élaboré selon la méthode directe (modèle de référence) du système comptable tunisien. Cet état fournit une information transparente sur les principales catégories de rentrées et de sorties de fonds brutes, ventilées entre les activités d''exploitation, d''investissement et de financement.',
      'État de flux de trésorerie : Il est élaboré selon la méthode indirecte, à partir du résultat net de l''exercice retraité des éléments sans incidence sur la trésorerie et de la variation du besoin en fonds de roulement, ventilé entre les activités d''exploitation, d''investissement et de financement.'
    ),
    maj_le = now()
where id = 'default' and texte like '%méthode directe (modèle de référence)%';

-- Registre d'immobilisations (étape 5) : chaque bien est saisi une fois
-- (date, coût, taux) et l'amortissement de chaque exercice se calcule
-- automatiquement (prorata temporis, linéaire) — remplace la saisie
-- manuelle des totaux d'acquisitions/cessions/dotations dans
-- immo_mouvements pour les masses corporelles/incorporelles (financières
-- reste en saisie manuelle, pas concernée par ce registre).
create table if not exists immo_categories (
  id      uuid primary key default gen_random_uuid(),
  nom     text not null,
  taux    numeric not null default 0,
  masse   text not null check (masse in ('incorporelle', 'corporelle')),
  cree_le timestamptz not null default now(),
  maj_le  timestamptz not null default now()
);

create table if not exists immo_biens (
  id                uuid primary key default gen_random_uuid(),
  societe_id        uuid not null references societes(id) on delete cascade,
  categorie_id      uuid not null references immo_categories(id),
  libelle           text not null default '',
  date_acquisition  date not null,
  cout_acquisition  numeric not null default 0,
  -- Taux propre au bien, préRempli depuis la catégorie à la création mais
  -- modifiable individuellement (ex. un véhicule à 35% au lieu des 20%
  -- standards de sa catégorie).
  taux              numeric not null default 0,
  date_cession      date,
  valeur_cession    numeric not null default 0,
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now()
);

create index if not exists immo_biens_societe_idx on immo_biens(societe_id);
create index if not exists immo_biens_categorie_idx on immo_biens(categorie_id);

insert into immo_categories (id, nom, taux, masse) values
  ('00000000-0000-0000-0000-000000000001', 'Logiciels', 33.33, 'incorporelle'),
  ('00000000-0000-0000-0000-000000000002', 'Installations générales, agencements et aménagements', 10, 'corporelle'),
  ('00000000-0000-0000-0000-000000000003', 'Matériel industriel et équipements', 15, 'corporelle'),
  ('00000000-0000-0000-0000-000000000004', 'Matériel de transport', 20, 'corporelle'),
  ('00000000-0000-0000-0000-000000000005', 'Équipements de bureau', 20, 'corporelle')
on conflict (id) do nothing;
