// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Facture } from "@/types";

// Magasins simulés, données fictives : aucune requête réseau.
const societes = vi.hoisted(() => [
  { id: "s1", raisonSociale: "CLIENT COMPLET SARL", tva: "7654321KAM000", rne: "B0987652019", adresse: "5 avenue Exemple, Sfax", adresseRue: "5 avenue Exemple", ville: "Sfax", codePostal: "3000" },
  { id: "s2", raisonSociale: "CLIENT SANS ADRESSE SA", tva: "1234567ABM000", rne: "", adresse: "", adresseRue: "", ville: "", codePostal: "" },
  { id: "s3", raisonSociale: "CLIENT SANS MF SARL", tva: "", rne: "", adresse: "1 rue du Lac, Tunis", adresseRue: "1 rue du Lac", ville: "Tunis", codePostal: "1053" },
]);
const magasin = vi.hoisted(() => ({ list: [] as { numero: string }[], cabinet: null as unknown }));
vi.mock("@/store/data", () => ({ useSocietes: () => societes }));
vi.mock("@/store/facturation", () => ({ useFacturation: (selecteur: (s: typeof magasin) => unknown) => selecteur(magasin) }));
vi.mock("./FactureApercuDialog", () => ({
  FactureApercuDialog: ({ open, facture }: { open: boolean; facture: Facture | null }) => (open ? <div role="dialog" aria-label="Aperçu simulé">{`Aperçu ${facture?.numero} net ${facture?.netAPayer}`}</div> : null),
}));

import { FactureFormSheet, manquesClientEinvoice } from "./FactureFormSheet";

const source = {
  id: "f1",
  societeId: "s1",
  societeNom: "CLIENT COMPLET SARL",
  numero: "2026-0007",
  dateEmission: "2026-09-01",
  echeance: "2026-10-01",
  tvaTaux: 13,
  timbre: 2,
  note: "Note d'origine",
  lignes: [
    { ordre: 0, description: "Tenue comptable", quantite: 3, montantHt: 150 },
    { ordre: 1, description: "Déclaration", quantite: 1, montantHt: 80 },
  ],
} as unknown as Facture;

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  magasin.list = [{ numero: "2026-0006" }, { numero: "2026-0007" }, { numero: "2025-0099" }];
  magasin.cabinet = null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const monter = (mode: "nouvelle" | "modification" | "copie", onSubmit = vi.fn().mockResolvedValue(undefined), defaultSocieteId = "") => {
  render(
    <MemoryRouter>
      <FactureFormSheet open onOpenChange={vi.fn()} onSubmit={onSubmit} source={mode === "nouvelle" ? null : source} mode={mode} defaultSocieteId={defaultSocieteId} />
    </MemoryRouter>,
  );
  return onSubmit;
};

