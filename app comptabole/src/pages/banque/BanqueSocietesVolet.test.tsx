// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { BandeMois, BanqueSocietesVolet } from "./BanqueSocietesVolet";
import type { Societe, SyntheseBanque } from "@/types";

afterEach(cleanup);

const societe = (id: string, raisonSociale: string): Societe => ({ id, raisonSociale, theme: "PME", rne: "1898113C", code: "CLI-0005" }) as unknown as Societe;
const synth = (societeId: string, patch: Partial<SyntheseBanque> = {}): SyntheseBanque => ({
  societeId, comptes: [{ id: "c1", banque: "BTL", devise: "TND", solde: 108472.821 }], mouvements: 1185, dernierMouvement: "2026-08-31", paiementsARapprocher: 60, aRevoir: 16,
  annee: 2026, mois: ["ok", "ok", "ok", "ok", "ok", "ecart", "ecart", "ok", null, null, null, null], moisEnEcart: 2, moisASaisir: 0,
  ecarts: [{ mois: "2026-06", devise: "TND", banque: "BTL", ecart: 3.57 }, { mois: "2026-07", devise: "TND", banque: "BTL", ecart: 5 }], aSaisir: [], ...patch,
});

const S = [societe("a", "12-PETRA"), societe("b", "07-MS TRANSPORT"), societe("c", "SOCIETE DEMO")];
const synthese = { a: synth("a"), b: synth("b", { paiementsARapprocher: 0, aRevoir: 0, moisEnEcart: 0, ecarts: [], mois: ["ok", "ok", null, null, null, null, null, null, null, null, null, null], mouvements: 96 }) };

const rendre = (selectionId: string | null, extra: Partial<Parameters<typeof BanqueSocietesVolet>[0]> = {}) =>
  render(<BanqueSocietesVolet societes={S} synthese={synthese} chargee selectionId={selectionId} onSelection={() => {}} onOuvrir={() => {}} {...extra} />);

describe("sociétés du suivi bancaire : liste et volet", () => {
  it("la liste dit les comptes et les mouvements, et ce qui demande du travail : à rapprocher, à jour, sans compte", () => {
    rendre("a");
    const lignes = within(screen.getByRole("list", { name: "Sociétés" })).getAllByRole("listitem");
    expect(lignes).toHaveLength(3);
    expect(lignes[0].textContent).toContain("12-PETRA");
    expect(lignes[0].textContent).toContain("BTL TND · 1185 mouvements");
    expect(lignes[0].textContent).toContain("60 à rapprocher");
    expect(lignes[1].textContent).toContain("À jour");
    expect(lignes[2].textContent).toContain("Aucun compte");
    expect(lignes[2].textContent).toContain("Sans compte");
    expect(screen.getByRole("button", { name: "Société 12-PETRA" }).getAttribute("aria-current")).toBe("true");
  });

  it("le volet : comptes et soldes, quatre chiffres, mois par mois, et ce qu'il reste à faire", () => {
    rendre("a");
    const volet = screen.getByRole("complementary", { name: "Situation bancaire de la société" });
    expect(within(volet).getByRole("heading", { name: "12-PETRA" })).toBeTruthy();
    expect((within(volet).getByRole("region", { name: "Comptes" }).textContent ?? "").replace(/[  ]/g, " ")).toContain("108 472,821 TND");
    expect(volet.textContent).toContain("1185");
    expect(volet.textContent).toContain("Lignes à revoir");
    const a = within(within(volet).getByRole("region", { name: "À traiter" }));
    expect(a.getByText("60 paiements à rapprocher avec le suivi fournisseur")).toBeTruthy();
    expect(a.getByText("Écart de 3,570 TND en juin 2026")).toBeTruthy();
    expect(a.getByText("Écart de 5,000 TND en juillet 2026")).toBeTruthy();
    expect(within(volet).getByRole("region", { name: "Mois par mois" }).textContent).toContain("2026, mois par mois");
  });

  it("une société à jour dit qu'il n'y a rien à traiter ; une société sans compte invite à ouvrir son suivi", () => {
    rendre("b");
    expect(within(screen.getByRole("region", { name: "À traiter" })).getByText("Rien à traiter : tout tombe juste.")).toBeTruthy();
    cleanup();
    rendre("c");
    expect(screen.getByText(/n'a pas encore de compte bancaire/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "À traiter" })).toBeNull();
  });

  it("avant l'arrivée de la synthèse, aucune société n'est dite « sans compte »", () => {
    rendre("a", { chargee: false, synthese: {} });
    expect(screen.queryByText("Sans compte")).toBeNull();
    expect(screen.queryByText("Aucun compte")).toBeNull();
    expect(screen.getByText("Chargement…")).toBeTruthy();
  });

  it("un clic choisit la société, un double clic et le bouton ouvrent son suivi", () => {
    const onSelection = vi.fn();
    const onOuvrir = vi.fn();
    rendre("a", { onSelection, onOuvrir });
    const ligne = screen.getByRole("button", { name: "Société 07-MS TRANSPORT" });
    fireEvent.click(ligne);
    expect(onSelection).toHaveBeenCalledWith("b");
    fireEvent.doubleClick(ligne);
    expect(onOuvrir).toHaveBeenCalledWith("b");
    fireEvent.click(screen.getByRole("button", { name: /Ouvrir le suivi bancaire/ }));
    expect(onOuvrir).toHaveBeenLastCalledWith("a");
  });

  it("la bande des mois dit chaque mois aux lecteurs d'écran : tombe juste, écart, rien", () => {
    render(<BandeMois synthese={synth("a")} />);
    const mois = within(screen.getByRole("list", { name: "Mois de 2026" })).getAllByRole("listitem");
    expect(mois).toHaveLength(12);
    expect(mois[0].textContent).toContain("janvier : tombe juste");
    expect(mois[5].textContent).toContain("juin : écart");
    expect(mois[11].textContent).toContain("décembre : rien");
  });
});
