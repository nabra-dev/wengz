import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isStaffRole, type AppRole } from "@/lib/roles";

const DEFAULT_AVATAR = "/images/logo.svg";

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
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    image?: string | null;
    phone?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    phone?: string | null;
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

        // Rate limit login attempts per email+IP to slow credential stuffing.
        const forwarded = req?.headers?.["x-forwarded-for"];
        const ip =
          (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ||
          (req?.headers?.["x-real-ip"] as string | undefined) ||
          "unknown";
        const rl = rateLimit(`login:${credentials.email.toLowerCase()}:${ip}`, {
          limit: 10,
          windowMs: 60_000,
        });
        if (!rl.success) {
          throw new Error("Too many login attempts. Please try again shortly.");
        }

        const user = await db.user.findFirst({
          where: {
            email: credentials.email,
            deletedAt: null,
          },
        });

        if (!user?.password) {
          throw new Error("Invalid email or password");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
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
      }

      // Update token when session is updated
      if (trigger === "update" && session) {
        token.name = session.name ?? token.name;
        token.email = session.email ?? token.email;
        token.picture = session.image ?? token.picture ?? DEFAULT_AVATAR;
        token.phone = session.phone ?? token.phone;
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = (token.picture as string | null) || DEFAULT_AVATAR;
        session.user.phone = token.phone;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
