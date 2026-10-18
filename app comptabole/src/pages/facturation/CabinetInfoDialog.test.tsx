// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FactureCabinet } from "@/types";
import { CabinetInfoDialog, composerAdresse } from "./CabinetInfoDialog";

// Données SYNTHÉTIQUES uniquement.
const cabinet: FactureCabinet = {
  nom: "CABINET EXEMPLE",
  raisonSociale: "CABINET EXEMPLE SARL",
  adresse: "Sfax",
  matriculeFiscal: "1234567ABM000",
  telephone: "71 000 000",
  email: "contact@cabinet-exemple.tn",
  rib: "04 123 0123456789012 45",
  mentions: "",
  rue: "12 rue du Lac",
  ville: "Tunis",
  codePostal: "1053",
  pays: "TN",
  rc: "B0123452026",
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const monter = (c: FactureCabinet | null = cabinet, onSave = vi.fn().mockResolvedValue(undefined)) => {
  render(<CabinetInfoDialog open onOpenChange={vi.fn()} cabinet={c} onSave={onSave} />);
  return onSave;
};
const apercu = () => screen.getByTitle("Aperçu de la facture avec l'identité du cabinet") as HTMLIFrameElement;
const attendreApercu = async () => {
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  return apercu().getAttribute("srcdoc") ?? "";
};

describe("CabinetInfoDialog", () => {
  it("composerAdresse : adresse en une ligne à partir de l'adresse structurée, sinon l'ancienne adresse", () => {
    expect(composerAdresse({ rue: "12 rue du Lac", ville: "Tunis", codePostal: "1053", adresse: "ancienne" })).toBe("12 rue du Lac, 1053 Tunis");
    expect(composerAdresse({ rue: "", ville: "Sfax", codePostal: "", adresse: "ancienne" })).toBe("Sfax");
    expect(composerAdresse({ rue: "", ville: "", codePostal: "", adresse: "ancienne" })).toBe("ancienne");
  });

  it("formulaire en sections, valeurs reprises, liste de contrôle complète quand tout est renseigné", () => {
    monter();
    expect(screen.getByText("Informations du cabinet")).toBeTruthy();
    for (const titre of ["Identité fiscale", "Adresse", "Contact et règlement", "Pied de page"]) expect(screen.getByText(titre)).toBeTruthy();
    expect((screen.getByLabelText("Raison sociale") as HTMLInputElement).value).toBe("CABINET EXEMPLE SARL");
    expect(screen.getByText("Matricule fiscal valide", { selector: "span.inline-flex" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Toutes les informations nécessaires sont renseignées.");
  });

  it("matricule fiscal : message de validation en direct et liste de contrôle qui s'en ressent", () => {
    monter();
    const champ = screen.getByLabelText("Matricule fiscal") as HTMLInputElement;
    expect(screen.getByText("Matricule fiscal valide.")).toBeTruthy();
    fireEvent.change(champ, { target: { value: "123" } });
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByText("Matricule fiscal valide.")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("1 information à compléter pour la facture électronique.");
  });

  it("ancienne adresse en une ligne reprise comme rue pour ne pas être perdue ; vide : informations à compléter", () => {
    monter({ ...cabinet, rue: "", ville: "", codePostal: "", adresse: "Sfax", rib: "" });
    expect((screen.getByLabelText("Rue") as HTMLInputElement).value).toBe("Sfax");
    expect(screen.getByRole("status").textContent).toBe("2 informations à compléter pour la facture électronique.");
  });

  it("aperçu de la facture : miniature inerte qui suit la saisie (nom, matricule, RIB, mentions)", async () => {
    monter();
    expect(apercu().getAttribute("sandbox")).toBe(""); // aucun script, aucune interaction
    let html = await attendreApercu();
    expect(html).toContain("CABINET EXEMPLE SARL");
    expect(html).toContain("12 rue du Lac, 1053 Tunis");
    fireEvent.change(screen.getByLabelText("Raison sociale"), { target: { value: "NOUVEAU NOM SARL" } });
    fireEvent.change(screen.getByLabelText("Mentions"), { target: { value: "Capital 20 000 DT — mention de test" } });
    html = await attendreApercu();
    expect(html).toContain("NOUVEAU NOM SARL");
    expect(html).toContain("Capital 20 000 DT — mention de test");
    expect(html).toContain("04 123 0123456789012 45");
    expect(html).toContain("SOCIÉTÉ EXEMPLE SARL"); // la facture montrée est un exemple, jamais une vraie facture
  });

  it("enregistre avec l'adresse recomposée à partir de la rue, du code postal et de la ville", async () => {
    const onSave = monter();
    fireEvent.change(screen.getByLabelText("Ville"), { target: { value: "Sousse" } });
    fireEvent.change(screen.getByLabelText("Code postal"), { target: { value: "4000" } });
    fireEvent.change(screen.getByLabelText("Pays"), { target: { value: "tn" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({ rue: "12 rue du Lac", ville: "Sousse", codePostal: "4000", pays: "TN", adresse: "12 rue du Lac, 4000 Sousse", matriculeFiscal: "1234567ABM000" });
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("nom");
  });
});
