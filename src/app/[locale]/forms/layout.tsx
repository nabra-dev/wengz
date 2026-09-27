import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TRPCProvider } from "@/components/providers/trpc-provider";

/** Public lead-gen forms — indexable marketing pages. */
export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
  },
};

export default function FormsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <TRPCProvider>{children}</TRPCProvider>;
}
