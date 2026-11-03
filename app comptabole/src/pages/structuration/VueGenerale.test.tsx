// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Noeud } from "@/types";
import { VueGenerale } from "./VueGenerale";

afterEach(cleanup);
beforeAll(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() });
});

const noeud = (id: string, libelle: string, type: "dossier" | "fichier", parentId: string | null, extra: Partial<Noeud> = {}): Noeud =>
  ({ id, libelle, type, parentId, description: "", societeId: "s1", format: type === "fichier" ? "pdf" : undefined, taille: type === "fichier" ? "10 Ko" : undefined, creeLe: "2026-01-10T08:00:00Z", majLe: "2026-01-10T08:00:00Z", ...extra }) as unknown as Noeud;

const NODES = [
  noeud("r", "01-RUSPINA", "dossier", null),
  noeud("c", "Comptabilité générale 2026", "dossier", "r"),
  noeud("a", "achat", "dossier", "c"),
  noeud("v", "vente", "dossier", "c"),
  noeud("b", "banque", "dossier", "c"),
  noeud("bs", "BTK", "dossier", "b"),
  noeud("bz", "ZITOUNA", "dossier", "b"),
  noeud("f1", "FA-0012.pdf", "fichier", "a", { majLe: "2026-02-01T08:00:00Z" }),
  noeud("f2", "FA-0013.pdf", "fichier", "a", { majLe: "2026-03-01T08:00:00Z" }),
  noeud("f3", "releve-btk.pdf", "fichier", "bs"),
  noeud("f4", "releve-zit.pdf", "fichier", "bz"),
  noeud("f5", "releve-zit-2.pdf", "fichier", "bz"),
];

function afficher(props: Partial<React.ComponentProps<typeof VueGenerale>> = {}) {
  const onOpenNode = vi.fn();
  render(<VueGenerale nodes={NODES} roots={[NODES[0]]} getSocieteById={() => null} onOpenNode={onOpenNode} actions={<button type="button">Ajouter une arborescence</button>} {...props} />);
  return { onOpenNode };
}

