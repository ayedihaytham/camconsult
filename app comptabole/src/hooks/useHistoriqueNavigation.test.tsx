// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { useHistoriqueNavigation } from "./useHistoriqueNavigation";

// Petit banc d'essai : deux boutons de navigation du hook, plus de quoi changer de page (PUSH / REPLACE).
function Banc() {
  const h = useHistoriqueNavigation();
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={h.reculer} disabled={!h.peutReculer}>reculer</button>
      <button onClick={h.avancer} disabled={!h.peutAvancer}>avancer</button>
      <button onClick={() => navigate("/b")}>aller-b</button>
      <button onClick={() => navigate("/c")}>aller-c</button>
      <button onClick={() => navigate("/d", { replace: true })}>remplacer-d</button>
    </div>
  );
}
const monter = () => render(<MemoryRouter initialEntries={["/a"]}><Banc /></MemoryRouter>);
const etat = (nom: string) => (screen.getByRole("button", { name: nom }) as HTMLButtonElement).disabled;
const clic = (nom: string) => act(() => void fireEvent.click(screen.getByRole("button", { name: nom })));

afterEach(cleanup);

describe("useHistoriqueNavigation", () => {
  it("première page : ni précédent ni suivant", () => {
    monter();
    expect(etat("reculer")).toBe(true);
    expect(etat("avancer")).toBe(true);
  });

  it("nouvelle page : on peut reculer ; après un retour : on peut avancer", () => {
    monter();
    clic("aller-b");
    expect(etat("reculer")).toBe(false);
    expect(etat("avancer")).toBe(true);
    clic("reculer");
    expect(etat("reculer")).toBe(true);
    expect(etat("avancer")).toBe(false);
    clic("avancer");
    expect(etat("reculer")).toBe(false);
    expect(etat("avancer")).toBe(true);
  });

  it("une nouvelle page après un retour supprime les pages « suivantes » (comme le navigateur)", () => {
    monter();
    clic("aller-b");
    clic("reculer");
    expect(etat("avancer")).toBe(false);
    clic("aller-c");
    expect(etat("avancer")).toBe(true); // c est la dernière page : pas de suivante
    expect(etat("reculer")).toBe(false);
    clic("reculer");
    clic("reculer");
    expect(etat("reculer")).toBe(true); // retour sur la première page
    expect(etat("avancer")).toBe(false);
  });

  it("remplacer la page courante ne change rien à la position dans l'historique", () => {
    monter();
    clic("aller-b");
    clic("remplacer-d");
    expect(etat("reculer")).toBe(false);
    expect(etat("avancer")).toBe(true);
    clic("reculer");
    expect(etat("reculer")).toBe(true);
    expect(etat("avancer")).toBe(false);
  });
});
