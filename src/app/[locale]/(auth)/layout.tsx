import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/providers/session-provider";
import { TRPCProvider } from "@/components/providers/trpc-provider";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AuthProvider>
      <TRPCProvider>
        <div className="min-h-screen flex items-center justify-center bg-muted/50">
          <div className="w-full max-w-md p-4">{children}</div>
        </div>
      </TRPCProvider>
    </AuthProvider>
  );
}
