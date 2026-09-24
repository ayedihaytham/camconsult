import { withTransaction } from "./db.js";

/** Description posée sur le dossier racine d'une société — permet de le
 * retrouver même si la société est renommée (même valeur que
 * RACINE_SOCIETE_DESCRIPTION côté client, src/lib/classement.ts). */
export const RACINE_SOCIETE_DESCRIPTION = "Dossier racine de la société";

/**
 * Inverse l'ancienne arborescence standard de la Structuration :
 *   avant : Comptabilité générale [année] (commun) › <société> › achat, vente…
 *   après : <société> › Comptabilité générale [année] › achat, vente…
 *
 * Le dossier « société » sous l'ancienne racine commune devient simplement le
 * dossier « Comptabilité générale [année] » de la société, déplacé sous la
 * racine de cette société : ses sous-dossiers et fichiers le suivent sans être
 * touchés (ils ne référencent que son id). Si la société a déjà un dossier
 * « Comptabilité générale [année] », son contenu y est versé plutôt que
 * dupliqué. L'ancienne racine commune n'est supprimée qu'une fois vide.
 *
 * Tout ou rien (une transaction) et idempotent : après un passage, plus rien
 * ne correspond à l'ancien format — sûr à appeler à chaque démarrage.
 * Renvoie le nombre de dossiers de société déplacés.
 */
export async function inverserStructuration() {
  return withTransaction(async (client) => {
    const racines = (
      await client.query(
        `select id, libelle from noeuds
          where societe_id is null and parent_id is null and type = 'dossier'
            and libelle ~* '^\\s*comptabilit[ée]\\s+g[ée]n[ée]rale'`,
      )
    ).rows;

    let deplaces = 0;
    for (const racine of racines) {
      const dossiersSociete = (
        await client.query(
          `select n.id, n.societe_id, s.raison_sociale
             from noeuds n join societes s on s.id = n.societe_id
            where n.parent_id = $1 and n.type = 'dossier'`,
          [racine.id],
        )
      ).rows;

      for (const d of dossiersSociete) {
        let racineSociete = (
          await client.query(
            `select id from noeuds
              where societe_id = $1 and parent_id is null and type = 'dossier'
                and (description = $2 or lower(trim(libelle)) = lower(trim($3)))
              order by (description = $2) desc
              limit 1`,
            [d.societe_id, RACINE_SOCIETE_DESCRIPTION, d.raison_sociale],
          )
        ).rows[0];
        if (!racineSociete) {
          racineSociete = (
            await client.query(
              `insert into noeuds (libelle, description, type, societe_id, parent_id)
               values ($1, $2, 'dossier', $3, null) returning id`,
              [d.raison_sociale, RACINE_SOCIETE_DESCRIPTION, d.societe_id],
            )
          ).rows[0];
        } else {
          await client.query("update noeuds set description = $1 where id = $2", [
            RACINE_SOCIETE_DESCRIPTION,
            racineSociete.id,
          ]);
        }

        const existant = (
          await client.query(
            `select id from noeuds
              where parent_id = $1 and type = 'dossier' and lower(trim(libelle)) = lower(trim($2))
              limit 1`,
            [racineSociete.id, racine.libelle],
          )
        ).rows[0];

        if (!existant) {
          await client.query(
            "update noeuds set libelle = $1, parent_id = $2, maj_le = current_date where id = $3",
            [racine.libelle, racineSociete.id, d.id],
          );
        } else {
          await client.query("update noeuds set parent_id = $1 where parent_id = $2", [existant.id, d.id]);
          await client.query("delete from noeuds where id = $1", [d.id]);
        }
        deplaces++;
      }

      const reste = (
        await client.query("select count(*)::int as n from noeuds where parent_id = $1", [racine.id])
      ).rows[0].n;
      if (reste === 0) await client.query("delete from noeuds where id = $1", [racine.id]);
    }
    return deplaces;
  });
}
