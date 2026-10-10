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
      canVerify={false}
      canSeeHistory={!isClient}
      missingByTable={new Map()}
      visibleMissing={() => false}
      recapCount={0}
      onSelect={onSelect}
    />,
  );
  return { onSelect, nav: screen.getByRole("navigation", { name: "Sections du dossier" }) };
}

/** Ouvre le sélecteur de tableaux et renvoie le texte de chaque tableau proposé. */
function tableauxProposes(nav: HTMLElement): string[] {
  fireEvent.keyDown(within(nav).getByRole("combobox", { name: "Choisir un tableau" }), { key: "Enter", code: "Enter" });
  return screen.queryAllByRole("option").map((o) => o.textContent ?? "");
}

describe("navigation de la collecte pour le responsable de société", () => {
  const c = collecte(
    {
      bordereaux_remise_cheques: "brouillon",
      etat_cheques_emis: "brouillon",
      virements_recus: "a_corriger",
      virements_emis: "brouillon",
      traites_emises: "transmis",
      chiffre_affaires: "valide",
      etat_caisse: "archive",
    },
    ["bordereaux_remise_cheques"],
  );

  it("n'a ni Checklist, ni Documents, ni Historique : seulement le Récap et le choix d'un tableau", () => {
    const { nav } = rendre(c, true);
    const boutons = within(nav).getAllByRole("button").map((b) => b.textContent ?? "");
    expect(boutons.some((n) => n.startsWith("Récap"))).toBe(true);
    for (const absent of ["Checklist", "Documents", "Historique"]) expect(boutons.some((n) => n.startsWith(absent))).toBe(false);
  });

  it("ne propose que les tableaux demandés par le cabinet (envoyés ou renvoyés) et ceux déjà transmis", () => {
    const { nav } = rendre(c, true);
    const liste = tableauxProposes(nav);
    expect(liste.some((n) => n.startsWith("Bordereaux remise de chèques"))).toBe(true); // envoyé par le récap
    expect(liste.some((n) => n.startsWith("Virements reçus"))).toBe(true); // renvoyé pour correction
    expect(liste.some((n) => /^(État des )?traites émises/i.test(n))).toBe(true); // déjà transmis
    expect(liste.some((n) => n.startsWith("Chiffre d'affaires"))).toBe(true); // validé
    // Dans la collecte mais jamais envoyé, tenu par le cabinet, archivé : invisibles.
    for (const absent of ["Virements émis", "État des chèques émis", "État de caisse"]) {
      expect(liste.some((n) => n.startsWith(absent))).toBe(false);
    }
  });

  it("ne montre qu'un seul tableau quand le cabinet n'en a envoyé qu'un", () => {
    const { nav } = rendre(collecte({ souche_cheques: "brouillon", virements_recus: "brouillon", traites_emises: "brouillon" }, ["virements_recus"]), true);
    const liste = tableauxProposes(nav);
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatch(/^Virements reçus/);
  });

  it("n'écrit pas ses indications en couleur « warning-foreground », illisible sur fond blanc", () => {
    const { nav } = rendre(c, true);
    fireEvent.keyDown(within(nav).getByRole("combobox", { name: "Choisir un tableau" }), { key: "Enter", code: "Enter" });
    expect(document.body.innerHTML).not.toContain("text-warning-foreground");
  });
});

describe("navigation de la collecte pour le cabinet", () => {
  it("garde la checklist, les documents, l'historique et tous les tableaux", () => {
    const { nav } = rendre(collecte({ bordereaux_remise_cheques: "brouillon", etat_cheques_emis: "brouillon", etat_caisse: "archive" }), false);
    const boutons = within(nav).getAllByRole("button").map((b) => b.textContent ?? "");
    for (const present of ["Checklist", "Récap", "Documents", "Historique"]) expect(boutons.some((n) => n.startsWith(present))).toBe(true);
    const liste = tableauxProposes(nav);
    for (const present of ["Bordereaux remise de chèques", "État des chèques émis", "État de caisse"]) expect(liste.some((n) => n.startsWith(present))).toBe(true);
  });
});
