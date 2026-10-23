// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SimulationPaiePage } from "./SimulationPaiePage";

afterEach(cleanup);

function ouvrir() {
  render(<SimulationPaiePage />);
  fireEvent.change(screen.getByLabelText("Mois de paie"), { target: { value: "2026-10" } });
}

describe("SimulationPaiePage", () => {
  it("du brut au net : retrouve le cas de référence (base 1 000 + transport 77,847)", () => {
    ouvrir();
    fireEvent.change(screen.getByLabelText("Salaire de base (DT)"), { target: { value: "1000" } });
    const resultat = screen.getByRole("region", { name: "Résultat" });
    expect(resultat.textContent).toContain("895,923");
    expect(resultat.textContent).toContain("73,207");
    expect(resultat.textContent).toContain("4,381");
  });

  it("du net au brut : donne le salaire de base à prévoir", () => {
    ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Du net au brut" }));
    fireEvent.change(screen.getByLabelText("Net à payer souhaité (DT)"), { target: { value: "1500" } });
    const texte = (screen.getByRole("region", { name: "Résultat" }).textContent ?? "").replace(/\s/g, " ");
    expect(texte).toContain("1 871,474 DT");
  });

  it("signale l'absence de barème avant 2022", () => {
    ouvrir();
    fireEvent.change(screen.getByLabelText("Mois de paie"), { target: { value: "2021-05" } });
    expect(screen.getByRole("alert").textContent).toMatch(/Aucun barème/);
  });
});
