import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  __esModule: true,
  usePathname: jest.fn(() => "/ar/provider"),
}));

jest.mock("@/i18n/routing", () => ({
  __esModule: true,
  routing: { locales: ["en", "ar"], defaultLocale: "en" },
  usePathname: () => "/provider",
}));

import { usePathname as useNextPathname } from "next/navigation";
import {
  LanguageSwitcher,
  buildLocaleSwitchPath,
  withLocaleSwitchCacheBust,
  localeFromBrowserPath,
} from "../language-switcher";
import { buildLocaleSwitchApiHref } from "@/lib/locale-switch";

describe("buildLocaleSwitchPath", () => {
  it("strips locale and omits default-locale prefix (as-needed)", () => {
    expect(buildLocaleSwitchPath("/ar/provider", "en")).toBe("/provider");
    expect(buildLocaleSwitchPath("/en/client/requests", "ar")).toBe("/ar/client/requests");
  });

  it("handles paths without a locale prefix", () => {
    expect(buildLocaleSwitchPath("/provider", "ar")).toBe("/ar/provider");
    expect(buildLocaleSwitchPath("/provider", "en")).toBe("/provider");
  });

  it("handles the root path", () => {
    expect(buildLocaleSwitchPath("/", "en")).toBe("/");
    expect(buildLocaleSwitchPath("/", "ar")).toBe("/ar");
    expect(buildLocaleSwitchPath("/ar", "en")).toBe("/");
  });
});

describe("withLocaleSwitchCacheBust", () => {
  it("adds lng query only for default locale", () => {
    expect(withLocaleSwitchCacheBust("/", "en")).toBe("/?lng=en");
    expect(withLocaleSwitchCacheBust("/provider", "en")).toBe("/provider?lng=en");
    expect(withLocaleSwitchCacheBust("/ar", "ar")).toBe("/ar");
  });
});

describe("localeFromBrowserPath", () => {
  it("treats /ar prefix as Arabic and everything else as English", () => {
    expect(localeFromBrowserPath("/ar")).toBe("ar");
    expect(localeFromBrowserPath("/ar/provider")).toBe("ar");
    expect(localeFromBrowserPath("/")).toBe("en");
    expect(localeFromBrowserPath("/provider")).toBe("en");
  });
});

describe("buildLocaleSwitchApiHref", () => {
  it("builds the cookie-setting locale API URL", () => {
    expect(buildLocaleSwitchApiHref("en", "/")).toBe("/api/locale?set=en&next=%2F");
    expect(buildLocaleSwitchApiHref("ar", "/provider")).toBe("/api/locale?set=ar&next=%2Fprovider");
  });
});

describe("LanguageSwitcher", () => {
  it("links through the locale API when switching to English", async () => {
    (useNextPathname as jest.Mock).mockReturnValue("/ar/provider");
    render(<LanguageSwitcher />);
    const link = await screen.findByRole("link", { name: /Switch language to EN/i });
    expect(link).toHaveAttribute("href", "/api/locale?set=en&next=%2Fprovider");
  });

  it("links through the locale API when switching to Arabic", async () => {
    (useNextPathname as jest.Mock).mockReturnValue("/provider");
    render(<LanguageSwitcher />);
    const link = await screen.findByRole("link", { name: /Switch language to AR/i });
    expect(link).toHaveAttribute("href", "/api/locale?set=ar&next=%2Fprovider");
  });
});
