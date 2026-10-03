import { db } from "@/lib/db";
import { getOrSetCached, cacheKeys, cacheTTL } from "@/lib/cache";

export type PublicPackage = {
  id: string;
  name: string;
  nameI18n?: Record<string, string>;
  description?: string;
  descriptionI18n?: Record<string, string>;
  price: number;
  credits: number;
  durationDays: number;
  features: string[];
  featuresI18n?: Record<string, string[]>;
  sortOrder: number;
  isFeatured?: boolean;
  services: Array<{
    serviceType: {
      id: string;
      name: string;
      nameI18n?: Record<string, string>;
      icon: string | null;
    };
  }>;
};

function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, string>;
}

function asStringArrayRecord(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, string[]>;
}

/** Active paid packages for landing / public surfaces (cached). */
export async function getPublicPackages(): Promise<PublicPackage[]> {
  try {
    const rows = await getOrSetCached(
      cacheKeys.PACKAGES,
      () =>
        db.package.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            isFreePackage: false,
          },
          select: {
            id: true,
            name: true,
            nameI18n: true,
            description: true,
            descriptionI18n: true,
            price: true,
            credits: true,
            durationDays: true,
            features: true,
            featuresI18n: true,
            sortOrder: true,
            isFeatured: true,
            services: {
              select: {
                serviceType: {
                  select: {
                    id: true,
                    name: true,
                    nameI18n: true,
                    icon: true,
                  },
                },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        }),
      cacheTTL.PACKAGES
    );

    return rows.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      nameI18n: asStringRecord(pkg.nameI18n),
      description: pkg.description ?? undefined,
      descriptionI18n: asStringRecord(pkg.descriptionI18n),
      price: Number(pkg.price),
      credits: pkg.credits,
      durationDays: pkg.durationDays,
      features: Array.isArray(pkg.features) ? (pkg.features as string[]) : [],
      featuresI18n: asStringArrayRecord(pkg.featuresI18n),
      sortOrder: pkg.sortOrder,
      isFeatured: !!pkg.isFeatured,
      services: pkg.services.map((s) => ({
        serviceType: {
          id: s.serviceType.id,
          name: s.serviceType.name,
          nameI18n: asStringRecord(s.serviceType.nameI18n),
          icon: s.serviceType.icon,
        },
      })),
    }));
  } catch {
    // Public landing must render even when Postgres/Redis are down locally.
    return [];
  }
}
