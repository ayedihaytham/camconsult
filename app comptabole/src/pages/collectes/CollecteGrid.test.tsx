// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { CollecteGrid, type CollecteGridHandle } from "./CollecteGrid";
import { TAB_BY_KEY } from "@/lib/collecte/tabs";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderGrid(key: string, onSave = vi.fn().mockResolvedValue(undefined), extra: Partial<React.ComponentProps<typeof CollecteGrid>> = {}) {
  const ref = createRef<CollecteGridHandle>();
  render(
    <CollecteGrid
      ref={ref}
      def={TAB_BY_KEY[key]}
      lignes={[]}
      readOnly={false}
      devise="TND"
      onSave={onSave}
      {...extra}
    />,
  );
  return { ref, onSave };
}

const lignes = () => Array.from(document.querySelectorAll<HTMLTableRowElement>("tbody tr[data-row]"));
const champs = (ligne: HTMLElement) => Array.from(ligne.querySelectorAll<HTMLInputElement>("input"));
const ajouter = () => fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
const enregistrer = () => screen.getByRole("button", { name: "Enregistrer" });

describe("CollecteGrid : ajout de lignes directement dans le tableau", () => {
  it("ajoute une ligne vide dans le tableau, sans panneau, avec le curseur dans la première case", () => {
    const { ref } = renderGrid("bordereaux_remise_cheques");
    expect(screen.getByText("Aucune ligne. Cliquez sur « Ajouter une ligne ».")).toBeTruthy();
    ajouter();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(lignes()).toHaveLength(1);
    expect(screen.queryByText("Aucune ligne. Cliquez sur « Ajouter une ligne ».")).toBeNull();
    expect(document.activeElement).toBe(champs(lignes()[0])[0]);
    // Une ligne restée vide n'est pas une modification.
    expect(ref.current?.isDirty()).toBe(false);
    expect(enregistrer().hasAttribute("disabled")).toBe(true);
  });

  it("ajoute les lignes les unes sous les autres et ne marque une modification qu'une fois la ligne écrite", () => {
    const { ref } = renderGrid("bordereaux_remise_cheques");
    ajouter();
    ajouter();
    ajouter();
    expect(lignes()).toHaveLength(3);
    expect(ref.current?.isDirty()).toBe(false);

    fireEvent.change(champs(lignes()[1])[1], { target: { value: "REM-42" } });
    expect(ref.current?.isDirty()).toBe(true);
    expect(enregistrer().hasAttribute("disabled")).toBe(false);
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
  });

  it("ajoute la ligne suivante avec Entrée dans la dernière case d'une ligne remplie", () => {
    renderGrid("bordereaux_remise_cheques");
    ajouter();
    const dernier = () => {
      const cases = champs(lignes()[lignes().length - 1]);
      return cases[cases.length - 1];
    };
    // Une ligne vide ne multiplie pas les lignes.
    fireEvent.keyDown(dernier(), { key: "Enter" });
    expect(lignes()).toHaveLength(1);

    fireEvent.change(champs(lignes()[0])[1], { target: { value: "REM-1" } });
    fireEvent.keyDown(dernier(), { key: "Enter" });
    expect(lignes()).toHaveLength(2);
    expect(document.activeElement).toBe(champs(lignes()[1])[0]);
  });

  it("n'enregistre pas les lignes restées vides", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { ref } = renderGrid("bordereaux_remise_cheques", onSave);
    ajouter();
    ajouter();
    fireEvent.change(champs(lignes()[0])[1], { target: { value: "REM-42" } });
    await act(async () => ref.current?.save());

    expect(onSave).toHaveBeenCalledWith([{ data: expect.objectContaining({ num_bordereau: "REM-42" }), ordre: 0 }]);
    expect(lignes()).toHaveLength(1);
    expect(ref.current?.isDirty()).toBe(false);
  });

  it("garde la saisie quand l'enregistrement échoue, et l'abandonne avec discard()", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("network"));
    const { ref } = renderGrid("virements_recus", onSave);
    ajouter();
    fireEvent.change(champs(lignes()[0])[1], { target: { value: "Client" } });
    await act(async () => {
      await expect(ref.current?.save()).rejects.toThrow("network");
    });
    expect(ref.current?.isDirty()).toBe(true);
    expect(screen.getByDisplayValue("Client")).toBeTruthy();

    act(() => ref.current?.discard());
    expect(ref.current?.isDirty()).toBe(false);
    expect(screen.queryByDisplayValue("Client")).toBeNull();
  });

  it("garde le solde initial saisi dans la première ligne d'un état de caisse, les suivantes calculent le leur", () => {
    const { ref } = renderGrid("etat_caisse");
    ajouter();
    const solde = (i: number) => champs(lignes()[i])[4];
    expect(solde(0).readOnly).toBe(false);
    fireEvent.change(solde(0), { target: { value: "500" } });
    expect(ref.current?.isDirty()).toBe(true);

    ajouter();
    expect(solde(1).readOnly).toBe(true);
    fireEvent.change(champs(lignes()[1])[2], { target: { value: "100" } });
    expect(solde(1).value).toBe("600");
  });
});

