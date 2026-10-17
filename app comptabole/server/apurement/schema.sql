-- Additive, replayable and restrictive: no legal record cascades on company deletion.
alter table stock_mouvements add column if not exists apurement_revision bigint not null default 0;
create table if not exists apurement_profils_fiscaux (
  id uuid primary key default gen_random_uuid(),
  societe_id uuid not null unique references societes(id),
  donnees jsonb not null default '{}', version integer not null default 1,
  verified_by text, verified_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists apurement_fournisseurs (
  id uuid primary key default gen_random_uuid(), societe_id uuid not null references societes(id),
  raison_sociale text not null, matricule_fiscal_raw text not null default '',
  matricule_fiscal_normalise text, aliases jsonb not null default '[]',
  version integer not null default 1, updated_at timestamptz not null default now(),
  unique(id,societe_id)
);
create table if not exists apurement_autorisations (
  id uuid primary key default gen_random_uuid(), societe_id uuid not null references societes(id),
  numero text not null, date_debut date, date_fin date,
  plafond_ht_millimes bigint check(plafond_ht_millimes >= 0),
  plafond_tva_millimes bigint check(plafond_tva_millimes >= 0),
  statut_interne text not null default 'brouillon' check(statut_interne in ('brouillon','active','fermee','annulee')),
  version integer not null default 1, updated_at timestamptz not null default now(),
  unique(id,societe_id), check(date_fin is null or date_debut is null or date_fin >= date_debut)
);
create table if not exists apurement_bons_commande (
  id uuid primary key default gen_random_uuid(), societe_id uuid not null references societes(id),
  autorisation_id uuid not null, fournisseur_id uuid not null,
  numero text not null, date_bc date, description text not null default '',
  plafond_ht_millimes bigint check(plafond_ht_millimes >= 0),
  version integer not null default 1, updated_at timestamptz not null default now(),
  unique(id,societe_id), unique(id,societe_id,fournisseur_id),
  foreign key(autorisation_id,societe_id) references apurement_autorisations(id,societe_id),
  foreign key(fournisseur_id,societe_id) references apurement_fournisseurs(id,societe_id)
);
create table if not exists apurement_factures (
  id uuid primary key default gen_random_uuid(), societe_id uuid not null references societes(id),
  bc_id uuid, fournisseur_id uuid not null, numero_facture text not null,
  date_facture date, date_precision text not null check(date_precision in ('day','month','unknown')),
  date_brute text not null default '', objet text not null default '',
  montant_ht_millimes bigint not null check(montant_ht_millimes >= 0),
  taux_tva_bps integer not null check(taux_tva_bps between 0 and 10000),
  tva_calculee_millimes bigint not null check(tva_calculee_millimes >= 0),
  tva_suspendue_millimes bigint not null check(tva_suspendue_millimes >= 0),
  tva_mode text not null check(tva_mode in ('auto','manuel')), motif_correction text not null default '',
  annee integer not null check(annee between 2000 and 2100), trimestre text not null check(trimestre in ('T1','T2','T3','T4')),
  motif_periode text not null default '', source text not null default 'manuel',
  stock_mouvement_id uuid unique references stock_mouvements(id), stock_hash text, conflit jsonb,
  archived boolean not null default false, version integer not null default 1,
  created_by text not null, updated_at timestamptz not null default now(), unique(id,societe_id),
  foreign key(fournisseur_id,societe_id) references apurement_fournisseurs(id,societe_id),
  foreign key(bc_id,societe_id,fournisseur_id) references apurement_bons_commande(id,societe_id,fournisseur_id),
  check((date_precision='day') = (date_facture is not null)),
  check(tva_mode <> 'manuel' or length(trim(motif_correction)) > 0)
);
create index if not exists apurement_factures_periode on apurement_factures(societe_id,annee,trimestre,id);
create index if not exists apurement_factures_bc on apurement_factures(societe_id,bc_id);
create index if not exists apurement_factures_doublons on apurement_factures(societe_id,lower(trim(numero_facture)),date_facture) where not archived;
create index if not exists apurement_bcs_autorisation on apurement_bons_commande(societe_id,autorisation_id);
create index if not exists apurement_autorisations_societe on apurement_autorisations(societe_id,id);
create index if not exists apurement_fournisseurs_societe on apurement_fournisseurs(societe_id,id);
create table if not exists apurement_audit (
  id uuid primary key default gen_random_uuid(), societe_id uuid not null references societes(id),
  acteur text not null, action text not null, entity_id uuid not null,
  avant jsonb, apres jsonb, created_at timestamptz not null default now()
);
create index if not exists apurement_audit_entity on apurement_audit(societe_id,entity_id,created_at);
create table if not exists apurement_controles_ack (
  societe_id uuid not null references societes(id), facture_id uuid not null,
  code text not null, fingerprint text not null, motif text not null, acteur text not null,
  created_at timestamptz not null default now(), primary key(facture_id,code,fingerprint),
  foreign key(facture_id,societe_id) references apurement_factures(id,societe_id)
);
create table if not exists apurement_preuves (
  hash text primary key, contenu bytea not null, mime text not null, taille integer not null check(taille between 1 and 8388608)
);
create table if not exists apurement_pieces_liens (
  id uuid primary key default gen_random_uuid(), societe_id uuid not null references societes(id),
  parent_type text not null check(parent_type in ('autorisation','bc','facture','declaration','depot')),
  parent_id uuid not null, source text not null, source_id uuid, nom text not null,
  preuve_hash text not null references apurement_preuves(hash), created_at timestamptz not null default now(),
  unique(id,societe_id)
);
create index if not exists apurement_pieces_parent on apurement_pieces_liens(societe_id,parent_type,parent_id);
create table if not exists apurement_pieces_manquantes (
  id uuid primary key default gen_random_uuid(), societe_id uuid not null references societes(id),
  parent_type text not null, parent_id uuid not null, libelle text not null,
  statut text not null default 'manquante' check(statut in ('manquante','demandee','fournie','validee')),
  echeance date, version integer not null default 1
);
alter table apurement_pieces_manquantes add column if not exists collecte_demande_id uuid;
create table if not exists apurement_declarations (
  id uuid primary key default gen_random_uuid(), societe_id uuid not null references societes(id),
  annee integer not null check(annee between 2000 and 2100), trimestre text not null check(trimestre in ('T1','T2','T3','T4')),
  version integer not null, supersede_declaration_id uuid references apurement_declarations(id),
  statut text not null default 'brouillon' check(statut in ('brouillon','pret_a_valider','valide')),
  snapshot jsonb, snapshot_hash text, approved_by text, approved_at timestamptz,
  created_at timestamptz not null default now(), unique(societe_id,annee,trimestre,version), unique(id,societe_id)
);
create unique index if not exists apurement_declaration_brouillon on apurement_declarations(societe_id,annee,trimestre) where statut <> 'valide';
create index if not exists apurement_declarations_snapshot on apurement_declarations using gin ((snapshot->'lignes')) where statut='valide';
create table if not exists apurement_depots (
  id uuid primary key default gen_random_uuid(), societe_id uuid not null references societes(id),
  declaration_id uuid not null, date_depot date not null, reference text not null,
  statut text not null check(statut in ('depose','accepte','rejete')), motif text not null default '',
  preuve_id uuid not null, acteur text not null, version integer not null default 1,
  created_at timestamptz not null default now(), unique(id,societe_id),
  foreign key(declaration_id,societe_id) references apurement_declarations(id,societe_id),
  foreign key(preuve_id,societe_id) references apurement_pieces_liens(id,societe_id)
);
create table if not exists apurement_exports (
  id uuid primary key default gen_random_uuid(), societe_id uuid not null references societes(id),
  declaration_id uuid not null, type text not null check(type in ('excel','pdf','bcd-test')),
  contenu bytea not null, hash text not null, nom text not null, mime text not null,
  created_at timestamptz not null default now(),
  foreign key(declaration_id,societe_id) references apurement_declarations(id,societe_id),
  unique(declaration_id,type)
);
create table if not exists apurement_imports (
  id uuid primary key default gen_random_uuid(), societe_id uuid not null references societes(id),
  hash text not null, profile text not null, raw bytea not null, preview jsonb not null,
  created_by text not null, expires_at timestamptz not null default now()+interval '30 minutes',
  committed_at timestamptz, rapport jsonb, unique(societe_id,hash)
);
alter table apurement_imports add column if not exists revue jsonb;
create unique index if not exists apurement_imports_societe_id on apurement_imports(id,societe_id);
alter table apurement_factures add column if not exists import_id uuid;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='apurement_facture_import_societe') then
    alter table apurement_factures add constraint apurement_facture_import_societe foreign key(import_id,societe_id) references apurement_imports(id,societe_id);
  end if;
