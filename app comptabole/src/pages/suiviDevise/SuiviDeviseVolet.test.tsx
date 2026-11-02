// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SuiviDeviseVolet } from "./SuiviDeviseVolet";
import type { SuiviDeviseResume } from "@/store/suiviDevise";

afterEach(cleanup);

const base = { societeId: "s", note: "", soldeOuverture: 0, creeLe: "", majLe: "", devise: "EUR" };
const fiches: SuiviDeviseResume[] = [
  { ...base, id: "a", client: "GROUP BYOUT EZZ COMPANY", exercice: "2023", totalVentes: 40700, solde: 40700, nbFactures: 3, totalReglements: 0, apercu: { factures: [{ nFacture: "130/2023", dateFacture: "2023-05-02", montantTotal: 18000, reste: 18000 }], reglements: [] } },
  { ...base, id: "c", client: "RUSPINA IMPORT/EXPORT", exercice: "2026", totalVentes: 81466, solde: 21466, stockAReprendre: 1, nbFactures: 4, totalReglements: 60000, apercu: { factures: [{ nFacture: "131/2026", dateFacture: "2026-01-10", montantTotal: 21466, reste: 0 }], reglements: [{ date: "2026-02-10", libelle: "ENCAISSEMENT", montant: 60000 }] } },
  { ...base, id: "d", client: "AL KHALIJ GROUP", exercice: "2026", totalVentes: 26920, solde: 0, nbFactures: 1, totalReglements: 26920 },
];

const rendre = (selectionId: string | null, extra: Partial<Parameters<typeof SuiviDeviseVolet>[0]> = {}) =>
  render(<SuiviDeviseVolet fiches={fiches} selectionId={selectionId} onSelection={() => {}} onOuvrir={() => {}} onSupprimer={() => {}} {...extra} />);

describe("fiches du suivi client devise : liste et volet", () => {
  it("la liste dit pour chaque fiche l'exercice, la devise, le nombre de factures, le solde dû ou « Soldée », et la reprise du stock", () => {
    rendre("c");
    const liste = screen.getByRole("list", { name: "Fiches" });
    const lignes = within(liste).getAllByRole("listitem");
    expect(lignes).toHaveLength(3);
    expect(lignes[0].textContent).toContain("GROUP BYOUT EZZ COMPANY");
    expect(lignes[0].textContent).toContain("3 factures");
    expect((lignes[0].textContent ?? "").replace(/[  ]/g, " ")).toContain("40 700,000");
    expect(lignes[1].textContent).toContain("stock à reprendre");
    expect(lignes[2].textContent).toContain("Soldée");
    expect(lignes[1].querySelector("button")?.getAttribute("aria-current")).toBe("true");
  });

  it("le volet montre le client choisi : part soldée, total, réglé, solde, dernières factures et derniers règlements", () => {
    rendre("c");
    const volet = screen.getByRole("complementary", { name: "Fiche du client" });
    expect(within(volet).getByRole("heading", { name: "RUSPINA IMPORT/EXPORT" })).toBeTruthy();
    expect(within(volet).getByRole("img", { name: "74 % soldé" })).toBeTruthy();
    expect(volet.textContent).toContain("Solde dû");
    expect(volet.textContent).toContain("1 vente du stock à reprendre");
    const nb = (t: string) => t.replace(/[  ]/g, " ");
    expect(nb(volet.textContent ?? "")).toContain("81 466,000");
    expect(nb(volet.textContent ?? "")).toContain("60 000,000");
    expect(nb(volet.textContent ?? "")).toContain("21 466,000");
    expect(within(volet).getByRole("region", { name: "Dernières factures" }).textContent).toContain("131/2026");
    expect(within(volet).getByRole("region", { name: "Derniers règlements" }).textContent).toContain("ENCAISSEMENT");
  });

  it("une fiche sans facture ni règlement le dit au lieu d'un volet vide ; une fiche soldée est annoncée soldée", () => {
    rendre("d");
    const volet = screen.getByRole("complementary", { name: "Fiche du client" });
    expect(within(volet).getByRole("region", { name: "Dernières factures" }).textContent).toContain("Aucune facture");
    expect(within(volet).getByRole("region", { name: "Derniers règlements" }).textContent).toContain("Aucun règlement");
    expect(volet.textContent).toContain("Soldée");
    expect(within(volet).getByRole("img", { name: "100 % soldé" })).toBeTruthy();
  });

  it("un clic choisit la fiche, un double clic et le bouton l'ouvrent, « Supprimer la fiche » la désigne", () => {
    const onSelection = vi.fn();
    const onOuvrir = vi.fn();
    const onSupprimer = vi.fn();
    rendre("c", { onSelection, onOuvrir, onSupprimer });
    const ligne = screen.getByRole("list", { name: "Fiches" }).querySelectorAll("button")[0];
    fireEvent.click(ligne);
    expect(onSelection).toHaveBeenCalledWith("a");
    fireEvent.doubleClick(ligne);
    expect(onOuvrir).toHaveBeenCalledWith("a");
    fireEvent.click(screen.getByRole("button", { name: /Ouvrir la fiche$/ }));
    expect(onOuvrir).toHaveBeenLastCalledWith("c");
    fireEvent.click(screen.getByRole("button", { name: "Supprimer la fiche RUSPINA IMPORT/EXPORT" }));
    expect(onSupprimer).toHaveBeenCalledWith(fiches[1]);
  });

  it("sans fiche : message dans la liste et invitation dans le volet", () => {
    render(<SuiviDeviseVolet fiches={[]} selectionId={null} onSelection={() => {}} onOuvrir={() => {}} onSupprimer={() => {}} />);
    expect(screen.getByText("Aucune fiche ne correspond.")).toBeTruthy();
    expect(screen.getByText("Choisissez une fiche pour la voir ici.")).toBeTruthy();
  });
});
