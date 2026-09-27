import { resolvePublicRequestOrigin, publicRedirectUrl } from "../request-origin";

function headers(map: Record<string, string>) {
  return new Headers(map);
}

describe("resolvePublicRequestOrigin", () => {
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;
  const prevAuth = process.env.NEXTAUTH_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = prevApp;
    process.env.NEXTAUTH_URL = prevAuth;
  });

  it("prefers x-forwarded-host over localhost req.url", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;

    const origin = resolvePublicRequestOrigin({
      url: "http://localhost:3001/api/locale?set=ar&next=%2F",
      headers: headers({
        "x-forwarded-host": "wengz.tech",
        "x-forwarded-proto": "https",
        host: "localhost:3001",
      }),
    });

    expect(origin).toBe("https://wengz.tech");
  });

  it("falls back to NEXT_PUBLIC_APP_URL when host is loopback", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://wengz.tech";
    delete process.env.NEXTAUTH_URL;

    const origin = resolvePublicRequestOrigin({
      url: "http://localhost:3001/api/locale",
      headers: headers({ host: "localhost:3001" }),
    });

    expect(origin).toBe("https://wengz.tech");
  });

  it("uses localhost origin in true local dev without public env", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;

    const origin = resolvePublicRequestOrigin({
      url: "http://localhost:3001/api/locale",
      headers: headers({ host: "localhost:3001" }),
    });

    expect(origin).toBe("http://localhost:3001");
  });
});

describe("publicRedirectUrl", () => {
  it("builds absolute public Location paths", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://wengz.tech";

    const url = publicRedirectUrl(
      {
        url: "http://localhost:3001/api/locale",
        headers: headers({ host: "localhost:3001" }),
      },
      "/ar/contact"
    );

    expect(url.toString()).toBe("https://wengz.tech/ar/contact");
  });
});