end $$;
create table if not exists apurement_reminder_rules (
  id uuid primary key default gen_random_uuid(), societe_id uuid not null references societes(id),
  annee integer not null, trimestre text not null, echeance date not null,
  cadence_jours integer not null check(cadence_jours between 1 and 365), actif boolean not null default true,
  unique(societe_id,annee,trimestre)
);
create table if not exists apurement_reminder_runs (
  rule_id uuid not null references apurement_reminder_rules(id), user_key text not null,
  fenetre integer not null, created_at timestamptz not null default now(), primary key(rule_id,user_key,fenetre)
);
create table if not exists apurement_politiques_calcul (
  id uuid primary key default gen_random_uuid(), societe_id uuid not null unique references societes(id),
  mode text not null check(mode='demi_superieur_facture'), reference text not null,
  preuve_id uuid not null, approved_by text not null, approved_at timestamptz not null default now(),
  foreign key(preuve_id,societe_id) references apurement_pieces_liens(id,societe_id)
);
alter table apurement_exports add column if not exists source_hash text not null default '';
alter table apurement_exports drop constraint if exists apurement_exports_declaration_id_type_key;
create unique index if not exists apurement_exports_source on apurement_exports(declaration_id,type,source_hash);
-- Append-only domain history and frozen bytes. Database administrator can still
-- alter triggers; off-site backups remain an operational requirement.
create or replace function apurement_immutable() returns trigger language plpgsql as $$
begin raise exception 'Apurement: enregistrement immuable'; end $$;
drop trigger if exists apurement_audit_immutable on apurement_audit;
create trigger apurement_audit_immutable before update or delete on apurement_audit for each row execute function apurement_immutable();
drop trigger if exists apurement_export_immutable on apurement_exports;
create trigger apurement_export_immutable before update or delete on apurement_exports for each row execute function apurement_immutable();
drop trigger if exists apurement_preuve_immutable on apurement_preuves;
create trigger apurement_preuve_immutable before update or delete on apurement_preuves for each row execute function apurement_immutable();
create or replace function apurement_import_frozen() returns trigger language plpgsql as $$
begin
  if old.committed_at is not null then raise exception 'Apurement: import validé immuable'; end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists apurement_import_immutable on apurement_imports;
create trigger apurement_import_immutable before update or delete on apurement_imports for each row execute function apurement_import_frozen();
drop trigger if exists apurement_piece_lien_immutable on apurement_pieces_liens;
create trigger apurement_piece_lien_immutable before update or delete on apurement_pieces_liens for each row execute function apurement_immutable();
create or replace function apurement_depot_frozen() returns trigger language plpgsql as $$
begin
  if TG_OP='DELETE' or old.statut<>'depose' then raise exception 'Apurement: dépôt immuable'; end if;
  return new;
end $$;
drop trigger if exists apurement_depot_immutable on apurement_depots;
create trigger apurement_depot_immutable before update or delete on apurement_depots for each row execute function apurement_depot_frozen();
create or replace function apurement_declaration_frozen() returns trigger language plpgsql as $$
begin
  if old.statut = 'valide' then raise exception 'Apurement: déclaration validée immuable'; end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists apurement_declaration_immutable on apurement_declarations;
create trigger apurement_declaration_immutable before update or delete on apurement_declarations for each row execute function apurement_declaration_frozen();
