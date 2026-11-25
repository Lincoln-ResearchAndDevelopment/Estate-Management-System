import { describe, expect, it } from "vitest";
import { formatDate, formatNaira, titleCase } from "./format";
import { buildQuery, toFormData } from "./api";

describe("format", () => {
  it("formats naira in full and compact forms (FR-GEN-12)", () => {
    expect(formatNaira("45000", { decimals: true })).toBe("₦45,000.00");
    expect(formatNaira(15_200_000, { compact: true })).toBe("₦15.2M");
    expect(formatNaira(null)).toBe("—");
  });

  it("formats dates as 'Oct 24, 2023' in WAT (FR-GEN-11)", () => {
    expect(formatDate("2023-10-24T10:00:00Z")).toBe("Oct 24, 2023");
    expect(formatDate(null)).toBe("—");
  });

  it("title-cases snake_case values", () => {
    expect(titleCase("approval_withdrawn")).toBe("Approval Withdrawn");
  });
});

describe("api helpers", () => {
  it("omits empty query values", () => {
    expect(buildQuery({ q: "", page: 2, status: undefined, type: "rent" })).toBe("?page=2&type=rent");
  });

  it("serialises arrays as key[] and booleans as 1/0 for multipart", () => {
    const form = toFormData({ amenities: ["Parking", "BQ"], negotiable: true, empty: "", skip: null });
    expect(form.getAll("amenities[]")).toEqual(["Parking", "BQ"]);
    expect(form.get("negotiable")).toBe("1");
    expect(form.has("empty")).toBe(false);
    expect(form.has("skip")).toBe(false);
  });
});
