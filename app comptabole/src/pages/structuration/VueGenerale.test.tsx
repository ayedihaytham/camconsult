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

describe("vue générale : armoire de classement", () => {
  it("montre l'armoire de l'année avec un tiroir par dossier, son nombre de fichiers et les chiffres de l'armoire", () => {
    afficher();
    const armoire = within(screen.getByRole("region", { name: "Armoire Comptabilité générale 2026" }));
    expect(armoire.getByRole("button", { name: "Tiroir achat, 2 fichiers" })).toBeTruthy();
    expect(armoire.getByRole("button", { name: "Tiroir vente, 0 fichier" })).toBeTruthy();
    // les fichiers des sous-dossiers comptent pour leur tiroir
    expect(armoire.getByRole("button", { name: "Tiroir banque, 3 fichiers" })).toBeTruthy();
    const chiffres = within(armoire.getByLabelText("Chiffres de l'armoire"));
    expect(chiffres.getByText("Tiroirs").nextElementSibling?.textContent).toBe("3");
    expect(chiffres.getByText("Fichiers").nextElementSibling?.textContent).toBe("5");
    expect(chiffres.getByText("Remplis").nextElementSibling?.textContent).toBe("2");
    expect(chiffres.getByText("Vides").nextElementSibling?.textContent).toBe("1");
    expect(screen.getByRole("button", { name: "Ajouter une arborescence" })).toBeTruthy();
  });

  it("un clic ouvre le tiroir : ses fichiers, du plus récent au plus ancien ; un second clic le referme", () => {
    afficher();
    const tiroir = screen.getByRole("button", { name: "Tiroir achat, 2 fichiers" });
    expect(tiroir.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(tiroir);
    expect(tiroir.getAttribute("aria-expanded")).toBe("true");
    const contenu = within(screen.getByRole("region", { name: "Contenu du tiroir achat" }));
    expect(contenu.getAllByText(/FA-001/).map((n) => n.textContent)).toEqual(["FA-0013.pdf", "FA-0012.pdf"]);
    fireEvent.click(tiroir);
    expect(screen.queryByRole("region", { name: "Contenu du tiroir achat" })).toBeNull();
  });

  it("les sous-dossiers d'un tiroir sont des dossiers suspendus qui filtrent ses fichiers", () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: "Tiroir banque, 3 fichiers" }));
    const contenu = within(screen.getByRole("region", { name: "Contenu du tiroir banque" }));
    expect(contenu.getAllByText(/releve/)).toHaveLength(3);
    fireEvent.click(contenu.getByRole("button", { name: /ZITOUNA/ }));
    expect(contenu.getAllByText(/releve/)).toHaveLength(2);
    fireEvent.click(contenu.getByRole("button", { name: /BTK/ }));
    expect(contenu.getAllByText(/releve/)).toHaveLength(1);
  });

  it("un tiroir vide dit qu'il est vide ; Ouvrir dans Documents ouvre le dossier", () => {
    const { onOpenNode } = afficher();
    fireEvent.click(screen.getByRole("button", { name: "Tiroir vente, 0 fichier" }));
    const contenu = within(screen.getByRole("region", { name: "Contenu du tiroir vente" }));
    expect(contenu.getByText(/Ce tiroir est vide/)).toBeTruthy();
    fireEvent.click(contenu.getByRole("button", { name: /Ouvrir dans Documents/ }));
    expect(onOpenNode).toHaveBeenCalledWith(NODES[3]);
  });

  it("la recherche met en évidence les tiroirs qui contiennent le fichier et estompe les autres", () => {
    afficher();
    fireEvent.change(screen.getByLabelText("Chercher un fichier"), { target: { value: "zit" } });
    expect(screen.getByRole("button", { name: /Tiroir banque/ }).className).toContain("tiroir--trouve");
    expect(screen.getByRole("button", { name: /Tiroir achat/ }).className).toContain("tiroir--estompe");
  });

  it("le dépôt (clic ou fichiers glissés) n'est proposé que si la session peut déposer", () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: "Tiroir achat, 2 fichiers" }));
    expect(screen.queryByRole("button", { name: "Déposer dans achat" })).toBeNull();
    cleanup();

    const onDeposer = vi.fn();
    afficher({ onDeposer });
    fireEvent.click(screen.getByRole("button", { name: "Tiroir achat, 2 fichiers" }));
    fireEvent.click(screen.getByRole("button", { name: "Déposer dans achat" }));
    expect(onDeposer).toHaveBeenCalledWith(NODES[2]);
    const fichier = new File(["x"], "nouveau.pdf", { type: "application/pdf" });
    fireEvent.drop(screen.getByRole("button", { name: "Tiroir vente, 0 fichier" }), { dataTransfer: { files: [fichier], types: ["Files"] } });
    expect(onDeposer).toHaveBeenLastCalledWith(NODES[3], [fichier]);
  });

  it("un clic sur la fiche d'un fichier ouvre son aperçu", () => {
    const onPreview = vi.fn();
    afficher({ onPreview });
    fireEvent.click(screen.getByRole("button", { name: "Tiroir achat, 2 fichiers" }));
    fireEvent.click(screen.getByRole("button", { name: "Aperçu de FA-0012.pdf" }));
    expect(onPreview).toHaveBeenCalledWith(NODES[7]);
  });
});
