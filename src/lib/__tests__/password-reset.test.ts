import {
  buildPasswordResetUrl,
  hashPasswordResetToken,
  generatePasswordResetToken,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/password-reset";

describe("password reset helpers", () => {
  const originalUrl = process.env.NEXTAUTH_URL;

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalUrl;
  });

  it("hashes tokens consistently and generates unique raw tokens", () => {
    const a = generatePasswordResetToken();
    const b = generatePasswordResetToken();
    expect(a).not.toBe(b);
    expect(hashPasswordResetToken(a)).toBe(hashPasswordResetToken(a));
    expect(hashPasswordResetToken(a)).not.toBe(hashPasswordResetToken(b));
  });

  it("builds a localized reset URL", () => {
    process.env.NEXTAUTH_URL = "https://app.example.com/";
    expect(buildPasswordResetUrl("ar", "abc123")).toBe(
      "https://app.example.com/ar/auth/reset-password?token=abc123"
    );
  });

  it("uses a one-hour TTL", () => {
    expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000);
  });
});
