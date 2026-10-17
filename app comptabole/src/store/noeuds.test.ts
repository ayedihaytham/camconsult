import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Noeud } from "@/types";

// Serveur simulé : aucune requête réseau.
const serveur = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({ ...(await original<typeof import("@/lib/api")>()), api: { ...(await original<typeof import("@/lib/api")>()).api, get: serveur.get, post: serveur.post } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { useData } from "./data";

const noeud = (id: string, extra: Partial<Noeud> = {}) => ({ id, libelle: id, description: "", type: "fichier", societeId: "s1", parentId: null, majLe: "2026-10-16", creeLe: "2026-10-16", ...extra }) as Noeud;

beforeEach(() => {
  useData.setState({ noeuds: [noeud("a")] });
  serveur.get.mockReset();
  serveur.post.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("synchronisation de la structuration", () => {
  it("refreshNoeuds remplace la liste par celle du serveur (ajout, retrait, déplacement faits ailleurs)", async () => {
    serveur.get.mockResolvedValue([noeud("b"), noeud("c", { parentId: "b" })]);
    await useData.getState().refreshNoeuds();
    expect(serveur.get).toHaveBeenCalledWith("/noeuds");
    expect(useData.getState().noeuds.map((n) => n.id)).toEqual(["b", "c"]);
  });

  it("des signaux rapprochés sont regroupés : une lecture en cours, plus une seule relecture ensuite", async () => {
    let finir: (v: Noeud[]) => void = () => undefined;
    serveur.get.mockImplementationOnce(() => new Promise<Noeud[]>((r) => (finir = r)));
    serveur.get.mockResolvedValueOnce([noeud("z")]);
    const premier = useData.getState().refreshNoeuds();
    void useData.getState().refreshNoeuds();
    void useData.getState().refreshNoeuds();
    expect(serveur.get).toHaveBeenCalledTimes(1);
    finir([noeud("y")]);
    await premier;
    expect(serveur.get).toHaveBeenCalledTimes(2);
    expect(useData.getState().noeuds.map((n) => n.id)).toEqual(["z"]);
  });

  it("un échec réseau ne vide pas l'écran et ne bloque pas les relectures suivantes", async () => {
    serveur.get.mockRejectedValueOnce(new Error("réseau"));
    await useData.getState().refreshNoeuds();
    expect(useData.getState().noeuds.map((n) => n.id)).toEqual(["a"]);
    serveur.get.mockResolvedValueOnce([noeud("b")]);
    await useData.getState().refreshNoeuds();
    expect(useData.getState().noeuds.map((n) => n.id)).toEqual(["b"]);
  });

  it("addNoeud ajoute le nœud rendu par le serveur sans doublon si le signal temps réel l'a déjà apporté", async () => {
    serveur.post.mockImplementation(async () => {
      useData.setState({ noeuds: [noeud("a"), noeud("n1", { libelle: "déjà là" })] }); // la relecture a gagné la course
      return noeud("n1");
    });
    const cree = await useData.getState().addNoeud({ libelle: "f.pdf", description: "", type: "fichier", societeId: "s1", parentId: null });
    expect(cree.id).toBe("n1");
    expect(useData.getState().noeuds.filter((n) => n.id === "n1")).toHaveLength(1);
  });

  it("addNoeud : en cas de refus du serveur, rien n'est ajouté et l'erreur remonte (pas de faux « ajouté »)", async () => {
    serveur.post.mockRejectedValue(new Error("refusé"));
    await expect(useData.getState().addNoeud({ libelle: "f.pdf", description: "", type: "fichier", societeId: "s1", parentId: null })).rejects.toThrow();
    expect(useData.getState().noeuds.map((n) => n.id)).toEqual(["a"]);
  });
});
