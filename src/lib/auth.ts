import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isStaffRole, type AppRole } from "@/lib/roles";

const DEFAULT_AVATAR = "/images/logo.svg";

/** Precomputed bcrypt hash so missing users still pay compare cost (timing). */
const DUMMY_PASSWORD_HASH = "$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";

type UserRole = AppRole;

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      image?: string | null;
      phone?: string | null;
      passwordChangedAt?: number;
    };
    error?: "PasswordChanged" | "SessionInvalid";
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    image?: string | null;
    phone?: string | null;
    passwordChangedAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    phone?: string | null;
    passwordChangedAt?: number;
    error?: "PasswordChanged" | "SessionInvalid";
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email = credentials.email.toLowerCase().trim();

        // Rate limit login attempts per email+IP to slow credential stuffing.
        const forwarded = req?.headers?.["x-forwarded-for"];
        const ip =
          (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ||
          (req?.headers?.["x-real-ip"] as string | undefined) ||
          "unknown";
        const rl = rateLimit(`login:${email}:${ip}`, {
          limit: 10,
          windowMs: 60_000,
        });
        if (!rl.success) {
          throw new Error("Too many login attempts. Please try again shortly.");
        }

        const user = await db.user.findFirst({
          where: {
            email,
            deletedAt: null,
          },
        });

        const passwordHash = user?.password || DUMMY_PASSWORD_HASH;
        const isPasswordValid = await bcrypt.compare(credentials.password, passwordHash);

        if (!user?.password || !isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        if (user.approvalStatus === "PENDING") {
          throw new Error("ACCOUNT_PENDING_APPROVAL");
        }
        if (user.approvalStatus === "REJECTED") {
          const reason = user.rejectionReason?.trim() || "";
          throw new Error(
            reason ? `ACCOUNT_REJECTED:${encodeURIComponent(reason)}` : "ACCOUNT_REJECTED"
          );
        }

        const maintenanceSetting = await db.systemSettings.findUnique({
          where: { key: "maintenance_mode" },
          select: { value: true },
        });
        const maintenanceValue = maintenanceSetting?.value as
          | { enabled?: boolean }
          | null
          | undefined;
        const maintenanceEnabled = Boolean(maintenanceValue?.enabled);
        if (maintenanceEnabled && !isStaffRole(user.role)) {
          throw new Error("MAINTENANCE_MODE_ONLY_ADMIN");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || "",
          role: user.role,
          image: user.image || DEFAULT_AVATAR,
          phone: user.phone,
          passwordChangedAt: user.passwordChangedAt?.getTime() ?? 0,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image || DEFAULT_AVATAR;
        token.phone = user.phone;
        token.passwordChangedAt = user.passwordChangedAt ?? 0;
        delete token.error;
      }

      // Update token when session is updated
      if (trigger === "update" && session) {
        token.name = session.name ?? token.name;
        token.email = session.email ?? token.email;
        token.picture = session.image ?? token.picture ?? DEFAULT_AVATAR;
        token.phone = session.phone ?? token.phone;
      }

      // Invalidate JWTs issued before a password change/reset (or for deleted users).
      if (token.id && !user) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id },
          select: { passwordChangedAt: true, deletedAt: true },
        });

        if (!dbUser || dbUser.deletedAt) {
          return { error: "SessionInvalid" as const };
        }

        const changedAt = dbUser.passwordChangedAt?.getTime() ?? 0;
        const tokenChangedAt =
          typeof token.passwordChangedAt === "number" ? token.passwordChangedAt : 0;
        if (changedAt > tokenChangedAt) {
          return { error: "PasswordChanged" as const };
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.error || !token.id || !token.role) {
        return {
          ...session,
          user: undefined as unknown as typeof session.user,
          error: token.error,
          expires: session.expires,
        };
      }

      session.user.id = token.id;
      session.user.role = token.role;
      session.user.name = token.name as string;
      session.user.email = token.email as string;
      session.user.image = (token.picture as string | null) || DEFAULT_AVATAR;
      session.user.phone = token.phone;
      session.user.passwordChangedAt =
        typeof token.passwordChangedAt === "number" ? token.passwordChangedAt : 0;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
