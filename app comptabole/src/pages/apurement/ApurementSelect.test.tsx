// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ApurementSelect } from "./ApurementSelect";

const options = [
  { value: "", label: "À affecter (brouillon)" },
  { value: "bc-1", label: "BC-001" },
  { value: "new", label: "+ Créer un bon de commande ici" },
];
beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});
async function choose(name: string) {
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  const item = await screen.findByRole("option", { name });
  fireEvent.keyDown(item, { key: "Enter" });
}

it("submits the selected ID, supports inline creation and clears an optional assignment without a sentinel in FormData", async () => {
  const changed = vi.fn();
  const { container } = render(
    <form>
      <ApurementSelect
        name="bcId"
        aria-label="Bon de commande"
        options={options}
        onValueChange={changed}
      />
    </form>,
  );
  const form = container.querySelector("form")!;
  expect(new FormData(form).get("bcId")).toBe("");
  await choose("BC-001");
  await waitFor(() => expect(new FormData(form).get("bcId")).toBe("bc-1"));
  await choose("+ Créer un bon de commande ici");
  await waitFor(() => expect(new FormData(form).get("bcId")).toBe("new"));
  await choose("À affecter (brouillon)");
  await waitFor(() => expect(new FormData(form).get("bcId")).toBe(""));
  expect(changed.mock.calls.map(([value]) => value)).toEqual([
    "bc-1",
    "new",
    "",
  ]);
});

it("preserves native required validation and default values, and prevents changing disabled controls", async () => {
  const { container, rerender } = render(
    <form>
      <ApurementSelect
        name="autorisationId"
        aria-label="Autorisation"
        required
        options={options}
      />
    </form>,
  );
  const form = container.querySelector("form")!;
  expect(form.checkValidity()).toBe(false);
  await choose("BC-001");
  await waitFor(() => expect(form.checkValidity()).toBe(true));
  await choose("À affecter (brouillon)");
  await waitFor(() => expect(form.checkValidity()).toBe(false));
  rerender(
    <form>
      <ApurementSelect
        key="status"
        name="statutInterne"
        aria-label="Statut"
        defaultValue="active"
        disabled
        options={[{ value: "active", label: "Active" }]}
      />
    </form>,
  );
  expect((screen.getByRole("combobox") as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(new FormData(form).has("statutInterne")).toBe(false);
  expect(container.querySelector("select")?.value).toBe("active");
});
