import { initTRPC, TRPCError } from "@trpc/server";
import { getServerSession } from "next-auth";
import superjson from "superjson";
import { ZodError } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocaleFromCookie } from "@/lib/notifications/i18n-helper";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { NextApiRequest, NextApiResponse } from "next";

type NextApiCreateContextOpts = {
  req: NextApiRequest;
  res: NextApiResponse;
};

export const createTRPCContext = async (
  opts?: FetchCreateContextFnOptions | NextApiCreateContextOpts
) => {
  const session =
    opts && "res" in opts
      ? await getServerSession(opts.req, opts.res, authOptions)
      : await getServerSession(authOptions);

  // Extract locale from cookies
  let locale = "en";
  if (opts) {
    const req = "res" in opts ? opts.req : opts.req;
    if (req) {
      let cookieHeader: string | undefined;
      if ("headers" in req && req.headers instanceof Headers) {
        cookieHeader = req.headers.get("cookie") ?? undefined;
      } else if ("headers" in req && typeof req.headers === "object") {
        cookieHeader = (req.headers as Record<string, any>).cookie;
      }
      if (cookieHeader) {
        locale = getLocaleFromCookie(cookieHeader);
      }
    }
  }

  return {
    db,
    session,
    req: opts?.req,
    locale,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Revalidate the session user against the database on every protected call.
 * JWTs are long-lived (30 days), so role changes and soft-deletes must be
 * enforced from the DB, not the token. Returns the fresh role.
 */
async function revalidateSessionUser(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Your account is no longer active. Please sign in again.",
    });
  }

  return user;
}

// Middleware to enforce authentication
const enforceUserIsAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const freshUser = await revalidateSessionUser(ctx.session.user.id);
  return next({
    ctx: {
      session: {
        ...ctx.session,
        user: { ...ctx.session.user, role: freshUser.role },
      },
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

// Middleware to enforce admin role
const enforceUserIsAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const freshUser = await revalidateSessionUser(ctx.session.user.id);
  if (freshUser.role !== "SUPER_ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be an admin to access this resource",
    });
  }
  return next({
    ctx: {
      session: {
        ...ctx.session,
        user: { ...ctx.session.user, role: freshUser.role },
      },
    },
  });
});

export const adminProcedure = t.procedure.use(enforceUserIsAdmin);

// Middleware to enforce provider role
const enforceUserIsProvider = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const freshUser = await revalidateSessionUser(ctx.session.user.id);
  if (freshUser.role !== "PROVIDER" && freshUser.role !== "SUPER_ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a provider to access this resource",
    });
  }
  return next({
    ctx: {
      session: {
        ...ctx.session,
        user: { ...ctx.session.user, role: freshUser.role },
      },
    },
  });
});

export const providerProcedure = t.procedure.use(enforceUserIsProvider);

// Middleware to enforce client role
const enforceUserIsClient = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const freshUser = await revalidateSessionUser(ctx.session.user.id);
  if (freshUser.role !== "CLIENT" && freshUser.role !== "SUPER_ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a client to access this resource",
    });
  }
  return next({
    ctx: {
      session: {
        ...ctx.session,
        user: { ...ctx.session.user, role: freshUser.role },
      },
    },
  });
});

export const clientProcedure = t.procedure.use(enforceUserIsClient);
