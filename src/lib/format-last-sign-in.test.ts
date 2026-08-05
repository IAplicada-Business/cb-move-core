import { describe, expect, it } from "vitest";

import { formatLastSignIn } from "./format";

describe("formatLastSignIn", () => {
  it("retorna traço quando vazio", () => {
    expect(formatLastSignIn(null)).toBe("—");
    expect(formatLastSignIn(undefined)).toBe("—");
  });

  it("retorna Hoje para login no dia corrente em São Paulo", () => {
    const now = new Date();
    expect(formatLastSignIn(now.toISOString())).toBe("Hoje");
  });

  it("retorna Ontem para login no dia anterior", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatLastSignIn(yesterday.toISOString())).toBe("Ontem");
  });

  it("retorna data formatada para logins mais antigos", () => {
    expect(formatLastSignIn("2026-01-15T15:00:00.000Z")).toMatch(/\d{2}\/\d{2}\/\d{2}/);
  });
});
