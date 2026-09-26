import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";
import { logger } from "@/lib/logger";
import { isExpectedTrpcClientError } from "@/lib/trpc-expected-errors";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (opts) => createTRPCContext(opts),
    onError: ({ path, error }) => {
      // Expected client failures (e.g. CONFLICT "Email already registered")
      // must not create Sentry issues.
      if (isExpectedTrpcClientError(error)) {
        logger.debug(`tRPC client error on ${path ?? "<no-path>"}`, {
          message: error.message,
          code: error.code,
        });
        return;
      }

      logger.error(`tRPC failed on ${path ?? "<no-path>"}`, {
        error,
        code: error.code,
      });
    },
  });

export { handler as GET, handler as POST };
