import { describe, expect, it } from "vitest";
import { mustResetPassword } from "./password-reset";

describe("mustResetPassword", () => {
  it("returns true when metadata flag is set", () => {
    expect(
      mustResetPassword({
        id: "u1",
        app_metadata: {},
        user_metadata: { must_reset_password: true },
        aud: "authenticated",
        created_at: "",
      }),
    ).toBe(true);
  });

  it("returns false when flag is absent or false", () => {
    expect(mustResetPassword(null)).toBe(false);
    expect(
      mustResetPassword({
        id: "u1",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: "",
      }),
    ).toBe(false);
    expect(
      mustResetPassword({
        id: "u1",
        app_metadata: {},
        user_metadata: { must_reset_password: false },
        aud: "authenticated",
        created_at: "",
      }),
    ).toBe(false);
  });
});
