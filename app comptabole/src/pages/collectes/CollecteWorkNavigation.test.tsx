// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
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

function rendre(c: CollecteFull, isClient: boolean, active = "recap", options: Partial<ComponentProps<typeof CollecteWorkNavigation>> = {}) {
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
      {...options}
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

  it("propose uniquement le choix d'un tableau, même si des droits cabinet sont passés par erreur", () => {
    const { nav } = rendre(c, true, "virements_recus", { canSeeRecap: true, canVerify: true, canSeeHistory: true });
    expect(within(nav).queryAllByRole("button")).toHaveLength(0);
    expect(within(nav).getByRole("combobox", { name: "Choisir un tableau" })).toBeTruthy();
    for (const absent of ["Récap", "Checklist", "Documents", "Vérification", "Historique"]) {
      expect(within(nav).queryByText(absent)).toBeNull();
    }
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

  it("indique le tableau courant et son état sans ouvrir le sélecteur", () => {
    const { nav } = rendre(c, true, "virements_recus");
    const selecteur = within(nav).getByRole("combobox", { name: "Choisir un tableau" });
    expect(selecteur.textContent).toContain("Virements reçus");
    expect(selecteur.textContent).toContain("À reprendre");
    expect(selecteur.getAttribute("aria-current")).toBe("page");
  });

  it("n'expose pas un tableau non demandé lorsqu'il est passé comme section active", () => {
    const { nav } = rendre(c, true, "virements_emis", {
      missingByTable: new Map([["virements_emis", 4]]),
      visibleMissing: () => true,
    });
    expect(nav.textContent).not.toContain("Virements émis");
    expect(nav.textContent).not.toContain("4 cases");
    expect(within(nav).getByRole("combobox").textContent).toContain("Choisir un tableau");
  });

  it("explique l'attente lorsqu'aucun tableau n'a encore été envoyé par le cabinet", () => {
    const { nav } = rendre(collecte({ virements_recus: "brouillon", etat_cheques_emis: "brouillon" }), true);
    expect(within(nav).getByText("Aucun tableau demandé pour le moment.")).toBeTruthy();
    expect(within(nav).queryByRole("combobox")).toBeNull();
    expect(within(nav).queryAllByRole("button")).toHaveLength(0);
  });
});

describe("navigation de la collecte pour le cabinet", () => {
  it("garde la checklist, les documents, l'historique et tous les tableaux", () => {
    const { nav } = rendre(collecte({ bordereaux_remise_cheques: "brouillon", etat_cheques_emis: "brouillon", etat_caisse: "archive" }), false);
    const boutons = within(nav).getAllByRole("button").map((b) => b.textContent ?? "");
    expect(boutons).toEqual(["Récap", "Checklist", "Documents", "Historique"]);
    const liste = tableauxProposes(nav);
    for (const present of ["Bordereaux remise de chèques", "État des chèques émis", "État de caisse"]) expect(liste.some((n) => n.startsWith(present))).toBe(true);
  });

  it("ne donne pas accès au Récap à un collaborateur", () => {
    const { nav, onSelect } = rendre(collecte({ virements_recus: "brouillon" }), false, "checklist", { canSeeRecap: false });
    expect(within(nav).queryByRole("button", { name: "Récap" })).toBeNull();
    const checklist = within(nav).getByRole("button", { name: "Checklist" });
    expect(checklist.getAttribute("aria-current")).toBe("page");
    fireEvent.click(within(nav).getByRole("button", { name: "Documents" }));
    expect(onSelect).toHaveBeenCalledWith("documents");
  });

  it("groupe les tableaux par famille et permet de choisir directement un tableau", () => {
    const { nav, onSelect } = rendre(collecte({ bordereaux_remise_cheques: "brouillon", virements_recus: "transmis", etat_caisse: "archive" }), false);
    tableauxProposes(nav);
    expect(screen.getByRole("group", { name: "Chèques" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Virements" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Archives" })).toBeTruthy();
    const option = screen.getByRole("option", { name: /Virements reçus/ });
    expect(option.textContent).toContain("À examiner");
    fireEvent.keyDown(option, { key: "Enter", code: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("virements_recus");
  });

  it("affiche les cases manquantes uniquement lorsque leur visibilité est autorisée", () => {
    const c = collecte({ virements_recus: "brouillon" });
    const { nav } = rendre(c, false, "virements_recus", {
      missingByTable: new Map([["virements_recus", 2]]),
      visibleMissing: () => true,
    });
    expect(within(nav).getByRole("combobox").textContent).toContain("2 cases à compléter");
    cleanup();
    const masque = rendre(c, false, "virements_recus", {
      missingByTable: new Map([["virements_recus", 2]]),
      visibleMissing: () => false,
    });
    expect(within(masque.nav).getByRole("combobox").textContent).not.toContain("2 cases");
  });

  it("annonce le statut réel avec les cases manquantes dans le tableau courant et les options", () => {
    const { nav } = rendre(collecte({ virements_recus: "transmis" }), false, "virements_recus", {
      missingByTable: new Map([["virements_recus", 2]]),
      visibleMissing: () => true,
    });
    const selecteur = within(nav).getByRole("combobox", { name: "Choisir un tableau" });
    const description = document.getElementById(selecteur.getAttribute("aria-describedby")!);
    expect(description?.textContent).toContain("Transmis au cabinet");
    expect(description?.textContent).toContain("2 cases à compléter");
    tableauxProposes(nav);
    expect(screen.getByRole("option", { name: /Virements reçus.*Transmis au cabinet.*2 à compléter/ })).toBeTruthy();
  });

  it("annonce une seule fois le statut lorsqu'il est déjà écrit dans le libellé", () => {
    const { nav } = rendre(collecte({ virements_recus: "valide" }), false, "virements_recus");
    const selecteur = within(nav).getByRole("combobox", { name: "Choisir un tableau" });
    expect(selecteur.textContent?.match(/Validé/g)).toHaveLength(1);
    tableauxProposes(nav);
    expect(screen.getByRole("option", { name: /Virements reçus/ }).textContent?.match(/Validé/g)).toHaveLength(1);
  });
});
