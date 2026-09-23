import { describe, expect, it } from "vitest";
import { getOperationalPageSize } from "./useOperationalPageSize";

describe("operational register page size", () => {
  it("uses six rows on short desktop viewports", () => {
    expect(getOperationalPageSize(10, true)).toBe(6);
    expect(getOperationalPageSize(8, true)).toBe(6);
  });

  it("preserves the register's normal page size otherwise", () => {
    expect(getOperationalPageSize(10, false)).toBe(10);
    expect(getOperationalPageSize(8, false)).toBe(8);
  });
});