describe("CollecteGrid : bordereau réparti sur plusieurs lignes", () => {
  // Colonnes du bordereau : 0 date remise, 1 n° bordereau, 2 montant bordereau, 3 banque, 4 n° chèque, 5 client, 6 montant, 7 valeur, 8 obs.
  const MONTANT_BORDEREAU = 2;
  const BANQUE = 3;
  const NUM_CHEQUE = 4;
  const MONTANT = 6;
  const suivi = () => document.querySelector('[data-tour="collecte-repartition"]') as HTMLElement | null;

  it("suit la somme des chèques contre le montant du bordereau et propose d'ajouter une ligne à ce bordereau", () => {
    renderGrid("bordereaux_remise_cheques");
    ajouter();
    fireEvent.change(champs(lignes()[0])[1], { target: { value: "REM-42" } });
    fireEvent.change(champs(lignes()[0])[MONTANT_BORDEREAU], { target: { value: "60000" } });
    fireEvent.change(champs(lignes()[0])[MONTANT], { target: { value: "35000" } });

    expect(suivi()?.textContent).toContain("Bordereau REM-42");
    expect(suivi()?.textContent).toMatch(/35\s000,000 \/ 60\s000,000 TND/);
    expect(suivi()?.textContent).toMatch(/Reste 25\s000,000/);

    fireEvent.click(screen.getByRole("button", { name: /Ajouter une ligne à ce bordereau/ }));
    expect(lignes()).toHaveLength(2);
    // La ligne reprend le n° de bordereau et le curseur va au n° de chèque, première case encore vide.
    expect(champs(lignes()[1])[1].value).toBe("REM-42");
    expect(document.activeElement).toBe(champs(lignes()[1])[NUM_CHEQUE]);
  });

  it("reprend la banque avec Entrée tant que la somme n'est pas atteinte, puis ouvre une ligne vierge", () => {
    renderGrid("bordereaux_remise_cheques");
    ajouter();
    const l0 = champs(lignes()[0]);
    fireEvent.change(l0[1], { target: { value: "REM-42" } });
    fireEvent.change(l0[MONTANT_BORDEREAU], { target: { value: "60000" } });
    fireEvent.change(l0[BANQUE], { target: { value: "BNA" } });
    fireEvent.change(l0[MONTANT], { target: { value: "35000" } });
    fireEvent.keyDown(l0[l0.length - 1], { key: "Enter" });
    expect(lignes()).toHaveLength(2);
    expect(champs(lignes()[1])[BANQUE].value).toBe("BNA");

    fireEvent.change(champs(lignes()[1])[MONTANT], { target: { value: "25000" } });
    expect(suivi()?.textContent).toContain("Complet");
    expect(screen.queryByRole("button", { name: /Ajouter une ligne à ce bordereau/ })).toBeNull();
    const l1 = champs(lignes()[1]);
    fireEvent.keyDown(l1[l1.length - 1], { key: "Enter" });
    expect(lignes()).toHaveLength(3);
    expect(champs(lignes()[2])[1].value).toBe("");
  });

  it("après un bordereau terminé : « Nouveau bordereau » repart d'une ligne vierge, « Ajouter à un bordereau » continue le même", async () => {
    renderGrid("bordereaux_remise_cheques");
    // Avant tout bordereau, un seul bouton.
    expect(screen.queryByRole("button", { name: "Nouveau bordereau" })).toBeNull();
    ajouter();
    const l0 = champs(lignes()[0]);
    fireEvent.change(l0[1], { target: { value: "REM-42" } });
    fireEvent.change(l0[MONTANT_BORDEREAU], { target: { value: "60000" } });
    fireEvent.change(l0[BANQUE], { target: { value: "BNA" } });
    fireEvent.change(l0[MONTANT], { target: { value: "60000" } });
    expect(suivi()?.textContent).toContain("Complet");

    // Bordereau complet : nouveau bordereau = ligne vierge, sans n° ni banque repris.
    fireEvent.click(screen.getByRole("button", { name: "Nouveau bordereau" }));
    expect(lignes()).toHaveLength(2);
    expect(champs(lignes()[1])[1].value).toBe("");
    expect(champs(lignes()[1])[BANQUE].value).toBe("");

    // Même bordereau : la ligne reprend son n° et sa banque.
    fireEvent.keyDown(screen.getByRole("button", { name: /Ajouter à un bordereau/ }), { key: "Enter", code: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /REM-42/ }));
    expect(lignes()).toHaveLength(3);
    expect(champs(lignes()[2])[1].value).toBe("REM-42");
    expect(champs(lignes()[2])[BANQUE].value).toBe("BNA");
  });

  it("un bordereau complet propose quand même d'y ajouter un chèque, et signale alors le dépassement", () => {
    renderGrid("bordereaux_remise_cheques");
    ajouter();
    const l0 = champs(lignes()[0]);
    fireEvent.change(l0[1], { target: { value: "REM-42" } });
    fireEvent.change(l0[MONTANT_BORDEREAU], { target: { value: "1000" } });
    fireEvent.change(l0[MONTANT], { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un chèque à ce bordereau/ }));
    expect(lignes()).toHaveLength(2);
    expect(champs(lignes()[1])[1].value).toBe("REM-42");
    fireEvent.change(champs(lignes()[1])[MONTANT], { target: { value: "200" } });
    expect(suivi()?.textContent).toMatch(/Dépassé de 200,000/);
  });

  describe("bordereau envoyé par le cabinet au client", () => {
    const entete = { id: "l1", onglet: "bordereaux_remise_cheques", ordre: 0, data: { date_remise: "2026-05-22", num_bordereau: "293", montant: 10310, banque: "btk", montant_cheque: "" } };
    const rendreClient = (lignesInitiales: unknown[] = [entete]) => renderGrid("bordereaux_remise_cheques", undefined, { lignes: lignesInitiales as never, ligneBordereauFigee: true });

    it("garde la ligne du cabinet telle quelle et propose dessous une ligne vierge du même bordereau", () => {
      const { ref } = rendreClient();
      expect(lignes()).toHaveLength(2);
      // Ligne 1 : celle du cabinet, figée (aucune case modifiable, pas de suppression).
      expect(champs(lignes()[0]).every((c) => c.readOnly)).toBe(true);
      expect(lignes()[0].querySelector('button[title="Supprimer la ligne"]')).toBeNull();
      // Ligne 2 : n°, date et banque repris, montant du bordereau vide, prête pour le 1er chèque.
      const l2 = champs(lignes()[1]);
      expect(l2[1].value).toBe("293");
      expect(l2[MONTANT_BORDEREAU].value).toBe("");
      expect(l2[MONTANT].readOnly).toBe(false);
      // Ouvrir le tableau ne le rend pas « modifié ».
      expect(ref.current?.isDirty()).toBe(false);
    });

    it("n'enregistre que ce que le client saisit, et suit le reste à répartir jusqu'à 0", async () => {
      const { ref, onSave } = rendreClient();
      fireEvent.change(champs(lignes()[1])[MONTANT], { target: { value: "10000" } });
      expect(suivi()?.textContent).toMatch(/Reste 310,000/);
      expect(ref.current?.isComplete()).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: /Ajouter une ligne à ce bordereau/ }));
      expect(lignes()).toHaveLength(3);
      fireEvent.change(champs(lignes()[2])[MONTANT], { target: { value: "310" } });
      expect(suivi()?.textContent).toContain("Complet");
      expect(ref.current?.isComplete()).toBe(true);
      await act(async () => {
        await ref.current?.save();
      });
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave.mock.calls[0][0]).toHaveLength(3);
    });

    it("ne fige rien quand le cabinet a déjà saisi un chèque sur sa ligne, ni pour le cabinet lui-même", () => {
      cleanup();
      const avecCheque = { ...entete, data: { ...entete.data, montant_cheque: 4000 } };
      rendreClient([avecCheque]);
      expect(champs(lignes()[0]).some((c) => !c.readOnly)).toBe(true);
      cleanup();
      renderGrid("bordereaux_remise_cheques", undefined, { lignes: [entete] as never });
      expect(lignes()).toHaveLength(1);
      expect(champs(lignes()[0]).some((c) => !c.readOnly)).toBe(true);
    });
  });

  it("n'est complet que lorsque chaque bordereau a atteint son montant", () => {
    const { ref } = renderGrid("bordereaux_remise_cheques");
    ajouter();
    const l0 = champs(lignes()[0]);
    expect(ref.current?.isComplete()).toBe(true);
    fireEvent.change(l0[1], { target: { value: "REM-42" } });
    fireEvent.change(l0[MONTANT_BORDEREAU], { target: { value: "60000" } });
    fireEvent.change(l0[MONTANT], { target: { value: "35000" } });
    expect(ref.current?.isComplete()).toBe(false);
    expect(ref.current?.incompleteMessage()).toMatch(/Bordereau REM-42 : il reste 25\s000,000 TND à répartir/);
    fireEvent.change(l0[MONTANT], { target: { value: "60000" } });
    expect(ref.current?.isComplete()).toBe(true);
    fireEvent.change(l0[MONTANT], { target: { value: "65000" } });
    expect(ref.current?.isComplete()).toBe(false);
    expect(ref.current?.incompleteMessage()).toMatch(/dépassé de 5\s000,000/);
  });

  it("lit toutes les lignes du bordereau, pas seulement la première (30 000 + 20 000 + 10 000 = 60 000)", () => {
    const { ref } = renderGrid("bordereaux_remise_cheques");
    ajouter();
    const l0 = champs(lignes()[0]);
    fireEvent.change(l0[1], { target: { value: "255558" } });
    fireEvent.change(l0[MONTANT_BORDEREAU], { target: { value: "60000" } });
    fireEvent.change(l0[MONTANT], { target: { value: "30000" } });
    fireEvent.keyDown(l0[l0.length - 1], { key: "Enter" });
    fireEvent.change(champs(lignes()[1])[MONTANT], { target: { value: "20000" } });
    const l1 = champs(lignes()[1]);
    fireEvent.keyDown(l1[l1.length - 1], { key: "Enter" });
    expect(lignes()).toHaveLength(3);
    expect(suivi()?.textContent).toMatch(/50\s000,000 \/ 60\s000,000/);
    fireEvent.change(champs(lignes()[2])[MONTANT], { target: { value: "10000" } });
    expect(suivi()?.textContent).toMatch(/60\s000,000 \/ 60\s000,000 TND · 3 lignes/);
    expect(suivi()?.textContent).toContain("Complet");
    expect(ref.current?.isComplete()).toBe(true);
  });

  it("laisse modifier toutes les cases, y compris le montant du bordereau d'une ligne suivante, après un enregistrement", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { ref } = renderGrid("bordereaux_remise_cheques", onSave);
    ajouter();
    const l0 = champs(lignes()[0]);
    fireEvent.change(l0[1], { target: { value: "255558" } });
    fireEvent.change(l0[MONTANT_BORDEREAU], { target: { value: "60000" } });
    fireEvent.keyDown(l0[l0.length - 1], { key: "Enter" });
    await act(async () => ref.current?.save());
    expect(ref.current?.isDirty()).toBe(false);
    for (const ligne of lignes()) for (const champ of champs(ligne)) expect(champ.readOnly).toBe(false);

    fireEvent.change(champs(lignes()[1])[MONTANT_BORDEREAU], { target: { value: "5" } });
    expect(ref.current?.isDirty()).toBe(true);
  });

  it("ne suit rien pour un tableau sans bordereau", () => {
    const { ref } = renderGrid("souche_cheques");
    ajouter();
    expect(suivi()).toBeNull();
    expect(ref.current?.isComplete()).toBe(true);
  });
});

