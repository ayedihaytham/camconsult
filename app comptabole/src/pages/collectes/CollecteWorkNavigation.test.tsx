// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CollecteFull, SectionStatut } from "@/types";
import { CollecteWorkNavigation } from "./CollecteWorkNavigation";

afterEach(cleanup);

const section = (onglet: string, statut: SectionStatut, recapStatut = "none") => ({ id: onglet, onglet, statut, recapStatut }) as never;
const collecte = (statuts: Record<string, SectionStatut>, recap: string[] = []) =>
  ({
    id: "c1",
    periode: "2026",
    statut: "brouillon",
    onglets: Object.keys(statuts),
    sections: Object.entries(statuts).map(([k, v]) => section(k, v, recap.includes(k) ? "envoye" : "none")),
    lignes: [],
    notes: [],
    fichiers: [],
  }) as unknown as CollecteFull;

function rendre(c: CollecteFull, isClient: boolean, active = "recap") {
  const onSelect = vi.fn();
  render(
    <CollecteWorkNavigation
      collecte={c}
      active={active}
      isClient={isClient}
      canSeeHistory={!isClient}
      missingByTable={new Map()}
      visibleMissing={() => false}
      recapCount={0}
      onSelect={onSelect}
    />,
  );
  return { onSelect, nav: screen.getByRole("navigation", { name: "Sections du dossier" }) };
}

const noms = (nav: HTMLElement) => within(nav).getAllByRole("button").map((b) => b.textContent ?? "");

describe("navigation de la collecte pour le responsable de société", () => {
  const c = collecte({
    bordereaux_remise_cheques: "brouillon",
    etat_cheques_emis: "brouillon",
    virements_recus: "a_corriger",
    traites_emises: "transmis",
    chiffre_affaires: "valide",
    etat_caisse: "archive",
  });

  it("n'offre que le Récap et ce qu'il a à compléter ou à corriger", () => {
    const { nav } = rendre(c, true);
    const liste = noms(nav);
    expect(liste.some((n) => n.startsWith("Récap"))).toBe(true);
    expect(liste.some((n) => n.startsWith("Bordereaux remise de chèques"))).toBe(true);
    expect(liste.some((n) => n.startsWith("Virements reçus"))).toBe(true);
    for (const absent of ["Checklist", "Documents", "Historique", "État des chèques émis", "État de caisse"]) {
      expect(liste.some((n) => n.startsWith(absent))).toBe(false);
    }
  });

  it("range ce qui est déjà parti chez le cabinet à part, en consultation", () => {
    const { nav } = rendre(c, true);
    expect(within(nav).getByText("Déjà transmis au cabinet")).toBeTruthy();
    const liste = noms(nav);
    expect(liste.some((n) => n.startsWith("Traites émises") || n.startsWith("État des traites émises"))).toBe(true);
    expect(liste.some((n) => n.startsWith("Chiffre d'affaires"))).toBe(true);
  });

  it("affiche le nom de chaque tableau, y compris ceux qui sont à compléter (le texte ne doit pas disparaître)", () => {
    const { nav } = rendre(c, true);
    for (const nom of ["Bordereaux remise de chèques", "Virements reçus"]) {
      const bouton = within(nav).getByRole("button", { name: new RegExp(nom) });
      expect(bouton.className).not.toContain("text-warning-foreground");
      expect(within(bouton).getByText(nom).textContent).toBe(nom);
    }
    expect(within(nav).getByRole("button", { name: /Bordereaux remise de chèques/ }).textContent).toContain("À compléter");
    expect(within(nav).getByRole("button", { name: /Virements reçus/ }).textContent).toContain("À reprendre");
  });

  it("garde un tableau dans « à compléter » tant que le cabinet attend une réponse du récap, même transmis", () => {
    const { nav } = rendre(collecte({ virements_recus: "transmis" }, ["virements_recus"]), true);
    expect(within(nav).queryByText("Déjà transmis au cabinet")).toBeNull();
    expect(noms(nav).some((n) => n.startsWith("Virements reçus"))).toBe(true);
  });

  it("dit qu'il n'y a rien à compléter quand tout est parti", () => {
    rendre(collecte({ virements_recus: "valide" }), true);
    expect(screen.getByText("Rien à compléter pour le moment.")).toBeTruthy();
  });

  it("ouvre le tableau choisi", () => {
    const { nav, onSelect } = rendre(c, true);
    fireEvent.click(within(nav).getByRole("button", { name: /Virements reçus/ }));
    expect(onSelect).toHaveBeenCalledWith("virements_recus");
  });
});

describe("navigation de la collecte pour le cabinet", () => {
  it("garde la checklist, les documents, l'historique et tous les tableaux", () => {
    const { nav } = rendre(collecte({ bordereaux_remise_cheques: "brouillon", etat_cheques_emis: "brouillon", etat_caisse: "archive" }), false);
    const liste = noms(nav);
    for (const present of ["Checklist", "Récap", "Documents", "Historique", "État des chèques émis", "État de caisse"]) {
      expect(liste.some((n) => n.startsWith(present))).toBe(true);
    }
  });
});
