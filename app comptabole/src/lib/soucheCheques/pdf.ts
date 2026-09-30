import { buildTablesPdf } from "@/lib/pdfTables";
import type { SoucheCheque } from "@/types";
import { fmtMontant, soucheRows, totauxParDevise } from "./model";

export const safeName = (s: string) =>
  s.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 80);

/** PDF de l'état de souche de chèques d'une société, gabarit CAMCONSULT.
 * Mode `plain` : les noms de banque en MAJUSCULES ne sont pas pris pour des
 * totaux ; seules les lignes de totaux finales sont mises en gras. */
export async function buildSouchePdf(list: SoucheCheque[], societeNom: string) {
  const totaux = totauxParDevise(list);
  const fileName = `Souche_cheques_${safeName(societeNom)}.pdf`;
  const doc = await buildTablesPdf({
    title: `État de souche de chèques — ${societeNom}`,
    subtitle:
      totaux.length === 0
        ? "Aucun chèque enregistré."
        : totaux
            .map((t) => `${t.devise} : émis ${fmtMontant(t.emis)} · débité ${fmtMontant(t.debite)} · reste ${fmtMontant(t.restant)}`)
            .join("   |   "),
    sheets: [
      {
        name: "Souche de chèques",
        headerRow: true,
        rows: soucheRows(list),
        totalRows: totaux.length * 3,
      },
    ],
    fileName,
    plain: true,
  });
  return { doc, fileName };
}