describe("CollecteGrid : pièce jointe d'une ligne de bordereau", () => {
  const fichier = () => new File(["%PDF-1.4"], "bordereau-255558.pdf", { type: "application/pdf" });

  it("joint un fichier à la ligne : le fichier est envoyé, son nom retenu, et la ligne devient modifiée", async () => {
    const onJoindre = vi.fn().mockResolvedValue({ id: "f1", nom: "bordereau-255558.pdf" });
    const { ref } = renderGrid("bordereaux_remise_cheques", undefined, { onJoindre, onVoirPiece: vi.fn() });
    ajouter();
    expect(ref.current?.isDirty()).toBe(false);
    fireEvent.change(screen.getByLabelText("Joindre un fichier à la ligne 1"), { target: { files: [fichier()] } });

    await waitFor(() => expect(onJoindre).toHaveBeenCalledTimes(1));
    expect(onJoindre.mock.calls[0][0].name).toBe("bordereau-255558.pdf");
    await waitFor(() => expect(screen.getByLabelText("Voir la pièce jointe de la ligne 1")).toBeTruthy());
    // Une ligne avec seulement une pièce jointe n'est plus une ligne vide.
    expect(ref.current?.isDirty()).toBe(true);
  });

  it("enregistre le lien vers la pièce avec la ligne, et permet de la voir ou de la retirer", async () => {
    const onJoindre = vi.fn().mockResolvedValue({ id: "f1", nom: "bordereau-255558.pdf" });
    const onVoirPiece = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { ref } = renderGrid("bordereaux_remise_cheques", onSave, { onJoindre, onVoirPiece });
    ajouter();
    fireEvent.change(screen.getByLabelText("Joindre un fichier à la ligne 1"), { target: { files: [fichier()] } });
    await waitFor(() => expect(screen.getByLabelText("Voir la pièce jointe de la ligne 1")).toBeTruthy());

    fireEvent.click(screen.getByLabelText("Voir la pièce jointe de la ligne 1"));
    expect(onVoirPiece).toHaveBeenCalledWith("f1");

    await act(async () => ref.current?.save());
    expect(onSave).toHaveBeenCalledWith([
      { data: expect.objectContaining({ observations_fichier: "f1", observations_fichier_nom: "bordereau-255558.pdf" }), ordre: 0 },
    ]);

    fireEvent.click(screen.getByLabelText("Retirer la pièce jointe de la ligne 1"));
    expect(screen.queryByLabelText("Voir la pièce jointe de la ligne 1")).toBeNull();
    expect(screen.getByLabelText("Joindre un fichier à la ligne 1")).toBeTruthy();
    expect(ref.current?.isDirty()).toBe(true);
  });

  it("laisse une note écrite à côté de la pièce jointe", () => {
    renderGrid("bordereaux_remise_cheques", undefined, { onJoindre: vi.fn(), onVoirPiece: vi.fn() });
    ajouter();
    const note = champs(lignes()[0]).find((c) => c.dataset.col === "observations") as HTMLInputElement;
    fireEvent.change(note, { target: { value: "chèque 2 à vérifier" } });
    expect(screen.getByDisplayValue("chèque 2 à vérifier")).toBeTruthy();
  });

  it("ne propose pas de joindre un fichier en lecture seule, ni sur une colonne ordinaire", () => {
    const ref = createRef<CollecteGridHandle>();
    render(
      <CollecteGrid
        ref={ref}
        def={TAB_BY_KEY.souche_cheques}
        lignes={[]}
        readOnly={false}
        devise="TND"
        onSave={vi.fn()}
        onJoindre={vi.fn()}
      />,
    );
    ajouter();
    expect(screen.queryByLabelText(/Joindre un fichier/)).toBeNull();
  });
});
