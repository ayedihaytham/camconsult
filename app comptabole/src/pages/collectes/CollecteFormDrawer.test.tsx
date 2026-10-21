// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CollecteFormDrawer } from "./CollecteFormDrawer";
import { COLLECTE_TABS } from "@/lib/collecte/tabs";

vi.mock("@/store/data", () => ({ useSocietes: () => [{ id: "soc-1", raisonSociale: "Société test" }] }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canSeeSociete: () => true }) }));
afterEach(cleanup);

function renderForm(extra: Partial<React.ComponentProps<typeof CollecteFormDrawer>> = {}) {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const result = render(<CollecteFormDrawer open onOpenChange={onOpenChange} onCreate={onCreate} defaultSocieteId="soc-1" {...extra} />);
  return { ...result, onCreate, onOpenChange };
}

const remplirPeriode = () => fireEvent.change(screen.getByLabelText(/Période concernée/), { target: { value: "Octobre 2026" } });

describe("CollecteFormDrawer : sélection de tableaux", () => {
  it("commence sans sélection et transmet uniquement les cartes choisies", async () => {
    const { onCreate } = renderForm();
    remplirPeriode();
    expect(screen.getAllByRole("checkbox", { checked: false })).toHaveLength(COLLECTE_TABS.length + 1); // + l'option « Envoi par lignes »
    fireEvent.click(screen.getByText("Virements reçus"));
    expect(screen.getByRole("checkbox", { name: "Virements reçus" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Créer la collecte" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      societeId: "soc-1", onglets: ["virements_recus"],
    })));
  });

  it("sélectionne une famille sans sélectionner les autres tableaux", async () => {
    const { onCreate } = renderForm();
    remplirPeriode();
    fireEvent.click(screen.getByRole("button", { name: "Tout cocher : État des virements" }));
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Créer la collecte" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ onglets: ["virements_recus", "virements_emis", "virements_salaire"] })));
  });

  it("empêche une création sans tableau puis permet de corriger la sélection", async () => {
    const { onCreate } = renderForm();
    remplirPeriode();
    fireEvent.click(screen.getByRole("button", { name: "Créer la collecte" }));
    expect(screen.getByRole("alert").textContent).toBe("Sélectionnez au moins un tableau.");
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Souche de chèques" }));
    fireEvent.click(screen.getByRole("button", { name: "Créer la collecte" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ onglets: ["souche_cheques"] })));
  });

  it("conserve la sélection et les paramètres existants en mode édition", async () => {
    const initial = { societeId: "soc-1", periode: "T3 2026", onglets: ["virements_recus"], devise: "EUR", echeance: "2026-10-20", relanceCadenceJours: 5, envoiParLignes: false };
    const { onCreate } = renderForm({ initial });
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(initial));
  });

  it("réinitialise la sélection quand une nouvelle création est rouverte", () => {
    const { rerender, onCreate, onOpenChange } = renderForm();
    fireEvent.click(screen.getByRole("checkbox", { name: "Virements reçus" }));
    rerender(<CollecteFormDrawer open={false} onCreate={onCreate} onOpenChange={onOpenChange} />);
    rerender(<CollecteFormDrawer open onCreate={onCreate} onOpenChange={onOpenChange} />);
    expect(screen.queryByRole("checkbox", { checked: true })).toBeNull();
    expect(screen.getAllByRole("checkbox", { checked: false })).toHaveLength(COLLECTE_TABS.length + 1);
  });
});

