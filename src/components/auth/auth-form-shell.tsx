"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const authFieldClass =
  "h-12 rounded-xl border-border/70 bg-background/80 shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20";

type AuthFormShellProps = {
  badge: ReactNode;
  title: string;
  subtitle: string;
  asideExtras?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AuthFormShell({
  badge,
  title,
  subtitle,
  asideExtras,
  children,
  className,
}: AuthFormShellProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-xl ring-1 ring-primary/10",
        className
      )}
    >
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/70 to-[#E0F840]/50" />

      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
        <aside className="relative border-b border-border/60 bg-gradient-to-br from-primary/[0.08] via-muted/15 to-transparent px-6 py-8 sm:px-8 sm:py-10 lg:border-b-0 lg:border-e">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium">
            {badge}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {subtitle}
          </p>
          {asideExtras ? <div className="mt-8 space-y-4">{asideExtras}</div> : null}
        </aside>

        <div className="px-5 py-8 sm:px-8 sm:py-10">{children}</div>
      </div>
    </div>
  );
}

type AuthCompactCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/** Single-column card for forgot/reset inside the shared auth layout. */
export function AuthCompactCard({ title, description, children, className }: AuthCompactCardProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-xl ring-1 ring-primary/10",
        className
      )}
    >
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/70 to-[#E0F840]/50" />
      <div className="space-y-6 px-5 py-8 sm:px-8 sm:py-10">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
