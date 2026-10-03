import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  finalizePasswordReset,
  findValidPasswordResetToken,
  getPasswordResetBaseUrl,
  hashPasswordResetToken,
  generatePasswordResetToken,
  PASSWORD_RESET_TTL_MS,
  persistPasswordChange,
} from "@/lib/password-reset";
import {
  PASSWORD_MIN_LENGTH,
  loginFormSchema,
  passwordSchema,
  registerFormSchema,
} from "@/lib/validations";

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

describe("passwordSchema and form schemas", () => {
  it(`requires at least ${PASSWORD_MIN_LENGTH} non-whitespace characters`, () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("        ").success).toBe(false);
    expect(passwordSchema.safeParse("longenough").success).toBe(true);
    expect(passwordSchema.parse("  paddedok  ")).toBe("paddedok");
  });

  it("loginFormSchema normalizes email and allows any non-empty password", () => {
    const ok = loginFormSchema.safeParse({ email: "  A@B.COM ", password: "x" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe("a@b.com");
    expect(loginFormSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });

  it("registerFormSchema enforces password policy and match", () => {
    expect(
      registerFormSchema.safeParse({
        name: "Ada",
        email: "ada@example.com",
        password: "short",
        confirmPassword: "short",
      }).success
    ).toBe(false);
    expect(
      registerFormSchema.safeParse({
        name: "Ada",
        email: "ada@example.com",
        password: "longenough",
        confirmPassword: "different1",
      }).success
    ).toBe(false);
    const ok = registerFormSchema.safeParse({
      name: "Ada",
      email: "Ada@Example.com",
      password: "longenough",
      confirmPassword: "longenough",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe("ada@example.com");
  });
});

describe("password reset token DB helpers", () => {
  function mockDb(overrides: Record<string, unknown> = {}) {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockResolvedValue({});
    const findUnique = jest.fn();
    const userUpdate = jest.fn().mockResolvedValue({});
    const sessionDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const tx = {
      passwordResetToken: { updateMany, create, findUnique },
      user: { update: userUpdate },
      session: { deleteMany: sessionDeleteMany },
    };
    const db = {
      passwordResetToken: { updateMany, create, findUnique },
      user: { update: userUpdate },
      session: { deleteMany: sessionDeleteMany },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === "function") {
          return (arg as (t: typeof tx) => Promise<unknown>)(tx);
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
      ...overrides,
    };
    return { db: db as never, updateMany, create, findUnique, userUpdate, sessionDeleteMany };
  }

  it("createPasswordResetToken invalidates prior unused tokens", async () => {
    const { db, updateMany, create } = mockDb();
    const { rawToken, expiresAt } = await createPasswordResetToken(db, "user-1");
    expect(rawToken).toHaveLength(64);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", usedAt: null },
      })
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          tokenHash: hashPasswordResetToken(rawToken),
        }),
      })
    );
  });

  it("findValidPasswordResetToken rejects used or expired rows", async () => {
    const { db, findUnique } = mockDb();
    findUnique.mockResolvedValueOnce(null);
    expect(await findValidPasswordResetToken(db, "missing")).toBeNull();

    findUnique.mockResolvedValueOnce({
      id: "t1",
      userId: "u1",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await findValidPasswordResetToken(db, "used")).toBeNull();

    findUnique.mockResolvedValueOnce({
      id: "t2",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await findValidPasswordResetToken(db, "expired")).toBeNull();

    findUnique.mockResolvedValueOnce({
      id: "t3",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(findValidPasswordResetToken(db, "ok")).resolves.toEqual({
      id: "t3",
      userId: "u1",
    });
  });

  it("finalizePasswordReset consumes token and updates password in one transaction", async () => {
    const { db, updateMany, userUpdate, sessionDeleteMany } = mockDb();
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const ok = await finalizePasswordReset(db, "token-1", "user-1", "hashed");
    expect(ok).toBe(true);
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ password: "hashed", passwordChangedAt: expect.any(Date) }),
      })
    );
    expect(sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("finalizePasswordReset returns false when token already used", async () => {
    const { db, updateMany, userUpdate } = mockDb();
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(finalizePasswordReset(db, "token-1", "user-1", "hashed")).resolves.toBe(false);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("persistPasswordChange bumps passwordChangedAt and clears sessions", async () => {
    const { db, userUpdate, sessionDeleteMany } = mockDb();
    const at = await persistPasswordChange(db, "user-1", "hashed");
    expect(at).toBeInstanceOf(Date);
    expect(userUpdate).toHaveBeenCalled();
    expect(sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});
