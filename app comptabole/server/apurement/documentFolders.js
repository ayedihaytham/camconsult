import { RACINE_SOCIETE_DESCRIPTION } from "../migrateStructuration.js";
import { company } from "./repository.js";

export async function documentFolder(c, session, context, record) {
  const soc = await company(c, session, context.societeId, true);
  async function folder(
    parentId,
    libelle,
    cabinetOnly = true,
    description = "",
  ) {
    const existing = (
      await c.query(
        `select id,libelle from noeuds where societe_id=$1 and parent_id is not distinct from $2::uuid
       and type='dossier' and lower(trim(libelle))=lower(trim($3)) and cabinet_only=$4 order by cree_le,id limit 1`,
        [soc.id, parentId, libelle, cabinetOnly],
      )
    ).rows[0];
    if (existing) return existing;
    const row = (
      await c.query(
        `insert into noeuds(libelle,description,type,societe_id,parent_id,cabinet_only)
       values($1,$2,'dossier',$3,$4,$5) returning id,libelle`,
        [libelle, description, soc.id, parentId, cabinetOnly],
      )
    ).rows[0];
    c.apurementStructureSocietes?.add(soc.id);
    return row;
  }
  const root =
    (
      await c.query(
        `select id,libelle from noeuds where societe_id=$1 and parent_id is null and type='dossier'
     and description=$2 order by cree_le,id limit 1`,
        [soc.id, RACINE_SOCIETE_DESCRIPTION],
      )
    ).rows[0] ||
    (await folder(null, soc.raison_sociale, false, RACINE_SOCIETE_DESCRIPTION));
  const nodes = [root, await folder(root.id, "Apurement TVA")];
  let year = record.annee,
    quarter = record.trimestre;
  if (context.parentType === "depot") {
    const declaration = (
      await c.query(
        "select annee,trimestre from apurement_declarations where id=$1 and societe_id=$2",
        [record.declaration_id, soc.id],
      )
    ).rows[0];
    year = declaration.annee;
    quarter = declaration.trimestre;
  }
  if (year) nodes.push(await folder(nodes.at(-1).id, String(year)));
  if (quarter) nodes.push(await folder(nodes.at(-1).id, quarter));
  const labels = {
    autorisation: "Autorisations",
    bc: "Bons de commande",
    facture: "Factures",
    declaration: "Déclarations",
    depot: "Dépôts",
  };
  nodes.push(await folder(nodes.at(-1).id, labels[context.parentType]));
  return {
    id: nodes.at(-1).id,
    chemin: nodes.map((n) => n.libelle).join(" / "),
  };
}
