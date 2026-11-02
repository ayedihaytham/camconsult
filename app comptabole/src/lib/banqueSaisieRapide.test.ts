import { describe, expect, it } from "vitest";
import { collerDansGrille, estVide, ligneVide, lireDate, lireLigneSaisie } from "./banqueSaisieRapide";

const l = (date: string, libelle: string, debit = "", credit = "") => ({ date, libelle, debit, credit });

describe("saisie rapide de mouvements", () => {
  it("dates : complète ou sans année, deux chiffres d'année, séparateurs variés", () => {
    expect(lireDate("05/09/2026", "2026")).toBe("2026-09-05");
    expect(lireDate("5-9-2026", "2026")).toBe("2026-09-05");
    expect(lireDate("5/9", "2026")).toBe("2026-09-05");
    expect(lireDate("n'importe quoi", "2026")).toBeNull();
  });

  it("une ligne vide est ignorée ; une ligne complète donne un mouvement typé", () => {
    expect(lireLigneSaisie(ligneVide("05/09/2026"), "2026")).toEqual({ etat: "vide" });
    const r = lireLigneSaisie(l("5/9", "  Commission   reglement ", "2,000"), "2026");
    expect(r).toMatchObject({ etat: "ok", mouvement: { dateOp: "2026-09-05", libelle: "Commission reglement", debit: 2, credit: 0, type: "frais" } });
    expect(lireLigneSaisie(l("5/9", "Virement client", "", "1 234,500"), "2026")).toMatchObject({ etat: "ok", mouvement: { credit: 1234.5, type: "encaissement_client" } });
  });

  it("les erreurs sont dites : date, libellé, montant, les deux sens, aucun montant", () => {
    const err = (x: ReturnType<typeof l>) => (lireLigneSaisie(x, "2026") as { erreur?: string }).erreur;
    expect(err(l("xx", "A", "1"))).toBe("Date illisible");
    expect(err(l("5/9", "", "1"))).toBe("Libellé requis");
    expect(err(l("5/9", "A", "abc"))).toBe("Montant illisible");
    expect(err(l("5/9", "A", "1", "2"))).toBe("Débit ou crédit, pas les deux");
    expect(err(l("5/9", "A"))).toBe("Montant requis");
  });

  it("coller depuis Excel remplit la grille à partir de la cellule choisie et ajoute des lignes", () => {
    const grille = [ligneVide(), ligneVide()];
    const apres = collerDansGrille(grille, "05/09/2026\tTVA sur Com\t0,380\t\r\n06/09/2026\tLC Payment\t\t24 640,000\r\n07/09/2026\tFrais\t5\t\r\n", 0, "date");
    expect(apres).toHaveLength(3);
    expect(apres[1]).toEqual({ date: "06/09/2026", libelle: "LC Payment", debit: "", credit: "24 640,000" });
    expect(grille[0]).toEqual(ligneVide());
    // collé à partir de la colonne Libellé : la date n'est pas touchée, les colonnes en trop sont ignorées
    const depuis = collerDansGrille([l("05/09/2026", "")], "Commission\t2\t\tpoubelle", 0, "libelle");
    expect(depuis[0]).toEqual({ date: "05/09/2026", libelle: "Commission", debit: "2", credit: "" });
    expect(estVide(ligneVide("05/09/2026"))).toBe(true);
  });
});
