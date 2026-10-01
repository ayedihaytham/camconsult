/** Rename or merge a cabinet code and every persisted reference to it.
 * Runs inside the caller's transaction so no mapping can retain the old code. */
export async function renameAffectatCode(client, oldCode, newCode) {
  const old = (
    await client.query("select * from grille_affectat_codes where code = $1", [oldCode])
  ).rows[0];
  await client.query("update balance_lignes set affectat = $2 where affectat = $1", [
    oldCode,
    newCode,
  ]);
  await client.query(
    "update grille_comptes set affectat_code = $2, maj_le = now() where affectat_code = $1",
    [oldCode, newCode],
  );
  await client.query(
    "update grille_comptes_societe set affectat_code = $2, maj_le = now() where affectat_code = $1",
    [oldCode, newCode],
  );
  // On merge, retain the target code's label and poste. Otherwise inherit the old values.
  await client.query(
    `insert into grille_affectat_codes (code, libelle, poste)
     values ($1, $2, $3) on conflict (code) do nothing`,
    [newCode, old?.libelle ?? "", old?.poste ?? ""],
  );
  await client.query("delete from grille_affectat_codes where code = $1", [oldCode]);
}