describe("vue générale : onglets de tiroirs et tableau", () => {
  it("un onglet par tiroir avec son nombre de fichiers ; les fichiers des sous-dossiers comptent pour leur tiroir", () => {
    afficher();
    const onglets = within(screen.getByRole("tablist", { name: "Tiroirs de Comptabilité générale 2026" }));
    expect(onglets.getByRole("tab", { name: "Tiroir achat, 2 fichiers" })).toBeTruthy();
    expect(onglets.getByRole("tab", { name: "Tiroir vente, 0 fichier" })).toBeTruthy();
    expect(onglets.getByRole("tab", { name: "Tiroir banque, 3 fichiers" })).toBeTruthy();
    expect(screen.getByText(/2 tiroirs remplis sur 3 · 5 fichiers/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajouter une arborescence" })).toBeTruthy();
  });

  it("à l'ouverture, le premier tiroir rempli est choisi : ses fichiers, du plus récent au plus ancien ; un autre onglet se choisit d'un clic", () => {
    afficher();
    const achat = screen.getByRole("tab", { name: "Tiroir achat, 2 fichiers" });
    expect(achat.getAttribute("aria-selected")).toBe("true");
    const contenu = within(screen.getByRole("region", { name: "Contenu du tiroir achat" }));
    expect(contenu.getAllByText(/FA-001/).map((n) => n.textContent)).toEqual(["FA-0013.pdf", "FA-0012.pdf"]);
    const banque = screen.getByRole("tab", { name: "Tiroir banque, 3 fichiers" });
    fireEvent.click(banque);
    expect(banque.getAttribute("aria-selected")).toBe("true");
    expect(achat.getAttribute("aria-selected")).toBe("false");
    expect(screen.queryByRole("region", { name: "Contenu du tiroir achat" })).toBeNull();
    expect(screen.getByRole("region", { name: "Contenu du tiroir banque" })).toBeTruthy();
  });

  it("le tableau se trie par nom ou par date de dépôt, dans les deux sens", () => {
    afficher();
    const contenu = within(screen.getByRole("region", { name: "Contenu du tiroir achat" }));
    fireEvent.click(contenu.getByRole("button", { name: /Nom/ }));
    expect(contenu.getAllByText(/FA-001/).map((n) => n.textContent)).toEqual(["FA-0012.pdf", "FA-0013.pdf"]);
    fireEvent.click(contenu.getByRole("button", { name: /Nom/ }));
    expect(contenu.getAllByText(/FA-001/).map((n) => n.textContent)).toEqual(["FA-0013.pdf", "FA-0012.pdf"]);
    expect(contenu.getByRole("columnheader", { name: /Nom/ }).getAttribute("aria-sort")).toBe("descending");
  });

  it("les sous-dossiers d'un tiroir sont des dossiers suspendus qui filtrent ses fichiers", () => {
    afficher();
    fireEvent.click(screen.getByRole("tab", { name: "Tiroir banque, 3 fichiers" }));
    const contenu = within(screen.getByRole("region", { name: "Contenu du tiroir banque" }));
    expect(contenu.getAllByText(/releve/)).toHaveLength(3);
    fireEvent.click(contenu.getByRole("button", { name: /ZITOUNA/ }));
    expect(contenu.getAllByText(/releve/)).toHaveLength(2);
    fireEvent.click(contenu.getByRole("button", { name: /BTK/ }));
    expect(contenu.getAllByText(/releve/)).toHaveLength(1);
    // un autre tiroir repart de « Tous »
    fireEvent.click(screen.getByRole("tab", { name: "Tiroir achat, 2 fichiers" }));
    fireEvent.click(screen.getByRole("tab", { name: "Tiroir banque, 3 fichiers" }));
    expect(within(screen.getByRole("region", { name: "Contenu du tiroir banque" })).getAllByText(/releve/)).toHaveLength(3);
  });

  it("un tiroir vide dit qu'il est vide ; Ouvrir dans Documents (bouton ou double clic) ouvre le dossier, et « Ouvrir l'armoire » le dossier d'année", () => {
    const { onOpenNode } = afficher();
    fireEvent.click(screen.getByRole("tab", { name: "Tiroir vente, 0 fichier" }));
    const contenu = within(screen.getByRole("region", { name: "Contenu du tiroir vente" }));
    expect(contenu.getByText(/Ce tiroir est vide/)).toBeTruthy();
    fireEvent.click(contenu.getByRole("button", { name: /Ouvrir dans Documents/ }));
    expect(onOpenNode).toHaveBeenCalledWith(NODES[3]);
    fireEvent.doubleClick(screen.getByRole("tab", { name: "Tiroir banque, 3 fichiers" }));
    expect(onOpenNode).toHaveBeenLastCalledWith(NODES[4]);
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'armoire" }));
    expect(onOpenNode).toHaveBeenLastCalledWith(NODES[1]);
  });

  it("la recherche met en évidence les tiroirs qui contiennent le fichier et estompe les autres", () => {
    afficher();
    fireEvent.change(screen.getByLabelText("Chercher un fichier"), { target: { value: "zit" } });
    expect(screen.getByRole("tab", { name: /Tiroir banque/ }).getAttribute("data-etat")).toBe("trouve");
    expect(screen.getByRole("tab", { name: /Tiroir achat/ }).getAttribute("data-etat")).toBe("estompe");
    fireEvent.change(screen.getByLabelText("Chercher un fichier"), { target: { value: "" } });
    expect(screen.getByRole("tab", { name: /Tiroir banque/ }).getAttribute("data-etat")).toBeNull();
  });

  it("le dépôt (bouton ou fichiers glissés sur le tableau ou sur un onglet) n'est proposé que si la session peut déposer", () => {
    afficher();
    expect(screen.queryByRole("button", { name: "Déposer dans achat" })).toBeNull();
    cleanup();

    const onDeposer = vi.fn();
    afficher({ onDeposer });
    fireEvent.click(screen.getByRole("button", { name: "Déposer dans achat" }));
    expect(onDeposer).toHaveBeenCalledWith(NODES[2]);
    const fichier = new File(["x"], "nouveau.pdf", { type: "application/pdf" });
    fireEvent.drop(screen.getByRole("tab", { name: "Tiroir vente, 0 fichier" }), { dataTransfer: { files: [fichier], types: ["Files"] } });
    expect(onDeposer).toHaveBeenLastCalledWith(NODES[3], [fichier]);
    fireEvent.drop(screen.getByRole("region", { name: "Contenu du tiroir achat" }), { dataTransfer: { files: [fichier], types: ["Files"] } });
    expect(onDeposer).toHaveBeenLastCalledWith(NODES[2], [fichier]);
  });

  it("un clic sur la ligne d'un fichier ouvre son aperçu", () => {
    const onPreview = vi.fn();
    afficher({ onPreview });
    fireEvent.click(screen.getByRole("button", { name: "Aperçu de FA-0012.pdf" }));
    expect(onPreview).toHaveBeenCalledWith(NODES[7]);
  });
});

describe("vue générale : tiroir très rempli", () => {
  it("montre 25 fichiers par page, avec Précédent / Suivant, sans jamais déborder avec un long nom de dossier", () => {
    const beaucoup = [
      noeud("r", "01-RUSPINA", "dossier", null),
      noeud("c", "Comptabilité générale 2026", "dossier", "r"),
      noeud("v", "vente", "dossier", "c"),
      noeud("vs", "achatventesteruspinaimportexportmois052026", "dossier", "v"),
      ...Array.from({ length: 30 }, (_, i) => noeud(`f${i}`, `FAC ${100 + i}.pdf`, "fichier", "vs", { majLe: `2026-03-${String(i + 1).padStart(2, "0")}T08:00:00Z` })),
    ];
    render(<VueGenerale nodes={beaucoup} roots={[beaucoup[0]]} getSocieteById={() => null} onOpenNode={vi.fn()} onDeposer={vi.fn()} actions={null} />);
    const contenu = within(screen.getByRole("region", { name: "Contenu du tiroir vente" }));
    expect(contenu.getAllByText(/^FAC \d+\.pdf$/)).toHaveLength(25);
    expect(contenu.getByText("1–25 sur 30")).toBeTruthy();
    expect((contenu.getByRole("button", { name: /Précédent/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(contenu.getByRole("button", { name: /Suivant/ }));
    expect(contenu.getAllByText(/^FAC \d+\.pdf$/)).toHaveLength(5);
    expect(contenu.getByText("26–30 sur 30")).toBeTruthy();
    expect((contenu.getByRole("button", { name: /Suivant/ }) as HTMLButtonElement).disabled).toBe(true);
    // les noms longs sont tronqués (jamais de débordement) et restent lisibles au survol
    fireEvent.click(contenu.getByRole("button", { name: /Précédent/ }));
    expect(contenu.getAllByTitle("achatventesteruspinaimportexportmois052026").filter((el) => el.tagName === "TD")).toHaveLength(25);
  });
});

describe("vue générale : plusieurs armoires", () => {
  const deux = [
    noeud("r", "01-RUSPINA", "dossier", null),
    noeud("t", "Apurement TVA 2026", "dossier", "r"),
    noeud("t1", "T1", "dossier", "t"),
    noeud("c", "Comptabilité générale 2026", "dossier", "r"),
    noeud("a", "achat", "dossier", "c"),
    noeud("f1", "FA-0012.pdf", "fichier", "a"),
  ];
  it("n'affiche qu'une armoire à la fois : d'abord celle qui contient des fichiers, puis celle que l'on choisit", () => {
    render(<VueGenerale nodes={deux} roots={[deux[0]]} getSocieteById={() => null} onOpenNode={vi.fn()} actions={null} />);
    const armoires = within(screen.getByRole("tablist", { name: "Armoires de la société" }));
    expect(armoires.getByRole("tab", { name: /Comptabilité générale 2026\s*1/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("region", { name: "Armoire Comptabilité générale 2026" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Armoire Apurement TVA 2026" })).toBeNull();
    fireEvent.click(armoires.getByRole("tab", { name: /Apurement TVA 2026\s*0/ }));
    expect(screen.getByRole("region", { name: "Armoire Apurement TVA 2026" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Armoire Comptabilité générale 2026" })).toBeNull();
  });

  it("avec une seule armoire, aucun sélecteur", () => {
    afficher();
    expect(screen.queryByRole("tablist", { name: "Armoires de la société" })).toBeNull();
  });
});
