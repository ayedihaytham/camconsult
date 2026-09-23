import { describe, expect, it } from "vitest";
import { tacheFormSchema } from "./TacheFormSheet";

const valid = {
  titre: "Contrôler la déclaration TVA",
  description: "",
  societeId: "17a832e9-76a4-46bc-860d-b056509a6b30",
  assigneId: "__none__",
};

describe("TacheFormSheet validation", () => {
  it("rejects a title made of whitespace", () => {
    expect(tacheFormSchema.safeParse({ ...valid, titre: "    " }).success).toBe(false);
  });

  it("trims a valid title before submission", () => {
    expect(tacheFormSchema.parse({ ...valid, titre: "  Contrôler la TVA  " }).titre).toBe("Contrôler la TVA");
  });
});
