// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CollecteFull } from "@/types";
import { RecapTab } from "./RecapTab";

const { sendRecapSection, closeRecapSection, addNote, success } = vi.hoisted(() => ({
  sendRecapSection: vi.fn(), closeRecapSection: vi.fn(), addNote: vi.fn(), success: vi.fn(),
}));
vi.mock("@/store/collectes", () => ({
  useCollectes: (selector: (state: Record<string, unknown>) => unknown) => selector({ sendRecapSection, closeRecapSection, addNote }),
}));
vi.mock("sonner", () => ({ toast: { success } }));

const collecte = {
  id: "c1", societeId: "s1", periode: "2026", statut: "brouillon",
  onglets: ["souche_cheques", "virements_recus"], devise: "TND", sections: [],
  lignes: [{ id: "l1", onglet: "souche_cheques", ordre: 0, data: { date: "2026-01-06", num_cheque: "", beneficiaire: "X", motif: "", montant: 100, compte_bancaire: "ZITO" } }],
  notes: [], fichiers: [],
} as unknown as CollecteFull;

beforeEach(() => {
  sendRecapSection.mockReset().mockResolvedValue(undefined);
  closeRecapSection.mockReset().mockResolvedValue(undefined);
  addNote.mockReset().mockResolvedValue(undefined);
  success.mockClear();
});
afterEach(cleanup);

const rendre = (c = collecte, onNavigate = vi.fn()) => render(<RecapTab collecte={c} canManageRecap onNavigate={onNavigate} />);
const envoyer = (tableau = "Souche de chèques") => screen.getAllByRole("button", { name: `Transmettre au client : ${tableau}` });
const cloturer = (tableau: string) => screen.getAllByRole("button", { name: `Clôturer la demande : ${tableau}` });

