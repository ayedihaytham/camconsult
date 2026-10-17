import { describe, it, expect } from "vitest";
import { inputRate, displayRate, inputTnd, tnd } from "./apurement";
describe("Apurement financial entry", () => {
  it("converts percentage rates exactly without exposing bps in the form", () => {
    for (const [input, bps] of [
      ["19", 1900],
      ["19.5", 1950],
      ["0,01", 1],
      ["100", 10000],
    ] as const) {
      expect(inputRate(input)).toBe(bps);
      expect(inputRate(displayRate(bps))).toBe(bps);
    }
    for (const invalid of ["19.001", "101", "-19", "1e2"])
      expect(() => inputRate(invalid)).toThrow();
  });
  it("keeps large exact values and rejects silent precision loss", () => {
    expect(inputTnd("9007199254740.993")).toBe("9007199254740993");
    expect(tnd("1")).toContain(",001");
    expect(() => inputTnd("1.0001")).toThrow();
  });
});
