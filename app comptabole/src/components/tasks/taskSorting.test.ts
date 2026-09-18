import { describe, expect, it } from "vitest";
import type { TacheStatut } from "@/types";
import { compareTaskStatuses } from "./taskSorting";

describe("compareTaskStatuses", () => {
  it("respecte l'ordre métier des statuts", () => {
    const statuses: TacheStatut[] = ["termine", "a_faire", "en_cours"];

    expect(statuses.sort(compareTaskStatuses)).toEqual([
      "a_faire",
      "en_cours",
      "termine",
    ]);
  });
});

