import type { ReactNode } from "react";
import { Link } from "@/i18n/routing";
import { BrandLogo } from "@/components/brand/brand-logo";

type LegalSection = {
  readonly title: string;
  readonly body: string;
};

type LegalDocumentProps = {
  readonly title: string;
  readonly updatedLabel: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
  readonly backHomeLabel: string;
  readonly children?: ReactNode;
};

export function LegalDocument({
  title,
  updatedLabel,
  intro,
  sections,
  backHomeLabel,
  children,
}: LegalDocumentProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex h-14 items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo className="h-7" />
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm text-muted-foreground">{updatedLabel}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{intro}</p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
              <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
                {section.body}
              </p>
            </section>
          ))}
          {children}
        </div>

        <p className="mt-12 text-sm text-muted-foreground">
          <Link href="/" className="underline-offset-4 hover:underline">
            {backHomeLabel}
          </Link>
        </p>
      </main>
    </div>
  );
}
