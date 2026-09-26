import Link from "next/link";

/**
 * Root App Router 404. Locale-aware UI lives in `app/[locale]/not-found.tsx`.
 * This file exists so non-locale / probe paths do not hit a missing
 * `/_not-found` client reference manifest (Next.js invariant).
 */
export default function RootNotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        fontFamily: "system-ui, sans-serif",
        padding: "1.5rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "3rem", margin: 0 }}>404</h1>
      <p style={{ margin: 0, opacity: 0.7 }}>Page not found</p>
      <Link href="/" style={{ textDecoration: "underline" }}>
        Back home
      </Link>
    </main>
  );
}
