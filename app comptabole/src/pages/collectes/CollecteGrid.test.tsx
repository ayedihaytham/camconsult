// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const champs = (ligne: HTMLElement) => Array.from(ligne.querySelectorAll<HTMLInputElement>('input:not([type="file"])'));
const ajouter = () => {
  const generic = screen.queryByRole("button", { name: "Ajouter une ligne" });
  // Un bordereau existant a un seul bouton d'ajout, lié à sa fiche de suivi.
  const action = generic ?? screen.getAllByRole("button", { name: /Ajouter un chèque à ce bordereau/ }).at(-1);
  if (!action) throw new Error("Aucune action d'ajout visible");
  fireEvent.click(action);
};
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
    // Une ligne vierge est déjà là : cliquer encore n'en empile pas d'autres, le curseur y retourne.
    ajouter();
    ajouter();
    expect(lignes()).toHaveLength(1);
    expect(ref.current?.isDirty()).toBe(false);

    fireEvent.change(champs(lignes()[0])[1], { target: { value: "REM-42" } });
    expect(ref.current?.isDirty()).toBe(true);
    ajouter();
    expect(lignes()).toHaveLength(2);
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
    fireEvent.change(champs(lignes()[0])[4], { target: { value: "CHQ-1" } });
    fireEvent.keyDown(dernier(), { key: "Enter" });
    expect(lignes()).toHaveLength(2);
    // Entrée prolonge désormais le bordereau en cours, sans créer un nouveau groupe.
    expect(champs(lignes()[1])[1].value).toBe("REM-1");
    expect(document.activeElement).toBe(champs(lignes()[1])[4]);
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

  it("protège la saisie et les actions du circuit tant que l'enregistrement est en cours", async () => {
    let finishSave!: () => void;
    const onSave = vi.fn(() => new Promise<void>((resolve) => { finishSave = resolve; }));
    const { ref } = renderGrid("virements_recus", onSave, {
      workflowActions: <button type="button">Transférer au cabinet</button>,
    });
    ajouter();
    fireEvent.change(champs(lignes()[0])[1], { target: { value: "Client" } });
    let pending!: Promise<void>;
    act(() => { pending = ref.current!.save(); });
    expect(champs(lignes()[0])[1].matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Ajouter une ligne" }).matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Transférer au cabinet" }).matches(":disabled")).toBe(true);
    await act(async () => { finishSave(); await pending; });
    expect(champs(lignes()[0])[1].matches(":disabled")).toBe(false);
    expect(screen.getByDisplayValue("Client")).toBeTruthy();
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

