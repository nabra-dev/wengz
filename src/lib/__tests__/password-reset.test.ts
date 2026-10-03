import {
  buildPasswordResetUrl,
  getPasswordResetBaseUrl,
  hashPasswordResetToken,
  generatePasswordResetToken,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/password-reset";
import { PASSWORD_MIN_LENGTH, passwordSchema } from "@/lib/validations";

describe("password reset helpers", () => {
  const originalNextAuthUrl = process.env.NEXTAUTH_URL;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalNextAuthUrl;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
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

  it("requires an absolute base URL for reset links", () => {
    delete process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getPasswordResetBaseUrl()).toBe("");
    expect(() => buildPasswordResetUrl("en", "tok")).toThrow(/NEXTAUTH_URL|NEXT_PUBLIC_APP_URL/);
  });

  it("uses a one-hour TTL", () => {
    expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000);
  });
});

describe("passwordSchema", () => {
  it(`requires at least ${PASSWORD_MIN_LENGTH} non-whitespace characters`, () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("        ").success).toBe(false);
    expect(passwordSchema.safeParse("longenough").success).toBe(true);
    expect(passwordSchema.parse("  paddedok  ")).toBe("paddedok");
  });
});
