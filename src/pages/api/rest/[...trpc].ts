import { createOpenApiNextHandler } from "trpc-openapi";
import type { NextApiRequest, NextApiResponse } from "next";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";
import { logger } from "@/lib/logger";

export default createOpenApiNextHandler({
  router: appRouter,
  createContext: ({ req, res }: { req: NextApiRequest; res: NextApiResponse }) =>
    createTRPCContext({ req, res }),
  responseMeta({ errors }: { errors: Array<{ code: string }> }) {
    const firstError = errors?.[0];
    if (!firstError) return {};

    if (firstError.code === "UNAUTHORIZED") {
      return { status: 401 };
    }

    if (firstError.code === "FORBIDDEN") {
      return { status: 403 };
    }

    return {};
  },
  onError({ error, path }: { error: unknown; path?: string }) {
    if (process.env.NODE_ENV === "development") {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`❌ REST/OpenAPI failed on ${path ?? "<no-path>"}: ${message}`);
    }
  },
});
