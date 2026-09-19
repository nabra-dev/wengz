export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    const { validateProductionEnv } = await import("@/lib/env");
    validateProductionEnv();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = async (
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
) => {
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(...args);
};
