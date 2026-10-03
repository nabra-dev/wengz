import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/providers/auth";
import { Loading } from "../../src/components/ui";

export default function AuthLayout() {
  const { ready, token } = useAuth();
  if (!ready) return <Loading />;
  if (token) return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
