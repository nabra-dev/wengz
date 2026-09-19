import React from "react";
import { render, screen } from "@testing-library/react";

// Mock locale to Arabic so toggle targets English
jest.mock("next-intl", () => ({
  __esModule: true,
  useLocale: () => "ar",
}));

// Mock i18n navigation hooks
jest.mock("@/i18n/routing", () => ({
  __esModule: true,
  usePathname: () => "/ar/provider",
}));

import { LanguageSwitcher, buildLocaleSwitchPath } from "../language-switcher";

describe("buildLocaleSwitchPath", () => {
  it("strips existing locale before replacing to avoid double prefix", () => {
    expect(buildLocaleSwitchPath("/ar/provider", "en")).toBe("/en/provider");
    expect(buildLocaleSwitchPath("/en/client/requests", "ar")).toBe("/ar/client/requests");
  });

  it("handles paths without a locale prefix", () => {
    expect(buildLocaleSwitchPath("/provider", "ar")).toBe("/ar/provider");
  });

  it("handles the root path", () => {
    expect(buildLocaleSwitchPath("/", "en")).toBe("/en");
    expect(buildLocaleSwitchPath("/ar", "en")).toBe("/en");
  });
});

describe("LanguageSwitcher", () => {
  it("renders a toggle button for the target locale", async () => {
    render(<LanguageSwitcher />);
    const button = await screen.findByRole("button");
    expect(button).toBeInTheDocument();
  });
});
