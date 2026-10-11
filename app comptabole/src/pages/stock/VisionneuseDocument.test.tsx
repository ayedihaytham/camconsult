// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VisionneuseDocument } from "./VisionneuseDocument";

afterEach(cleanup);

const IMAGE = "data:image/png;base64,AAAA";

describe("visionneuse de document", () => {
  it("agrandit, réduit et réajuste une image", () => {
    render(<VisionneuseDocument dataUrl={IMAGE} titre="Facture d'achat" />);
    const image = screen.getByAltText("Facture d'achat") as HTMLImageElement;
    expect(image.style.width).toBe("100%");
    fireEvent.click(screen.getByRole("button", { name: "Agrandir le document" }));
    fireEvent.click(screen.getByRole("button", { name: "Agrandir le document" }));
    expect(image.style.width).toBe("150%");
    expect(screen.getByText("150 %")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ajuster" }));
    expect(image.style.width).toBe("100%");
    fireEvent.click(screen.getByRole("button", { name: "Réduire le document" }));
    expect(image.style.width).toBe("75%");
  });

  it("ne propose pas le zoom pour un PDF, mais le plein écran quand il est demandé", () => {
    const onAgrandir = vi.fn();
    render(<VisionneuseDocument dataUrl="data:application/pdf;base64,AAAA" titre="Facture" onAgrandir={onAgrandir} />);
    expect(screen.queryByRole("button", { name: "Agrandir le document" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Plein écran/ }));
    expect(onAgrandir).toHaveBeenCalled();
  });
});
