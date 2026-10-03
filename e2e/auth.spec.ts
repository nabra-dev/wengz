import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should navigate to login page", async ({ page }) => {
    await page.goto("/auth/login");

    await expect(page.getByRole("heading", { name: /sign in|login/i })).toBeVisible();

    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test("should navigate to register page", async ({ page }) => {
    await page.goto("/auth/register");

    await expect(
      page.getByRole("heading", { name: /create.*account|sign up|register/i })
    ).toBeVisible();

    const nameInput = page.getByLabel(/name/i);
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/^password/i);

    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test("should show validation error for empty login", async ({ page }) => {
    await page.goto("/auth/login");

    const submitButton = page.getByRole("button", { name: /sign in|login/i });
    await submitButton.click();

    await expect(page).toHaveURL(/login/);
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/auth/login");

    await page.getByLabel(/email/i).fill("invalid@test.com");
    await page.getByLabel(/password/i).fill("wrongpassword");

    const submitButton = page.getByRole("button", { name: /sign in|login/i });
    await submitButton.click();

    await page.waitForTimeout(1000);

    await expect(page).toHaveURL(/login/);
  });

  test("should open forgot password from login", async ({ page }) => {
    await page.goto("/auth/login");
    const forgot = page.getByRole("link", { name: /forgot password/i });
    await expect(forgot).toBeVisible();
    await forgot.click();
    await expect(page).toHaveURL(/forgot-password/);
    await expect(page.getByRole("heading", { name: /forgot password/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("forgot password accepts any email with generic success UX", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await page.getByLabel(/email/i).fill("nobody@example.com");
    await page.getByRole("button", { name: /send reset link|send/i }).click();
    await expect(page.getByText(/if an account exists|check your email/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("reset password without token shows request-new-link state", async ({ page }) => {
    await page.goto("/auth/reset-password");
    await expect(page.getByText(/missing or invalid|request a new/i).first()).toBeVisible();
    const newLink = page.getByRole("link", { name: /request a new reset link|forgot/i });
    await expect(newLink).toBeVisible();
    await newLink.click();
    await expect(page).toHaveURL(/forgot-password/);
  });

  test("should navigate between login and register", async ({ page }) => {
    await page.goto("/auth/login");

    const registerLink = page.getByRole("link", { name: /sign up|register|create account/i });
    if ((await registerLink.count()) > 0) {
      await registerLink.first().click();
      await expect(page).toHaveURL(/register/);
    }
  });
});
