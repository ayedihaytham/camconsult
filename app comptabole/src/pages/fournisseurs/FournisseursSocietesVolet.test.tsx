// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { FournisseursSocietesVolet } from "./FournisseursSocietesVolet";
import type { Societe, SyntheseFournisseurs } from "@/types";

afterEach(cleanup);

const societe = (id: string, raisonSociale: string): Societe => ({ id, raisonSociale, theme: "PME", rne: "1898113C", code: "CLI-0005" }) as unknown as Societe;
const synth = (societeId: string, patch: Partial<SyntheseFournisseurs> = {}): SyntheseFournisseurs => ({
  societeId, fournisseurs: 3, factures: 8, impayees: 2, soldes: [{ devise: "TND", montant: 1250.5 }, { devise: "EUR", montant: 300 }], reglements: 5, dernierReglement: "2026-08-12",
  paiementsARapprocher: 4, doublons: 0, reglementsAvantFacture: 0, principaux: [{ nom: "STE ALPHA", soldes: [{ devise: "TND", montant: 1000 }] }], ...patch,
});

const S = [societe("a", "12-PETRA"), societe("b", "07-MS TRANSPORT"), societe("c", "SOCIETE DEMO")];
const synthese = { a: synth("a"), b: synth("b", { impayees: 0, soldes: [], paiementsARapprocher: 0, principaux: [] }) };

const rendre = (selectionId: string | null, extra: Partial<Parameters<typeof FournisseursSocietesVolet>[0]> = {}) =>
  render(<FournisseursSocietesVolet societes={S} synthese={synthese} chargee selectionId={selectionId} onSelection={() => {}} onOuvrir={() => {}} {...extra} />);

describe("sociétés du suivi fournisseur : liste et volet", () => {
  it("la liste dit les fournisseurs, les factures et ce qui demande du travail", () => {
    rendre("a");
    const lignes = within(screen.getByRole("list", { name: "Sociétés" })).getAllByRole("listitem");
    expect(lignes).toHaveLength(3);
    expect(lignes[0].textContent).toContain("3 fournisseurs · 8 factures");
    expect(lignes[0].textContent).toContain("2 à régler");
    expect(lignes[1].textContent).toContain("À jour");
    expect(lignes[2].textContent).toContain("Aucune facture d'achat");
    expect(lignes[2].textContent).toContain("Sans facture");
    expect(screen.getByRole("button", { name: "Société 12-PETRA" }).getAttribute("aria-current")).toBe("true");
  });

  it("le volet : solde dû par devise, quatre chiffres, principaux soldes et ce qu'il reste à faire", () => {
    rendre("a");
    const volet = screen.getByRole("complementary", { name: "Situation du suivi fournisseur de la société" });
    expect(within(volet).getByRole("heading", { name: "12-PETRA" })).toBeTruthy();
    const solde = (within(volet).getByRole("region", { name: "Solde dû" }).textContent ?? "").replace(/[  ]/g, " ");
    expect(solde).toContain("1 250,500 TND");
    expect(solde).toContain("300,000 EUR");
    expect(volet.textContent).toContain("2 / 8");
    expect(within(within(volet).getByRole("region", { name: "Principaux soldes dus" })).getByText("STE ALPHA")).toBeTruthy();
    const a = within(within(volet).getByRole("region", { name: "À traiter" }));
    expect(a.getByText("2 factures à régler")).toBeTruthy();
    expect(a.getByText("4 paiements en banque à rapprocher avec un règlement")).toBeTruthy();
  });

  it("une société soldée le dit ; une société sans facture invite à passer par la gestion de stock", () => {
    rendre("b");
    expect(screen.getByText(/toutes les factures sont soldées/)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "À traiter" })).getByText("Rien à traiter : tout est réglé.")).toBeTruthy();
    cleanup();
    rendre("c");
    expect(screen.getByText(/n'a pas encore de facture d'achat/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "À traiter" })).toBeNull();
  });

  it("avant l'arrivée de la synthèse, aucune société n'est dite « sans facture »", () => {
    rendre("a", { chargee: false, synthese: {} });
    expect(screen.queryByText("Sans facture")).toBeNull();
    expect(screen.getAllByText("Chargement…").length).toBeGreaterThan(0);
  });
});
