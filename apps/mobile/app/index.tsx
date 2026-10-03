import { Redirect } from "expo-router";
import { useAuth } from "../src/providers/auth";
import { Loading } from "../src/components/ui";

export default function Index() {
  const { ready, token } = useAuth();
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(app)" />;
}
