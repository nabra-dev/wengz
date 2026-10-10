import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../src/providers/auth";
import { Loading } from "../src/components/ui";
import { hasCompletedOnboarding } from "../src/lib/onboarding";

export default function Index() {
  const { ready, token } = useAuth();
  const [gate, setGate] = useState<"loading" | "onboarding" | "welcome">("loading");

  useEffect(() => {
    if (token) return;
    let cancelled = false;
    void hasCompletedOnboarding().then((done) => {
      if (!cancelled) setGate(done ? "welcome" : "onboarding");
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!ready) return <Loading />;
  if (token) return <Redirect href="/(app)" />;
  if (gate === "loading") return <Loading />;
  if (gate === "onboarding") return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(auth)/welcome" />;
}