describe("CollecteGrid : barre d'actions épurée", () => {
  it("place les exports dans le même bandeau sticky que l'enregistrement", () => {
    renderGrid("virements_recus", undefined, {
      exportActions: <div><button type="button">Excel</button><button type="button">PDF</button><button type="button">Imprimer</button></div>,
    });
    const barre = document.querySelector('[data-tour="collecte-sticky-tools"]') as HTMLElement;
    expect(barre.className).toContain("sticky");
    expect(within(barre).getByRole("button", { name: "Excel" })).toBeTruthy();
    expect(within(barre).getByRole("button", { name: "PDF" })).toBeTruthy();
    expect(within(barre).getByRole("button", { name: "Imprimer" })).toBeTruthy();
    expect(within(barre).getByRole("button", { name: "Enregistrer" })).toBeTruthy();
    expect(document.querySelectorAll('[data-tour="collecte-export-sticky"]')).toHaveLength(1);
  });

  it("n'affiche pas de second bouton Ajouter un chèque sous les récapitulatifs", () => {
    renderGrid("bordereaux_remise_cheques");
    ajouter();
    fireEvent.change(champs(lignes()[0])[1], { target: { value: "BRD-9" } });
    // Le suivi d'un bordereau n'apparaît dans la barre qu'une fois son montant annoncé.
    fireEvent.change(champs(lignes()[0])[2], { target: { value: "1000" } });
    const barre = document.querySelector('[data-tour="collecte-sticky-tools"]') as HTMLElement;
    expect(within(barre).getByRole("button", { name: /Ajouter un chèque à ce bordereau BRD-9/ })).toBeTruthy();
    expect(within(barre).queryByRole("button", { name: "Nouveau bordereau" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ajouter un chèque" })).toBeNull();
  });

  it("garde le circuit accessible dans la barre fixe d'un tableau en consultation", () => {
    renderGrid("virements_recus", undefined, {
      readOnly: true,
      workflowActions: <button type="button">Valider ce tableau</button>,
    });
    const barre = screen.getByRole("region", { name: "Suivi et actions du tableau" });
    expect(within(barre).getByRole("button", { name: "Valider ce tableau" })).toBeTruthy();
    expect(within(barre).queryByRole("button", { name: "Enregistrer" })).toBeNull();
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

    fireEvent.click(screen.getByRole("button", { name: /Ajouter un chèque à ce bordereau/ }));
    expect(lignes()).toHaveLength(2);
    // La ligne reprend le n° de bordereau et le curseur va au n° de chèque, première case encore vide.
    expect(champs(lignes()[1])[1].value).toBe("REM-42");
    expect(document.activeElement).toBe(champs(lignes()[1])[NUM_CHEQUE]);
  });

  it("reprend la banque avec Entrée, y compris après la répartition complète", () => {
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
    // Le bouton de ce bordereau reste proposé même terminé (un chèque de plus, à revoir ensuite avec le montant).
    expect(screen.getByRole("button", { name: /Ajouter un chèque à ce bordereau/ })).toBeTruthy();
    const l1 = champs(lignes()[1]);
    fireEvent.keyDown(l1[l1.length - 1], { key: "Enter" });
    // Entrée ne doit plus créer de nouveau bordereau ni produire une ligne sans numéro.
    expect(lignes()).toHaveLength(3);
    expect(champs(lignes()[2])[1].value).toBe("REM-42");
    expect(champs(lignes()[2])[BANQUE].value).toBe("BNA");
  });

  it("n'offre pas de création d'un autre bordereau, et continue celui qui existe", () => {
    renderGrid("bordereaux_remise_cheques");
    ajouter();
    fireEvent.change(champs(lignes()[0])[1], { target: { value: "REM-42" } });
    fireEvent.change(champs(lignes()[0])[MONTANT_BORDEREAU], { target: { value: "60000" } });
    fireEvent.change(champs(lignes()[0])[BANQUE], { target: { value: "BNA" } });
    fireEvent.change(champs(lignes()[0])[MONTANT], { target: { value: "60000" } });
    expect(suivi()?.textContent).toContain("Complet");
    expect(screen.queryByRole("button", { name: /Nouveau bordereau/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Ajouter un chèque à ce bordereau REM-42/ }));
    expect(lignes()).toHaveLength(2);
    expect(champs(lignes()[1])[1].value).toBe("REM-42");
    expect(champs(lignes()[1])[BANQUE].value).toBe("BNA");
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
    const rendreClient = (lignesInitiales: unknown[] = [entete]) => renderGrid("bordereaux_remise_cheques", undefined, { lignes: lignesInitiales as never, ligneBordereauFigee: true, sansSuppression: true });

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

    it("n'attribue pas de n° à la ligne du cabinet : les chèques sont numérotés 1, 2…", () => {
      rendreClient();
      const numero = (i: number) => lignes()[i].querySelector("td")?.textContent?.trim();
      expect([numero(0), numero(1)]).toEqual(["", "1"]);
      fireEvent.change(champs(lignes()[1])[MONTANT], { target: { value: "5000" } });
      fireEvent.click(screen.getByRole("button", { name: /Ajouter un chèque à ce bordereau/ }));
      expect(numero(2)).toBe("2");
    });

    it("l'admin voit la même numérotation : la ligne d'en-tête sans n°, puis les chèques 1, 2", () => {
      const cheque = (n: number, id: string, ordre: number) => ({ id, onglet: "bordereaux_remise_cheques", ordre, data: { date_remise: "2026-05-22", num_bordereau: "293", montant: "", banque: "BTK", montant_cheque: n } });
      renderGrid("bordereaux_remise_cheques", undefined, { lignes: [entete, cheque(10000, "l2", 1), cheque(310, "l3", 2)] as never });
      const numero = (i: number) => lignes()[i].querySelector("td")?.textContent?.trim();
      expect([numero(0), numero(1), numero(2)]).toEqual(["", "1", "2"]);
      // Côté cabinet, rien n'est figé : la ligne d'en-tête reste modifiable.
      expect(champs(lignes()[0]).some((c) => !c.readOnly)).toBe(true);
    });

    it("permet de modifier et d'ajouter des lignes, mais pas de supprimer celles déjà enregistrées", () => {
      const chequeSaisi = { id: "l2", onglet: "bordereaux_remise_cheques", ordre: 1, data: { date_remise: "2026-05-22", num_bordereau: "293", montant: "", banque: "btk", montant_cheque: 4000 } };
      rendreClient([entete, chequeSaisi]);
      const supprimer = (i: number) => lignes()[i].querySelector('button[title="Supprimer la ligne"]');
      expect(supprimer(0)).toBeNull();
      expect(supprimer(1)).toBeNull();
      // Une ligne ajoutée et pas encore enregistrée se retire.
      fireEvent.click(screen.getByRole("button", { name: /Ajouter un chèque à ce bordereau/ }));
      expect(lignes()).toHaveLength(3);
      expect(supprimer(2)).not.toBeNull();
      fireEvent.click(supprimer(2)!);
      expect(lignes()).toHaveLength(2);
      // Les cases d'une ligne enregistrée restent modifiables.
      expect(champs(lignes()[1])[MONTANT].readOnly).toBe(false);
    });

    it("n'enregistre que ce que le client saisit, et suit le reste à répartir jusqu'à 0", async () => {
      const { ref, onSave } = rendreClient();
      fireEvent.change(champs(lignes()[1])[MONTANT], { target: { value: "10000" } });
      expect(suivi()?.textContent).toMatch(/Reste 310,000/);
      expect(ref.current?.isComplete()).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: /Ajouter un chèque à ce bordereau/ }));
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
    expect(suivi()?.textContent).toMatch(/60\s000,000 \/ 60\s000,000 TND\s?· 3 lignes/);
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
    const { ref } = renderGrid("virements_recus");
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
        def={TAB_BY_KEY.virements_recus}
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

describe("CollecteGrid : souche de chèques ouverte par une plage de numéros", () => {
  const NUM = 1; // colonnes : 0 date, 1 n° chèque, 2 bénéficiaire…

  it("demande d'abord le premier et le dernier numéro, sans proposer d'ajouter une ligne à la main", () => {
    renderGrid("souche_cheques");
    expect(screen.getByText("Avant de saisir : les numéros de votre souche")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ajouter une ligne" })).toBeNull();
    expect((screen.getByRole("button", { name: "Créer les lignes" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("crée une ligne par numéro de chèque, numéro déjà rempli, puis laisse ajouter des lignes", () => {
    const { ref } = renderGrid("souche_cheques");
    fireEvent.change(screen.getByLabelText(/N° du premier chèque/), { target: { value: "4001001" } });
    fireEvent.change(screen.getByLabelText(/N° du dernier chèque/), { target: { value: "4001004" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer 4 lignes" }));
    expect(lignes()).toHaveLength(4);
    expect(lignes().map((l) => champs(l)[NUM].value)).toEqual(["4001001", "4001002", "4001003", "4001004"]);
    expect(ref.current?.isDirty()).toBe(true);
    // La plage a été saisie : le panneau disparaît et l'ajout de ligne est de nouveau proposé.
    expect(screen.queryByText("Avant de saisir : les numéros de votre souche")).toBeNull();
    expect(screen.getByRole("button", { name: "Ajouter une ligne" })).toBeTruthy();
  });

  it("signale une plage incorrecte et ne crée rien", () => {
    renderGrid("souche_cheques");
    fireEvent.change(screen.getByLabelText(/N° du premier chèque/), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/N° du dernier chèque/), { target: { value: "10" } });
    expect(screen.getByRole("alert").textContent).toMatch(/supérieur ou égal/);
    expect((screen.getByRole("button", { name: "Créer les lignes" }) as HTMLButtonElement).disabled).toBe(true);
    expect(lignes()).toHaveLength(0);
  });

  it("ne demande rien en lecture seule, ni pour un autre tableau", () => {
    cleanup();
    renderGrid("souche_cheques", undefined, { readOnly: true });
    expect(screen.queryByText("Avant de saisir : les numéros de votre souche")).toBeNull();
    cleanup();
    renderGrid("virements_recus");
    expect(screen.queryByText("Avant de saisir : les numéros de votre souche")).toBeNull();
    expect(screen.getByRole("button", { name: "Ajouter une ligne" })).toBeTruthy();
  });
});

describe("CollecteGrid : bordereaux terminés repliés sur une ligne", () => {
  const MONTANT_BORDEREAU = 2;
  const MONTANT = 6;
  const NUM_CHEQUE = 4;
  const resume = (id: string) => document.querySelector<HTMLElement>(`[data-bordereau="${id}"]`);

  /** Saisit un bordereau terminé de deux chèques sur les lignes `debut` et `debut + 1`. */
  function bordereau(num: string, total: number, debut: number) {
    const l0 = champs(lignes()[debut]);
    fireEvent.change(l0[1], { target: { value: num } });
    fireEvent.change(l0[MONTANT_BORDEREAU], { target: { value: String(total) } });
    fireEvent.change(l0[MONTANT], { target: { value: String(total / 2) } });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un chèque à ce bordereau/ }));
    fireEvent.change(champs(lignes()[debut + 1])[MONTANT], { target: { value: String(total / 2) } });
  }

  it("reste déplié tant qu'il est seul et terminé", () => {
    renderGrid("bordereaux_remise_cheques");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    bordereau("REM-1", 1000, 0);
    expect(resume("rem-1")).toBeNull();
    expect(lignes()).toHaveLength(2);
  });

  it("se replie lorsqu'un autre bordereau est importé, et se déplie pour voir le détail", () => {
    const { ref } = renderGrid("bordereaux_remise_cheques");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    bordereau("REM-1", 1000, 0);
    act(() => ref.current?.ajouterLignes([{ num_bordereau: "REM-2", montant: 500, montant_cheque: "" }]));
    const r = resume("rem-1")!;
    expect(r.textContent).toMatch(/Bordereau REM-1/);
    expect(r.textContent).toMatch(/2 lignes · 1\s000,000 TND/);
    expect(r.textContent).toContain("Complet");
    expect(lignes()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /Détail du bordereau REM-1/ }));
    expect(lignes()).toHaveLength(3);
    expect(champs(lignes()[0])[NUM_CHEQUE]).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Replier bordereau REM-1/ }));
    expect(lignes()).toHaveLength(1);
  });

  it("permet de passer d'un bordereau à l'autre après import de plusieurs groupes", () => {
    const { ref } = renderGrid("bordereaux_remise_cheques");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    bordereau("REM-1", 1000, 0);
    act(() => ref.current?.ajouterLignes([{ num_bordereau: "REM-2", montant: 500, montant_cheque: "" }]));
    // La ligne importée est la 3ᵉ ligne du tableau (les deux premières sont repliées).
    const ordre = lignes()[0].getAttribute("data-row");
    expect(ordre).toBe("2");
    const l = champs(lignes()[0]);
    fireEvent.change(l[1], { target: { value: "REM-2" } });
    fireEvent.change(l[MONTANT_BORDEREAU], { target: { value: "500" } });
    fireEvent.change(l[MONTANT], { target: { value: "500" } });
    expect(resume("rem-1")).not.toBeNull();
    expect(resume("rem-2")).not.toBeNull();
    expect(lignes()).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: /Détail du bordereau/ })).toHaveLength(2);
  });

  it("redéplie un bordereau dont le montant n'est plus atteint", () => {
    const { ref } = renderGrid("bordereaux_remise_cheques");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    bordereau("REM-1", 1000, 0);
    act(() => ref.current?.ajouterLignes([{ num_bordereau: "REM-2", montant: 500, montant_cheque: "" }]));
    fireEvent.click(screen.getByRole("button", { name: /Détail du bordereau REM-1/ }));
    fireEvent.change(champs(lignes()[1])[MONTANT], { target: { value: "100" } });
    expect(resume("rem-1")).toBeNull();
    expect(lignes()).toHaveLength(3);
  });
});

describe("CollecteGrid : actions propres à chaque bordereau", () => {
  const MONTANT_BORDEREAU = 2;
  const MONTANT = 6;
  const NUM_CHEQUE = 4;

  /** Deux bordereaux : REM-1 (terminé) et REM-2 (en cours). */
  function deuxBordereaux() {
    const { ref } = renderGrid("bordereaux_remise_cheques");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    const l0 = champs(lignes()[0]);
    fireEvent.change(l0[1], { target: { value: "REM-1" } });
    fireEvent.change(l0[MONTANT_BORDEREAU], { target: { value: "1000" } });
    fireEvent.change(l0[MONTANT], { target: { value: "1000" } });
    act(() => ref.current?.ajouterLignes([{ num_bordereau: "REM-2", montant: 500, montant_cheque: "" }]));
    const l1 = champs(lignes()[0]);
    fireEvent.change(l1[1], { target: { value: "REM-2" } });
    fireEvent.change(l1[MONTANT_BORDEREAU], { target: { value: "500" } });
    fireEvent.change(l1[MONTANT], { target: { value: "200" } });
  }

  it("affiche une action d'ajout directement dans chaque bordereau sans menu supplémentaire", () => {
    deuxBordereaux();
    const actions = screen.getAllByRole("button", { name: /Ajouter un chèque à ce bordereau/ });
    expect(actions).toHaveLength(2);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un chèque à ce bordereau REM-2/ }));
    const visibles = lignes();
    expect(champs(visibles[visibles.length - 1])[1].value).toBe("REM-2");
  });

  it("ne propose plus d'action de création de nouveau bordereau", () => {
    deuxBordereaux();
    expect(screen.queryByRole("button", { name: /Commencer un nouveau bordereau/ })).toBeNull();
    expect(screen.queryByText(/garde sa date, son n° et sa banque/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Nouveau bordereau/ })).toBeNull();
  });

  it("un bordereau dont la dernière ligne attend son chèque ne reçoit pas une ligne vide de plus", () => {
    renderGrid("bordereaux_remise_cheques");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    const l0 = champs(lignes()[0]);
    fireEvent.change(l0[1], { target: { value: "REM-1" } });
    fireEvent.change(l0[MONTANT_BORDEREAU], { target: { value: "1000" } });
    fireEvent.change(l0[MONTANT], { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un chèque à ce bordereau REM-1/ }));
    expect(lignes()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un chèque à ce bordereau REM-1/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un chèque à ce bordereau REM-1/ }));
    expect(lignes()).toHaveLength(2);
    expect(document.activeElement).toBe(champs(lignes()[1])[NUM_CHEQUE]);
  });

  it("les bordereaux de traites parlent de traites", () => {
    renderGrid("bordereaux_traites_recues");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    const l0 = champs(lignes()[0]);
    fireEvent.change(l0[1], { target: { value: "T1" } });
    fireEvent.change(l0[MONTANT_BORDEREAU], { target: { value: "900" } });
    fireEvent.change(l0[MONTANT], { target: { value: "400" } });
    expect(screen.queryByRole("button", { name: "Ajouter une traite" })).toBeNull();
    expect(screen.getByRole("button", { name: /Ajouter une traite à ce bordereau T1/ })).toBeTruthy();
  });
});

