// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useHonoraires } from "@/store/honoraires";
import type { HonoraireLigne, HonoraireRecapClient } from "@/types";
import { HonoraireRecapCard } from "./HonoraireRecapCard";
import { HonorairesRecapPage } from "./HonorairesRecapPage";

const ligne = (patch: Partial<HonoraireLigne>): HonoraireLigne => ({
  id: "l",
  societeId: "s",
  ordre: 1,
  type: "mensuelle",
  nature: "",
  periode: "",
  libelle: "",
  cnss: "",
  numQuittance: "",
  montantDeclaration: 0,
  honoraire: 0,
  reglement: 0,
  dateReglement: null,
  note: "",
  pieceNom: "",
  pieceFormat: "",
  pieceTaille: "",
  aPiece: false,
  total: 0,
  solde: 0,
  creeLe: "2026-02-01T10:00:00Z",
  majLe: "",
  ...patch,
});

describe("récapitulatif d'une société", () => {
  afterEach(cleanup);
  const list = [
    ligne({ id: "1", libelle: "DMI avril 2026", montantDeclaration: 30, honoraire: 30, reglement: 30.333, dateReglement: "2026-05-03" }),
    ligne({ id: "2", type: "trimestrielle", libelle: "T4 2025", montantDeclaration: 100, honoraire: 50 }),
  ];

  it("affiche les chiffres clés et le solde dû", () => {
    render(<HonoraireRecapCard list={list} />);
    const carte = within(screen.getByLabelText("Récapitulatif du compte client"));
    expect(carte.getByText("Déclarations à reverser")).toBeTruthy();
    expect(carte.getByText("Solde dû").nextElementSibling?.textContent).toBe("179,667");
    expect(carte.getByText("03/05/2026")).toBeTruthy();
  });

  it("détaille par type puis par année", () => {
    render(<HonoraireRecapCard list={list} />);
    expect(screen.getByText("Mensuelle")).toBeTruthy();
    expect(screen.getByText("Trimestrielle")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Par année" }));
    expect(screen.getByText("2026")).toBeTruthy();
    expect(screen.getByText("2025")).toBeTruthy();
    expect(screen.queryByText("Mensuelle")).toBeNull();
  });

  it("gère un compte sans ligne", () => {
    render(<HonoraireRecapCard list={[]} />);
    expect(screen.getByText("Aucune ligne à récapituler.")).toBeTruthy();
  });
});

describe("récapitulatif de tous les clients", () => {
  afterEach(() => {
    cleanup();
    useHonoraires.setState({ recap: [] });
  });

  const client = (patch: Partial<HonoraireRecapClient>): HonoraireRecapClient => ({
    societeId: "s",
    raisonSociale: "A",
    code: "",
    statut: "actif",
    nbLignes: 1,
    declare: 0,
    honoraires: 0,
    total: 0,
    reglements: 0,
    solde: 0,
    dernierReglement: null,
    ...patch,
  });

  function afficher(recap: HonoraireRecapClient[]) {
    useHonoraires.setState({ recap, fetchRecap: vi.fn().mockResolvedValue(undefined) });
    render(
      <MemoryRouter initialEntries={["/honoraires"]}>
        <Routes>
          <Route path="/honoraires" element={<HonorairesRecapPage />} />
          <Route path="/honoraires/:id" element={<p>Compte de la société ouvert</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  const recap = [
    client({ societeId: "1", raisonSociale: "05-I CARGO LINE", total: 400, reglements: 400, solde: 0 }),
    client({ societeId: "2", raisonSociale: "01-RUSPINA", declare: 130, honoraires: 80, total: 210, reglements: 30.333, solde: 179.667, dernierReglement: "2026-05-03" }),
    client({ societeId: "3", raisonSociale: "03-ACME", total: 50, solde: 50 }),
  ];

  it("liste les clients, le plus gros solde dû d'abord, avec un total", () => {
    afficher(recap);
    const lignes = screen.getAllByRole("row").slice(1, -1);
    expect(lignes.map((r) => within(r).getByRole("button").textContent)).toEqual(["01-RUSPINA", "03-ACME", "05-I CARGO LINE"]);
    expect(screen.getByText("Total (3)")).toBeTruthy();
    expect(within(screen.getAllByRole("row").at(-1) as HTMLElement).getByText("229,667")).toBeTruthy();
  });

  it("ne garde que les clients avec solde dû sur demande", () => {
    afficher(recap);
    fireEvent.click(screen.getByLabelText("Avec solde dû seulement"));
    expect(screen.queryByText("05-I CARGO LINE")).toBeNull();
    expect(screen.getByText("01-RUSPINA")).toBeTruthy();
    expect(screen.getByText("Total (2)")).toBeTruthy();
  });

  it("recherche une société", () => {
    afficher(recap);
    fireEvent.change(screen.getByLabelText("Rechercher une société"), { target: { value: "cargo" } });
    expect(screen.getByText("05-I CARGO LINE")).toBeTruthy();
    expect(screen.queryByText("01-RUSPINA")).toBeNull();
  });

  it("ouvre le compte d'une société au clic sur sa ligne", () => {
    afficher(recap);
    fireEvent.click(screen.getByText("01-RUSPINA"));
    expect(screen.getByText("Compte de la société ouvert")).toBeTruthy();
  });
});
