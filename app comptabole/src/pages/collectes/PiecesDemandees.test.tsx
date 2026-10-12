// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PiecesDemandees } from "./PiecesDemandees";
import type { CollecteFull } from "@/types";

afterEach(cleanup);

const collecte = {
  id: "c1",
  fichiers: [{ id: "f1", onglet: "", nom: "releve.pdf", format: "pdf", taille: "1 Ko", deposePar: "Client", demandeId: "d2", creeLe: new Date().toISOString() }],
  demandesPieces: [
    { id: "d1", texte: "Relevé bancaire d'octobre", demandePar: "Chaima", statut: "en_attente", fourniePar: "", fournieLe: null, creeLe: new Date().toISOString() },
    { id: "d2", texte: "Facture 2100001269", demandePar: "Chaima", statut: "fournie", fourniePar: "Client", fournieLe: new Date().toISOString(), creeLe: new Date().toISOString() },
  ],
} as unknown as CollecteFull;

const props = { onDemander: vi.fn().mockResolvedValue(undefined), onSupprimer: vi.fn().mockResolvedValue(undefined), onFournir: vi.fn().mockResolvedValue(undefined), onPreview: vi.fn() };

describe("PiecesDemandees", () => {
  it("le cabinet envoie une demande avec une note, sans pièce jointe", async () => {
    render(<PiecesDemandees collecte={collecte} isClient={false} peutDemander {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Demander une pièce/ }));
    const envoyer = screen.getByRole("button", { name: /Envoyer la demande/ }) as HTMLButtonElement;
    expect(envoyer.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Pièce demandée"), { target: { value: "Contrat de bail" } });
    fireEvent.click(envoyer);
    await waitFor(() => expect(props.onDemander).toHaveBeenCalledWith("Contrat de bail"));
  });

  it("le client lit la note et peut ajouter le document ; la pièce fournie reste consultable", () => {
    render(<PiecesDemandees collecte={collecte} isClient peutDemander={false} {...props} />);
    expect(screen.getByText("Relevé bancaire d'octobre")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ajouter le document/ })).toBeTruthy();
    expect(screen.getByText("releve.pdf")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Demander une pièce/ })).toBeNull();
  });
});