describe("FactureFormSheet : modes", () => {
  it("modification : titre avec le numéro, données de la facture reprises (dates comprises), numéro conservé", async () => {
    const onSubmit = monter("modification");
    expect(screen.getByText("Modifier la facture 2026-0007")).toBeTruthy();
    expect(screen.getByText("Numéro conservé")).toBeTruthy();
    expect((screen.getByLabelText("Description, ligne 1") as HTMLInputElement).value).toBe("Tenue comptable");
    expect((screen.getByLabelText("Date d'émission") as HTMLInputElement).value).toBe("2026-09-01");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les modifications" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      societeId: "s1", dateEmission: "2026-09-01", echeance: "2026-10-01", tvaTaux: 13, timbre: 2, note: "Note d'origine",
      lignes: [{ description: "Tenue comptable", quantite: 3, montantHt: 150 }, { description: "Déclaration", quantite: 1, montantHt: 80 }],
    });
  });

  it("copie : client, lignes et taux repris, dates du jour, nouveau numéro prévu", async () => {
    const onSubmit = monter("copie");
    expect(screen.getByText("Dupliquer la facture")).toBeTruthy();
    expect((screen.getByLabelText("Date d'émission") as HTMLInputElement).value).not.toBe("2026-09-01");
    fireEvent.click(screen.getByRole("button", { name: "Générer la facture" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const envoye = onSubmit.mock.calls[0][0];
    expect(envoye.dateEmission).toBe(new Date().toISOString().slice(0, 10));
    expect(envoye.tvaTaux).toBe(13);
    expect(envoye.lignes).toHaveLength(2);
  });

  it("nouvelle facture : formulaire vide, génération impossible, message d'aide", () => {
    monter("nouvelle");
    expect(screen.getByText("Nouvelle facture d'honoraires")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Générer la facture" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Choisissez le client.");
  });
});

describe("FactureFormSheet : nouvelle présentation", () => {
  it("manquesClientEinvoice : matricule fiscal et adresse structurée", () => {
    expect(manquesClientEinvoice(societes[0])).toEqual([]);
    expect(manquesClientEinvoice(societes[1])).toEqual(["adresse (rue, ville, code postal)"]);
    expect(manquesClientEinvoice(societes[2])).toEqual(["matricule fiscal valide"]);
    expect(manquesClientEinvoice({ tva: "", adresseRue: "", ville: "", codePostal: "" })).toHaveLength(2);
  });

  it("récapitulatif : totaux, TVA, timbre, net à payer et montant en lettres se calculent seuls", () => {
    monter("modification"); // 3 × 150 + 80 = 530 HT ; TVA 13 % = 68,900 ; timbre 2 ; net 600,900
    const recap = screen.getByRole("complementary", { name: "Récapitulatif" });
    expect(within(recap).getByText("530,000 TND")).toBeTruthy();
    expect(within(recap).getByText("68,900 TND")).toBeTruthy();
    expect(screen.getByTestId("net-a-payer").textContent).toBe("600,900 TND");
    expect(within(recap).getByText(/Six cents dinars et neuf cents millimes/)).toBeTruthy();
  });

  it("chaque ligne affiche son total HT et la TVA se choisit en un clic", () => {
    monter("modification");
    expect(screen.getByLabelText("Total HT, ligne 1").textContent).toContain("450,000");
    expect(screen.getByLabelText("Total HT, ligne 2").textContent).toContain("80,000");
    const tva = screen.getByRole("group", { name: "Taux de TVA" });
    expect(within(tva).getByRole("button", { name: "13 %" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(tva).getByRole("button", { name: "19 %" }));
    expect(within(tva).getByRole("button", { name: "19 %" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("TVA (19 %)")).toBeTruthy();
  });

  it("raccourcis d'échéance : calculés à partir de la date d'émission", () => {
    monter("modification");
    const echeance = () => (screen.getByLabelText("Échéance de paiement") as HTMLInputElement).value;
    fireEvent.click(screen.getByRole("button", { name: "60 jours" }));
    expect(echeance()).toBe("2026-10-31");
    fireEvent.click(screen.getByRole("button", { name: "À réception" }));
    expect(echeance()).toBe("2026-09-01");
  });

  it("échéance avant l'émission : message clair et génération bloquée", () => {
    monter("modification");
    fireEvent.change(screen.getByLabelText("Échéance de paiement"), { target: { value: "2026-08-01" } });
    expect(screen.getByRole("status").textContent).toBe("L'échéance ne peut pas précéder la date d'émission.");
    expect((screen.getByRole("button", { name: "Enregistrer les modifications" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("numéro prévu : suite de l'année de la date d'émission", () => {
    monter("nouvelle");
    const annee = new Date().toISOString().slice(0, 4);
    const attendu = annee === "2026" ? "2026-0008" : `${annee}-0001`;
    expect(screen.getByText("Numéro prévu").nextElementSibling?.textContent).toBe(attendu);
  });

  it("fiche du client : état du matricule fiscal et de l'adresse, lien pour compléter, impact sur la facture électronique", () => {
    monter("nouvelle", undefined, "s2");
    const fiche = screen.getByLabelText("Fiche du client");
    expect(within(fiche).getByText("CLIENT SANS ADRESSE SA")).toBeTruthy();
    expect(within(fiche).getByRole("link", { name: "Compléter la société" }).getAttribute("href")).toBe("/societes");
    expect(screen.getByText(/À compléter : adresse \(rue, ville, code postal\)/)).toBeTruthy();
    cleanup();
    monter("nouvelle", undefined, "s1");
    expect(screen.queryByRole("link", { name: "Compléter la société" })).toBeNull();
    expect(screen.getByText(/Client complet : facture électronique possible/)).toBeTruthy();
  });

  it("Entrée dans le prix de la dernière ligne ajoute une ligne ; la suppression n'est possible qu'à partir de deux lignes", () => {
    monter("nouvelle");
    expect((screen.getByLabelText("Supprimer la ligne 1") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByLabelText("Prix unitaire HT, ligne 1"), { key: "Enter" });
    expect(screen.getByLabelText("Description, ligne 2")).toBeTruthy();
    expect((screen.getByLabelText("Supprimer la ligne 2") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByLabelText("Supprimer la ligne 2"));
    expect(screen.queryByLabelText("Description, ligne 2")).toBeNull();
  });

  it("aperçu : activé seulement une fois le client choisi, il reçoit le brouillon avec le numéro prévu et le net à payer", () => {
    monter("nouvelle");
    expect((screen.getByRole("button", { name: "Aperçu de la facture" }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    monter("modification");
    fireEvent.click(screen.getByRole("button", { name: "Aperçu de la facture" }));
    expect(screen.getByText("Aperçu 2026-0007 net 600.9")).toBeTruthy();
  });
});
