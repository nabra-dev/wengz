import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../src/providers/auth";
import { Loading } from "../src/components/ui";
import { hasCompletedOnboarding } from "../src/lib/onboarding";

/** Cold-start gate: app → onboarding (once) → welcome → login. */
export default function Index() {
  const { ready, token } = useAuth();
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (token) return;
    let cancelled = false;
    void hasCompletedOnboarding().then((done) => {
      if (!cancelled) setSeenOnboarding(done);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!ready) return <Loading />;
  if (token) return <Redirect href="/(app)" />;
  if (seenOnboarding === null) return <Loading />;
  if (!seenOnboarding) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(auth)/welcome" />;
}