describe("CollecteGrid : montant du bordereau dépassé (faute de frappe)", () => {
  const MONTANT_BORDEREAU = 2;
  const MONTANT = 6;

  it("permet d'enregistrer même quand le total des chèques dépasse le montant du bordereau", async () => {
    const { ref, onSave } = renderGrid("bordereaux_remise_cheques");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    const l0 = champs(lignes()[0]);
    fireEvent.change(l0[1], { target: { value: "3339" } });
    fireEvent.change(l0[MONTANT_BORDEREAU], { target: { value: "6660" } });
    fireEvent.change(l0[MONTANT], { target: { value: "40000" } });
    expect(ref.current?.isComplete()).toBe(false);
    expect(ref.current?.ecart()).toEqual({ manque: false, depasse: true });
    expect((screen.getByRole("button", { name: /Enregistrer/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0][0].data).toMatchObject({ num_bordereau: "3339", montant_cheque: 40000 });
  });

  it("distingue un montant pas encore atteint d'un montant dépassé", () => {
    const { ref } = renderGrid("bordereaux_remise_cheques");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    const l0 = champs(lignes()[0]);
    fireEvent.change(l0[1], { target: { value: "A" } });
    fireEvent.change(l0[MONTANT_BORDEREAU], { target: { value: "1000" } });
    fireEvent.change(l0[MONTANT], { target: { value: "400" } });
    expect(ref.current?.ecart()).toEqual({ manque: true, depasse: false });
    fireEvent.change(l0[MONTANT], { target: { value: "1000" } });
    expect(ref.current?.ecart()).toEqual({ manque: false, depasse: false });
  });
});
