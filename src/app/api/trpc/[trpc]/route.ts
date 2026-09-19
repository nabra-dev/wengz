import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";
import { logger } from "@/lib/logger";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (opts) => createTRPCContext(opts),
    onError: ({ path, error }) => {
      logger.error(`tRPC failed on ${path ?? "<no-path>"}`, {
        error,
        code: error.code,
      });
    },
  });

export { handler as GET, handler as POST };