describe("Récap : demandes au client depuis le registre", () => {
  it("transmet directement un tableau, sans ouvrir son détail", async () => {
    rendre();
    expect(screen.queryByRole("region", { name: /Détail de/ })).toBeNull();
    fireEvent.click(envoyer()[0]);
    await waitFor(() => expect(sendRecapSection).toHaveBeenCalledWith("c1", "souche_cheques", 3));
    expect(success).toHaveBeenCalledWith("« Souche de chèques » transmis au client");
  });

  it("affiche les tableaux entièrement vides et permet de les demander", async () => {
    rendre();
    expect(screen.getAllByText("Virements reçus").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tableau à remplir").length).toBeGreaterThan(0);
    fireEvent.click(envoyer("Virements reçus")[0]);
    await waitFor(() => expect(sendRecapSection).toHaveBeenCalledWith("c1", "virements_recus", 1));
  });

  it.each(["envoye", "repondu"])("clôture directement une demande %s", async (recapStatut) => {
    rendre({ ...collecte, sections: [{ onglet: "virements_recus", recapStatut }] } as unknown as CollecteFull);
    expect(screen.queryByRole("button", { name: "Transmettre au client : Virements reçus" })).toBeNull();
    fireEvent.click(cloturer("Virements reçus")[0]);
    await waitFor(() => expect(closeRecapSection).toHaveBeenCalledWith("c1", "virements_recus"));
    expect(success).toHaveBeenCalledWith("Demande « Virements reçus » clôturée");
  });

  it("verrouille toutes les mutations pendant une transmission pour éviter les doublons", async () => {
    let terminer!: () => void;
    sendRecapSection.mockImplementation(() => new Promise<void>((resolve) => { terminer = resolve; }));
    rendre({ ...collecte, sections: [{ onglet: "virements_recus", recapStatut: "envoye" }] } as unknown as CollecteFull);
    const boutons = envoyer();
    fireEvent.click(boutons[0]);
    expect(boutons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(cloturer("Virements reçus").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect((screen.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(boutons[1]);
    fireEvent.click(cloturer("Virements reçus")[0]);
    expect(sendRecapSection).toHaveBeenCalledTimes(1);
    expect(closeRecapSection).not.toHaveBeenCalled();
    await act(async () => terminer());
    await waitFor(() => expect((envoyer()[0] as HTMLButtonElement).disabled).toBe(false));
  });

  it("permet de réessayer après un échec d'envoi sans annoncer un succès", async () => {
    sendRecapSection.mockRejectedValueOnce(new Error("Connexion interrompue"));
    rendre();
    fireEvent.click(envoyer()[0]);
    await waitFor(() => expect((envoyer()[0] as HTMLButtonElement).disabled).toBe(false));
    expect(success).not.toHaveBeenCalled();
    fireEvent.click(envoyer()[0]);
    await waitFor(() => expect(sendRecapSection).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
  });

  it("conserve la demande après un échec de clôture", async () => {
    closeRecapSection.mockRejectedValueOnce(new Error("Connexion interrompue"));
    rendre({ ...collecte, sections: [{ onglet: "virements_recus", recapStatut: "repondu" }] } as unknown as CollecteFull);
    fireEvent.click(cloturer("Virements reçus")[0]);
    await waitFor(() => expect((cloturer("Virements reçus")[0] as HTMLButtonElement).disabled).toBe(false));
    expect(success).not.toHaveBeenCalled();
    expect(screen.getAllByText("Réponse reçue").length).toBeGreaterThan(0);
  });

  it("ne propose pas de demande pour un tableau sans case manquante", () => {
    rendre({ ...collecte, onglets: ["souche_cheques"], lignes: [{ ...collecte.lignes[0], data: { ...collecte.lignes[0].data, num_cheque: "1", motif: "Achat", observations: "RAS" } }] });
    expect(screen.queryByRole("button", { name: /Transmettre au client/ })).toBeNull();
    expect(screen.getAllByText("Aucune case manquante").length).toBeGreaterThan(0);
  });

  it("donne accès aux cases précises sans imposer le détail avant l'envoi", () => {
    const onNavigate = vi.fn();
    rendre(collecte, onNavigate);
    fireEvent.click(screen.getAllByRole("button", { name: "Voir le détail de Souche de chèques" })[0]);
    const detail = screen.getAllByRole("region", { name: "Détail de « Souche de chèques »" })[0];
    expect(within(detail).getByText("Ligne 1")).toBeTruthy();
    fireEvent.click(within(detail).getByRole("button", { name: "Ouvrir la ligne 1, N° Chèque, dans Souche de chèques" }));
    expect(onNavigate).toHaveBeenCalledWith("souche_cheques", { ordre: 0, col: "num_cheque" });
    expect(envoyer().length).toBeGreaterThan(0);
  });

  it("ouvre et referme un seul détail à la fois", () => {
    rendre();
    fireEvent.click(screen.getAllByRole("button", { name: "Voir le détail de Souche de chèques" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Voir le détail de Virements reçus" })[0]);
    const noms = new Set(screen.getAllByRole("region", { name: /Détail de/ }).map((region) => region.getAttribute("aria-label")));
    expect([...noms]).toEqual(["Détail de « Virements reçus »"]);
    fireEvent.click(screen.getAllByRole("button", { name: "Masquer le détail de Virements reçus" })[0]);
    expect(screen.queryByRole("region", { name: /Détail de/ })).toBeNull();
  });
});

describe("Récap : droits et archives", () => {
  it.each([{ canManageRecap: false, isClient: false }, { canManageRecap: false, isClient: true }, { canManageRecap: true, isClient: true }])("ne rend pas le récap hors de l'espace administrateur (%j)", (permissions) => {
    const { container } = render(<RecapTab collecte={collecte} {...permissions} onNavigate={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("garde une collecte archivée consultable sans mutations ni ajout de note", () => {
    rendre({ ...collecte, statut: "archive", sections: [{ onglet: "virements_recus", recapStatut: "envoye" }] } as unknown as CollecteFull);
    expect(screen.getByRole("heading", { name: "Récap" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Transmettre au client|Clôturer|Ajouter/ })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getAllByText("Archivé").length).toBeGreaterThan(0);
  });

  it("masque les mutations d'un seul tableau archivé sans bloquer les autres", () => {
    rendre({ ...collecte, sections: [{ onglet: "virements_recus", recapStatut: "envoye", statut: "archive" }] } as unknown as CollecteFull);
    expect(screen.queryByRole("button", { name: "Clôturer la demande : Virements reçus" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Transmettre au client : Virements reçus" })).toBeNull();
    expect(envoyer().length).toBeGreaterThan(0);
  });

  it("exclut le tableau réservé au cabinet des demandes client", () => {
    rendre({ ...collecte, onglets: ["etat_cheques_emis"] });
    expect(screen.getByText("Aucun tableau destiné au client dans cette collecte.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Transmettre au client/ })).toBeNull();
  });
});

describe("Récap : notes générales", () => {
  it("ajoute la note puis vide le champ uniquement après succès", async () => {
    rendre();
    const input = screen.getByRole("textbox", { name: "Nouvelle note générale" });
    fireEvent.change(input, { target: { value: "  Merci de vérifier les montants.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(addNote).toHaveBeenCalledWith("c1", "", "Merci de vérifier les montants."));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(""));
  });

  it("conserve le texte après un échec pour permettre de réessayer", async () => {
    addNote.mockRejectedValueOnce(new Error("Connexion interrompue"));
    rendre();
    const input = screen.getByRole("textbox", { name: "Nouvelle note générale" });
    fireEvent.change(input, { target: { value: "À vérifier" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(false));
    expect((input as HTMLInputElement).value).toBe("À vérifier");
  });
});

describe("Récap : bordereaux à compléter", () => {
  it("transmet un bordereau dont toutes les cases sont remplies mais le montant reste à répartir", async () => {
    const ligne = { id: "b0", onglet: "bordereaux_remise_cheques", ordre: 0, data: {
      date_remise: "2026-10-10", num_bordereau: "3339", banque: "BIAT", num_cheque: "1", client_emetteur: "X",
      date_echeance: "2026-11-01", observations: "ok", montant: 6660, montant_cheque: 1000,
    } };
    rendre({ ...collecte, onglets: ["bordereaux_remise_cheques"], lignes: [ligne] });
    expect(screen.getAllByText("Montant à vérifier").length).toBeGreaterThan(0);
    expect(screen.getAllByText("À transmettre").length).toBeGreaterThan(0);
    fireEvent.click(envoyer("Bordereaux remise de chèques")[0]);
    await waitFor(() => expect(sendRecapSection).toHaveBeenCalledWith("c1", "bordereaux_remise_cheques", 0));
  });

  it("signale un montant de bordereau incomplet ou dépassé au cabinet", () => {
    const ligne = (ordre: number, data: Record<string, unknown>) => ({ id: `b${ordre}`, onglet: "bordereaux_remise_cheques", ordre, data });
    const base = { date_remise: "2026-10-10", num_bordereau: "3339", banque: "BIAT", num_cheque: "1", client_emetteur: "X", date_echeance: "2026-11-01", observations: "ok" };
    const c = { ...collecte, onglets: ["bordereaux_remise_cheques"], lignes: [ligne(0, { ...base, montant: 6660, montant_cheque: 40000 })] } as unknown as CollecteFull;
    rendre(c);
    expect(screen.getAllByText(/Bordereau 3339 : dépassé de 33\s340,000 TND/).length).toBeGreaterThan(0);
    cleanup();
    rendre({ ...c, lignes: [ligne(0, { ...base, montant: 6660, montant_cheque: 1000 })] } as unknown as CollecteFull);
    expect(screen.getAllByText(/Bordereau 3339 : il reste 5\s660,000 TND à répartir/).length).toBeGreaterThan(0);
  });

  it("ne signale pas d'écart pour un bordereau réparti en entier", () => {
    const ligne = { id: "b0", onglet: "bordereaux_remise_cheques", ordre: 0, data: { date_remise: "2026-10-10", num_bordereau: "1", montant: 100, montant_cheque: 100 } };
    rendre({ ...collecte, onglets: ["bordereaux_remise_cheques"], lignes: [ligne] } as unknown as CollecteFull);
    expect(screen.queryByText(/il reste|dépassé/)).toBeNull();
  });
});