describe("CollecteFormDrawer : envoi par lignes", () => {
  it("est désactivé par défaut et transmis à la création quand le cabinet le coche", async () => {
    const { onCreate } = renderForm();
    remplirPeriode();
    const option = screen.getByRole("checkbox", { name: "Envoi par lignes" });
    expect(option.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByText("Virements reçus"));
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Créer la collecte" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ envoiParLignes: true })));
  });

  it("reprend la valeur de la collecte en modification", async () => {
    const initial = { societeId: "soc-1", periode: "T3 2026", onglets: ["virements_recus"], devise: "TND", echeance: null, relanceCadenceJours: 3, envoiParLignes: true };
    const { onCreate } = renderForm({ initial });
    expect(screen.getByRole("checkbox", { name: "Envoi par lignes" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(initial));
  });
});

describe("CollecteFormDrawer : période obligatoire", () => {
  it("laisse la période vide au départ, propose des raccourcis, et refuse une période vide", async () => {
    const { onCreate } = renderForm();
    const champ = screen.getByLabelText(/Période concernée/) as HTMLInputElement;
    expect(champ.value).toBe("");
    expect(screen.getByRole("group", { name: "Périodes proposées" })).toBeTruthy();
    fireEvent.click(screen.getByText("Virements reçus"));
    fireEvent.click(screen.getByRole("button", { name: "Créer la collecte" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/La période est obligatoire/);
    expect(onCreate).not.toHaveBeenCalled();
    const raccourci = screen.getByRole("group", { name: "Périodes proposées" }).querySelectorAll("button")[2];
    fireEvent.click(raccourci);
    expect(champ.value).toBe(raccourci.textContent);
  });
});

describe("CollecteFormDrawer : grand-livre importé à la création", () => {
  const rows = [
    ["I CARGO LINE", "Grand-livre des comptes"],
    ["Date C.j N° pièce", "Libellé écriture", "Mouvement débit", "Mouvement crédit", "Solde"],
    ["461000 COMPTES D'ATTENTE"],
    ["010126 RAN 5", "SOLDE ANTERIEURE", "", "1 000,000", ""],
    ["060126 ZITO 3", "REG CHQ N°4001511 BATTERIE", "820,000", "", ""],
    ["300126 BTK 169", "ENC CHQ N°8431", "", "2 680,089", ""],
    ["020226 BTK 2", "VIR ETRANGER", "", "6 208,274", ""],
  ];
  const importer = async () => {
    const entree = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(entree, { target: { files: [new File(["x"], "461.pdf", { type: "application/pdf" })] } });
    await screen.findByText(/461\.pdf · 4 écritures/);
  };

  it("détecte les tableaux à remplir, les ajoute à la sélection et envoie les lignes pré-remplies avec la création", async () => {
    const { lireGrandLivre } = await import("@/lib/collecte/grandLivre");
    vi.spyOn(await import("@/lib/collecte/lireGrandLivrePdf"), "lireGrandLivrePdf").mockResolvedValue(lireGrandLivre([rows])!);
    const { onCreate } = renderForm();
    remplirPeriode();
    await importer();
    expect(screen.getByText(/Tableaux détectés : État des chèques émis \(1\) · Bordereaux remise de chèques \(1\) · Virements reçus \(1\)/)).toBeTruthy();
    expect(screen.getByText(/1 écriture \(solde antérieur ou à classer\) ne sera pas importée/)).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Virements reçus" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("checkbox", { name: "État des chèques émis" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Créer la collecte" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const [data, prerempli] = onCreate.mock.calls[0];
    expect([...data.onglets].sort()).toEqual(["bordereaux_remise_cheques", "etat_cheques_emis", "virements_recus"]);
    expect(Object.keys(prerempli).sort()).toEqual(["bordereaux_remise_cheques", "etat_cheques_emis", "virements_recus"]);
    expect(prerempli.etat_cheques_emis[0]).toMatchObject({ num_cheque: "4001511", beneficiaire: "BATTERIE", montant: 820 });
  });

  it("un tableau décoché n'est pas pré-rempli ; sans grand-livre, la création est inchangée (un seul argument)", async () => {
    const { lireGrandLivre } = await import("@/lib/collecte/grandLivre");
    vi.spyOn(await import("@/lib/collecte/lireGrandLivrePdf"), "lireGrandLivrePdf").mockResolvedValue(lireGrandLivre([rows])!);
    const { onCreate } = renderForm();
    remplirPeriode();
    await importer();
    fireEvent.click(screen.getByRole("checkbox", { name: "Virements reçus" }));
    fireEvent.click(screen.getByRole("button", { name: "Créer la collecte" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(Object.keys(onCreate.mock.calls[0][1]).sort()).toEqual(["bordereaux_remise_cheques", "etat_cheques_emis"]);
  });

  it("un fichier illisible affiche l'erreur sans bloquer la création", async () => {
    vi.spyOn(await import("@/lib/collecte/lireGrandLivrePdf"), "lireGrandLivrePdf").mockRejectedValue(new Error("Document non reconnu."));
    renderForm();
    const entree = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(entree, { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
    expect((await screen.findByText(/a\.pdf : Document non reconnu\./)).getAttribute("role")).toBe("alert");
  });

  it("n'est pas proposé en mode édition", () => {
    renderForm({ initial: { societeId: "soc-1", periode: "T3 2026", onglets: ["virements_recus"], devise: "TND", echeance: null, relanceCadenceJours: 3 } });
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
