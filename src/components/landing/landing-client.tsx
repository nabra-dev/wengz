import LandingPage from "@/components/landing/landing-page";
import type { PublicPackage } from "@/lib/public-packages";

export function LandingClient({ initialPackages = [] }: { initialPackages?: PublicPackage[] }) {
  return <LandingPage initialPackages={initialPackages} />;
}
