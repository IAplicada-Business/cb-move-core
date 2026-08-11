import { describe, expect, it } from "vitest";
import { hasGoogleIdentity, mustResetPassword } from "./password-reset";

const baseUser = {
  id: "u1",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "",
};

describe("mustResetPassword", () => {
  it("returns true when metadata flag is set", () => {
    expect(
      mustResetPassword({
        ...baseUser,
        user_metadata: { must_reset_password: true },
      }),
    ).toBe(true);
  });

  it("returns false when flag is absent or false", () => {
    expect(mustResetPassword(null)).toBe(false);
    expect(mustResetPassword({ ...baseUser, user_metadata: {} })).toBe(false);
    expect(
      mustResetPassword({
        ...baseUser,
        user_metadata: { must_reset_password: false },
      }),
    ).toBe(false);
  });

  it("ignora must_reset quando login Google está vinculado", () => {
    expect(
      mustResetPassword({
        ...baseUser,
        app_metadata: { providers: ["email", "google"] },
        user_metadata: { must_reset_password: true },
        identities: [{ provider: "google", id: "g1" }],
      }),
    ).toBe(false);
  });
});

describe("hasGoogleIdentity", () => {
  it("detecta provider google em app_metadata ou identities", () => {
    expect(
      hasGoogleIdentity({
        ...baseUser,
        app_metadata: { providers: ["google"] },
      }),
    ).toBe(true);
    expect(
      hasGoogleIdentity({
        ...baseUser,
        identities: [{ provider: "google", id: "g1" }],
      }),
    ).toBe(true);
    expect(hasGoogleIdentity({ ...baseUser, app_metadata: { providers: ["email"] } })).toBe(false);
  });
});
