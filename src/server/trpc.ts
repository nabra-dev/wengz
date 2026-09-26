import { initTRPC, TRPCError } from "@trpc/server";
import { getServerSession } from "next-auth";
import superjson from "superjson";
import { ZodError } from "zod";
import type { OpenApiMeta } from "trpc-to-openapi";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocaleFromCookie } from "@/lib/notifications/i18n-helper";
import { canManageFinance, canManageRequests, isStaffRole, isSuperAdmin } from "@/lib/roles";
import { revalidateSessionUser } from "@/lib/session-user-cache";
import { measurePerformance } from "@/lib/performance";
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

const t = initTRPC
  .context<typeof createTRPCContext>()
  .meta<OpenApiMeta>()
  .create({
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

const performanceMiddleware = t.middleware(async ({ path, type, next }) => {
  return measurePerformance(`${type}:${path}`)(() => next());
});

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

export const protectedProcedure = t.procedure.use(performanceMiddleware).use(enforceUserIsAuthed);

function withFreshRole(
  ctx: { session: NonNullable<Awaited<ReturnType<typeof createTRPCContext>>["session"]> },
  role: string
) {
  return {
    ctx: {
      session: {
        ...ctx.session,
        user: { ...ctx.session.user, role },
      },
    },
  };
}

// Super admin only — platform catalog, users, maintenance, activity
const enforceUserIsAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const freshUser = await revalidateSessionUser(ctx.session.user.id);
  if (!isSuperAdmin(freshUser.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a super admin to access this resource",
    });
  }
  return next(withFreshRole({ session: ctx.session }, freshUser.role));
});

export const adminProcedure = t.procedure.use(performanceMiddleware).use(enforceUserIsAdmin);

/** Any staff role (super admin, project manager, finance manager). */
const enforceUserIsStaff = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const freshUser = await revalidateSessionUser(ctx.session.user.id);
  if (!isStaffRole(freshUser.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a staff member to access this resource",
    });
  }
  return next(withFreshRole({ session: ctx.session }, freshUser.role));
});

export const staffProcedure = t.procedure.use(performanceMiddleware).use(enforceUserIsStaff);

/** Super admin or project manager — client/provider requests. */
const enforceUserCanManageRequests = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const freshUser = await revalidateSessionUser(ctx.session.user.id);
  if (!canManageRequests(freshUser.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a project manager or super admin to access this resource",
    });
  }
  return next(withFreshRole({ session: ctx.session }, freshUser.role));
});

export const requestManagerProcedure = t.procedure
  .use(performanceMiddleware)
  .use(enforceUserCanManageRequests);

/** Super admin or finance manager — payments, wallets, finance settings. */
const enforceUserCanManageFinance = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const freshUser = await revalidateSessionUser(ctx.session.user.id);
  if (!canManageFinance(freshUser.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a finance manager or super admin to access this resource",
    });
  }
  return next(withFreshRole({ session: ctx.session }, freshUser.role));
});

export const financeManagerProcedure = t.procedure
  .use(performanceMiddleware)
  .use(enforceUserCanManageFinance);

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

export const providerProcedure = t.procedure.use(performanceMiddleware).use(enforceUserIsProvider);

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

export const clientProcedure = t.procedure.use(performanceMiddleware).use(enforceUserIsClient);
