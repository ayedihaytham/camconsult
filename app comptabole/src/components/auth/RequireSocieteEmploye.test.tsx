// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { RequireSocieteEmploye } from "./RequireSocieteEmploye";

afterEach(cleanup);

function monter(poste: string | undefined) {
  useAuth.setState({ session: { poste, role: poste === "societe_employe" ? "employe" : "admin" } as never });
  render(
    <MemoryRouter initialEntries={["/ma-souche"]}>
      <Routes>
        <Route element={<RequireSocieteEmploye />}>
          <Route path="/ma-souche" element={<p>Souche du client</p>} />
        </Route>
        <Route path="/" element={<p>Accueil</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Ma souche : réservée au compte de société", () => {
  it("laisse entrer le responsable ou délégué de société", () => {
    monter("societe_employe");
    expect(screen.getByText("Souche du client")).toBeTruthy();
  });
  it("renvoie l'équipe du cabinet à l'accueil", () => {
    monter("collaborateur");
    expect(screen.getByText("Accueil")).toBeTruthy();
  });
});
