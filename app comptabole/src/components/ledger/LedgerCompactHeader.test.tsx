// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LedgerCompactHeader } from "./LedgerCompactHeader";

afterEach(cleanup);

describe("compteurs du bandeau", () => {
  it("un compteur-filtre se sélectionne au clic et au clavier, et signale celui qui est actif", () => {
    const onActives = vi.fn();
    render(
      <LedgerCompactHeader
        eyebrow="Clients"
        title="Sociétés"
        metrics={[
          { label: "Sociétés", value: 5, active: true, onSelect: vi.fn() },
          { label: "Actives", value: 3, onSelect: onActives },
          { label: "Détail", value: "info" },
        ]}
      />,
    );
    const actives = screen.getByRole("button", { name: /Actives/ });
    expect(screen.getByRole("button", { name: /Sociétés/ }).getAttribute("aria-pressed")).toBe("true");
    expect(actives.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(actives);
    fireEvent.keyDown(actives, { key: "Enter" });
    expect(onActives).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: /Détail/ })).toBeNull();
  });
});
