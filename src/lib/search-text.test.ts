import { describe, expect, it } from "vitest";

import { matchesPatientSearch, normalizeSearchText } from "@/lib/search-text";

describe("search-text", () => {
  it("normaliza acentos", () => {
    expect(normalizeSearchText("José")).toBe("jose");
  });

  it("encontra paciente por nome sem acento", () => {
    expect(matchesPatientSearch("José Silva", null, "jose")).toBe(true);
  });

  it("encontra paciente por CPF parcial sem máscara", () => {
    expect(matchesPatientSearch("Maria", "12345678900", "123.456")).toBe(true);
  });

  it("retorna todos quando query vazia", () => {
    expect(matchesPatientSearch("Maria", "123", "")).toBe(true);
  });
});
