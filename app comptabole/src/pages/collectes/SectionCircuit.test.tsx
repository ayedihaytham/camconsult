// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SectionCircuit } from "./SectionCircuit";
import type { SectionStatut } from "@/types";

afterEach(cleanup);

function rendre(statut: SectionStatut, over: Partial<React.ComponentProps<typeof SectionCircuit>> = {}) {
  const actions = {
    preparerTransfert: vi.fn().mockResolvedValue(""),
    onTransmettre: vi.fn().mockResolvedValue(undefined),
    onValider: vi.fn().mockResolvedValue(undefined),
    onRenvoyer: vi.fn().mockResolvedValue(undefined),
    onArchiver: vi.fn().mockResolvedValue(undefined),
    onDesarchiver: vi.fn().mockResolvedValue(undefined),
  };
  render(<SectionCircuit label="État des chèques émis" statut={statut} motifRenvoi="" isClient={false} canArchive={false} {...actions} {...over} />);
  return actions;
}

const transferer = () => screen.getByRole("button", { name: /Enregistrer et transférer au cabinet/ });

describe("SectionCircuit : côté client", () => {
  it("enregistre puis transfère le tableau complet après confirmation", async () => {
    const a = rendre("brouillon", { isClient: true });
    fireEvent.click(transferer());
    expect(await screen.findByText("Transférer ce tableau au cabinet ?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Transférer" }));
    await waitFor(() => expect(a.onTransmettre).toHaveBeenCalledWith(false));
    expect(a.preparerTransfert).toHaveBeenCalledTimes(1);
  });

  it("autorise le transfert d'un tableau incomplet, en disant ce qui manque", async () => {
    const a = rendre("brouillon", { isClient: true, preparerTransfert: vi.fn().mockResolvedValue("2 cases importantes vides") });
    fireEvent.click(transferer());
    expect(await screen.findByText("Transférer ce tableau incomplet ?")).toBeTruthy();
    expect(screen.getByText(/Il manque encore : 2 cases importantes vides/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Transférer" }));
    await waitFor(() => expect(a.onTransmettre).toHaveBeenCalledWith(true));
  });

  it("ne transfère pas si l'enregistrement du tableau échoue", async () => {
    const a = rendre("brouillon", { isClient: true, preparerTransfert: vi.fn().mockRejectedValue(new Error("échec")) });
    fireEvent.click(transferer());
    await waitFor(() => expect(transferer().hasAttribute("disabled")).toBe(false));
    expect(screen.queryByText(/Transférer ce tableau/)).toBeNull();
    expect(a.onTransmettre).not.toHaveBeenCalled();
  });

  it("affiche ce que le cabinet demande de corriger, et permet de retransférer", () => {
    rendre("a_corriger", { isClient: true, motifRenvoi: "Il manque le chèque 4001" });
    expect(screen.getByText("Renvoyé par le cabinet")).toBeTruthy();
    expect(screen.getByText("Il manque le chèque 4001")).toBeTruthy();
    expect(transferer()).toBeTruthy();
  });

  it("ne propose plus rien une fois le tableau transmis", () => {
    rendre("transmis", { isClient: true });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/ne peut plus être modifié/)).toBeTruthy();
  });
});

describe("SectionCircuit : côté cabinet", () => {
  it("valide un tableau transmis", async () => {
    const a = rendre("transmis");
    fireEvent.click(screen.getByRole("button", { name: "Valider ce tableau" }));
    await waitFor(() => expect(a.onValider).toHaveBeenCalled());
  });

  it("ne renvoie au client qu'avec un motif", async () => {
    const a = rendre("transmis");
    fireEvent.click(screen.getByRole("button", { name: "Renvoyer au client" }));
    const envoyer = async () => (await screen.findAllByRole("button", { name: "Renvoyer au client" })).pop()!;
    expect((await envoyer()).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Motif du renvoi"), { target: { value: "  Chèques de janvier manquants " } });
    fireEvent.click(await envoyer());
    await waitFor(() => expect(a.onRenvoyer).toHaveBeenCalledWith("Chèques de janvier manquants"));
  });

  it("un tableau validé peut être renvoyé ; seul l'admin ou le responsable l'archive", () => {
    rendre("valide");
    expect(screen.getByRole("button", { name: "Renvoyer au client" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Archiver/ })).toBeNull();
    cleanup();
    rendre("valide", { canArchive: true });
    expect(screen.getByRole("button", { name: "Archiver ce tableau" })).toBeTruthy();
  });

  it("propose de désarchiver un tableau archivé à l'admin seulement", () => {
    rendre("archive", { canArchive: true });
    expect(screen.getByRole("button", { name: "Désarchiver" })).toBeTruthy();
    cleanup();
    rendre("archive");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("n'a rien à décider tant que le client n'a pas transféré", () => {
    rendre("brouillon");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/n'a pas encore transféré/)).toBeTruthy();
  });
});
