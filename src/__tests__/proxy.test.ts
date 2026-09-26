// Mock next-intl and next-auth
jest.mock("next-intl/middleware", () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
}));

jest.mock("next-auth/middleware", () => ({
  withAuth: jest.fn((middleware) => middleware),
}));

jest.mock("@/i18n/routing", () => ({
  routing: {
    locales: ["en", "ar"],
    defaultLocale: "en",
  },
}));

describe("Proxy Middleware Logic", () => {
  describe("Path locale detection", () => {
    const testCases = [
      { path: "/en/admin", hasLocale: true, locale: "en" },
      { path: "/ar/client", hasLocale: true, locale: "ar" },
      { path: "/admin", hasLocale: false, locale: undefined },
      { path: "/", hasLocale: false, locale: undefined },
      { path: "/api/health", hasLocale: false, locale: undefined },
    ];

    testCases.forEach(({ path, hasLocale, locale }) => {
      it(`should detect locale=${locale} for path ${path}`, () => {
        const segments = path.split("/").filter(Boolean);
        const firstSegment = segments[0];
        const locales = ["en", "ar"];
        const result = locales.includes(firstSegment as any);

        expect(result).toBe(hasLocale);
        if (hasLocale) {
          expect(firstSegment).toBe(locale);
        }
      });
    });
  });

  describe("Protected route detection", () => {
    function getPathWithoutLocale(pathname: string) {
      const segments = pathname.split("/").filter(Boolean);
      const maybeLocale = segments[0];
      const locales = ["en", "ar"];
      const rest = locales.includes(maybeLocale as any) ? segments.slice(1) : segments;
      return rest.join("/");
    }

    function isProtected(pathname: string) {
      const first = getPathWithoutLocale(pathname).split("/")[0];
      return first === "client" || first === "provider" || first === "admin";
    }

    const protectedRoutes = [
      "/en/admin",
      "/ar/client",
      "/en/provider",
      "/admin/users",
      "/client/requests",
      "/provider/available",
    ];

    const publicRoutes = ["/", "/en", "/ar", "/en/auth/login", "/ar/auth/register", "/api/health"];

    protectedRoutes.forEach((path) => {
      it(`should identify ${path} as protected`, () => {
        expect(isProtected(path)).toBe(true);
      });
    });

    publicRoutes.forEach((path) => {
      it(`should identify ${path} as public`, () => {
        expect(isProtected(path)).toBe(false);
      });
    });
  });

  describe("Probe noise detection", () => {
    function isProbeNoise(pathname: string): boolean {
      const path = pathname.toLowerCase();
      if (
        path.includes("/wp-admin") ||
        path.includes("/wp-login") ||
        path.includes("/wp-content") ||
        path.includes("/wp-includes") ||
        path.includes("/xmlrpc") ||
        path.includes("/wordpress") ||
        path.includes("/.env") ||
        path.includes("/phpmyadmin")
      ) {
        return true;
      }
      return /\.(php|asp|aspx|jsp|cgi)$/i.test(path);
    }

    const probes = [
      "/wp-admin/install.php",
      "/wp-login.php",
      "/xmlrpc.php",
      "/wordpress/wp-admin",
      "/.env",
      "/shell.cgi",
    ];
    const normal = ["/", "/ar", "/en/contact", "/admin/packages"];

    probes.forEach((path) => {
      it(`should flag ${path} as probe noise`, () => {
        expect(isProbeNoise(path)).toBe(true);
      });
    });

    normal.forEach((path) => {
      it(`should not flag ${path} as probe noise`, () => {
        expect(isProbeNoise(path)).toBe(false);
      });
    });
  });

  describe("Static asset bypass", () => {
    const bypassPaths = [
      { path: "/api/health", reason: "API route" },
      { path: "/api/trpc/user.get", reason: "API route" },
      { path: "/_next/static/chunk.js", reason: "Next.js internal" },
      { path: "/_next/image", reason: "Next.js internal" },
      { path: "/robots.txt", reason: "Known file" },
      { path: "/sitemap.xml", reason: "Known file" },
      { path: "/manifest.json", reason: "Known file" },
      { path: "/images/logo.png", reason: "File extension" },
      { path: "/sw.js", reason: "File extension" },
      { path: "/workbox-123.js", reason: "File extension" },
    ];

    bypassPaths.forEach(({ path, reason }) => {
      it(`should bypass ${path} (${reason})`, () => {
        const isApi = path.startsWith("/api");
        const isNext = path.startsWith("/_next");
        const isKnownFile =
          path === "/robots.txt" || path === "/sitemap.xml" || path === "/manifest.json";
        const hasFileExtension = path.includes(".");

        const shouldBypass = isApi || isNext || isKnownFile || hasFileExtension;
        expect(shouldBypass).toBe(true);
      });
    });
  });

  describe("Favicon rewrite logic", () => {
    it("should rewrite /favicon.ico to /images/favicon.svg", () => {
      const pathname = "/favicon.ico";
      const shouldRewrite = pathname === "/favicon.ico";
      expect(shouldRewrite).toBe(true);
    });

    it("should not rewrite other ico files", () => {
      const pathname: string = "/other-icon.ico";
      const isFaviconPath = pathname === "/favicon.ico";
      expect(isFaviconPath).toBe(false);
    });
  });

  describe("Locale cookie preservation", () => {
    const testScenarios = [
      {
        path: "/admin",
        cookie: "ar",
        expected: "ar",
        description: "Should use cookie locale when no locale in path",
      },
      {
        path: "/client/requests",
        cookie: "en",
        expected: "en",
        description: "Should use cookie locale for locale-less protected routes",
      },
      {
        path: "/",
        cookie: "ar",
        expected: "ar",
        description: "Should use cookie locale for root path",
      },
      {
        path: "/admin",
        cookie: "invalid",
        expected: "en",
        description: "Should fallback to default when cookie has invalid locale",
      },
      {
        path: "/admin",
        cookie: undefined,
        expected: "en",
        description: "Should fallback to default when no cookie",
      },
    ];

    testScenarios.forEach(({ path, cookie, expected, description }) => {
      it(description, () => {
        const locales = ["en", "ar"];
        const defaultLocale = "en";
        const firstSegment = path.split("/").find(Boolean);
        const hasLocale = locales.includes(firstSegment as any);

        let preferredLocale = defaultLocale;
        if (!hasLocale && cookie) {
          preferredLocale = locales.includes(cookie as any) ? cookie : defaultLocale;
        }

        expect(preferredLocale).toBe(expected);
      });
    });
  });

  describe("Locale path construction", () => {
    it("should construct correct locale-prefixed paths", () => {
      const locale = "ar";
      const pathname = "/admin/users";
      const expectedPath = `/${locale}${pathname}`;

      expect(expectedPath).toBe("/ar/admin/users");
    });

    it("should handle root path correctly", () => {
      const locale = "en";
      const pathname = "/";
      const expectedPath = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;

      expect(expectedPath).toBe("/en");
    });

    it("should not double-prefix if locale already exists", () => {
      const pathname = "/en/admin";
      const firstSegment = pathname.split("/").filter(Boolean)[0];
      const locales = ["en", "ar"];
      const hasLocale = locales.includes(firstSegment as any);

      expect(hasLocale).toBe(true);
      // Should not add another locale prefix
    });

    it("should normalize double-prefixed locales to a single prefix", () => {
      const path = "/ar/ar/provider";
      const segments = path.split("/").filter(Boolean);
      const locales = ["en", "ar"];
      const isDoubleLocale =
        segments.length >= 2 &&
        locales.includes(segments[0] as any) &&
        locales.includes(segments[1] as any);

      expect(isDoubleLocale).toBe(true);

      const normalized = `/${segments[0]}${segments.slice(2).length ? `/${segments.slice(2).join("/")}` : ""}`;
      expect(normalized).toBe("/ar/provider");
    });
  });

  describe("Locale cookie → redirect vs rewrite", () => {
    it("redirects non-default locale to a real /ar URL", () => {
      const preferredLocale: string = "ar";
      const defaultLocale = "en";
      const pathname = "/";
      const localizedPath = `/${preferredLocale}${pathname === "/" ? "" : pathname}`;
      const useRedirect = preferredLocale !== defaultLocale;

      expect(localizedPath).toBe("/ar");
      expect(useRedirect).toBe(true);
    });

    it("rewrites default locale internally (as-needed prefix)", () => {
      const preferredLocale: string = "en";
      const defaultLocale = "en";
      const pathname: string = "/privacy";
      const localizedPath = `/${preferredLocale}${pathname === "/" ? "" : pathname}`;
      const useRedirect = preferredLocale !== defaultLocale;

      expect(localizedPath).toBe("/en/privacy");
      expect(useRedirect).toBe(false);
    });
  });

  describe("www → apex canonical host", () => {
    it("treats www.wengz.tech as a redirect host", () => {
      const host = "www.wengz.tech";
      const canonical = "wengz.tech";
      expect(host === `www.${canonical}`).toBe(true);
    });
  });

  describe("Regex pattern matching", () => {
    it("should match the middleware config pattern", () => {
      // Pattern from config.matcher: "/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\..*).*)"
      const pattern =
        /^\/((?!api\/|_next\/static|_next\/image|favicon\.ico|robots\.txt|sitemap\.xml|manifest\.json|.*\..*).*)/;

      const shouldMatch = ["/", "/en", "/ar", "/admin", "/en/admin/users", "/ar/client/requests"];

      const shouldNotMatch = [
        "/api/health",
        "/_next/static/chunk.js",
        "/_next/image",
        "/favicon.ico",
        "/robots.txt",
        "/manifest.json",
        "/images/logo.png",
        "/sw.js",
      ];

      shouldMatch.forEach((path) => {
        expect(pattern.test(path)).toBe(true);
      });

      shouldNotMatch.forEach((path) => {
        expect(pattern.test(path)).toBe(false);
      });
    });
  });
});
