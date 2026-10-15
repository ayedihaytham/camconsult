-- Vérifications d'une base restaurée (LECTURE SEULE). À exécuter sur la base de TEST restaurée, jamais sur la production.
-- Chaque requête doit donner le résultat indiqué ; comparer les comptages à ceux relevés sur la base d'origine au moment de la sauvegarde.

-- 1. Volumes par table clé (à comparer à l'original)
select 'societes' as t, count(*) from societes
union all select 'employes', count(*) from employes
union all select 'factures', count(*) from factures
union all select 'facture_lignes', count(*) from facture_lignes
union all select 'stock_mouvements', count(*) from stock_mouvements
union all select 'fournisseur_reglements', count(*) from fournisseur_reglements
union all select 'comptes_bancaires', count(*) from comptes_bancaires
union all select 'swift_virements', count(*) from swift_virements
union all select 'noeuds', count(*) from noeuds
union all select 'journal', count(*) from journal;

-- 2. Contraintes : aucune contrainte non validée (résultat attendu : 0 ligne)
select conrelid::regclass as table_cible, conname from pg_constraint where not convalidated;

-- 3. Orphelins : chaque ligne enfant a son parent (résultat attendu : 0)
select count(*) as affectations_orphelines from fournisseur_affectations a left join stock_mouvements m on m.id = a.mouvement_id where m.id is null;
select count(*) as lignes_facture_orphelines from facture_lignes l left join factures f on f.id = l.facture_id where f.id is null;
select count(*) as factures_swift_orphelines from swift_factures f left join swift_virements v on v.id = f.virement_id where v.id is null;
select count(*) as societes_inconnues_sur_factures from factures f left join societes s on s.id = f.societe_id where s.id is null;

-- 4. Fichiers : le contenu est dans la base ; aucun fichier ne doit être vide ou tronqué (résultat attendu : 0)
select count(*) as fichiers_vides from noeuds where type = 'fichier' and (data_url is null or data_url = '') and taille is not null and taille <> '';

-- 5. Comptes : état des mots de passe (comptages seulement)
select count(*) filter (where mdp_hash is not null) as avec_empreinte,
       count(*) filter (where mot_de_passe <> '' and mdp_hash is null) as en_clair,
       count(*) filter (where mdp_hash is null and mot_de_passe = '') as sans_acces
from employes;

-- 6. Journal en ajout seul : le déclencheur est présent (résultat attendu : 1 ligne)
select tgname from pg_trigger where tgname = 'journal_ajout_seul_trg';

-- 7. Compte administrateur présent (résultat attendu : 1)
select count(*) as administrateur from app_meta where id = 1;
