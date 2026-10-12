// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet";

afterEach(cleanup);

/** Un clic ou un appui à côté de la carte. */
function cliquerAilleurs() {
  fireEvent.pointerDown(document.body);
  fireEvent.mouseDown(document.body);
  fireEvent.pointerUp(document.body);
  fireEvent.click(document.body);
}

describe("cartes et volets", () => {
  it("une carte ne se ferme pas par un clic à côté, seulement par sa croix", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Carte</DialogTitle>
          <DialogDescription>Contenu</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    cliquerAilleurs();
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("un volet ne se ferme pas par un clic à côté, seulement par sa croix", () => {
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetTitle>Volet</SheetTitle>
          <SheetDescription>Contenu</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    cliquerAilleurs();
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
