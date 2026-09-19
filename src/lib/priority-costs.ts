import { db } from "./db";
import { logger } from "@/lib/logger";

// Default priority costs - extracted as constant to avoid recreation
const DEFAULT_PRIORITY_COSTS = { low: 0, medium: 1, high: 2 } as const;

// Get priority costs for a specific service type
export async function getPriorityCostsForService(
  serviceTypeId: string
): Promise<{ low: number; medium: number; high: number }> {
  try {
    const serviceType = await db.serviceType.findUnique({
      where: { id: serviceTypeId },
      select: {
        priorityCostLow: true,
        priorityCostMedium: true,
        priorityCostHigh: true,
      },
    });

    if (serviceType) {
      return {
        low: serviceType.priorityCostLow,
        medium: serviceType.priorityCostMedium,
        high: serviceType.priorityCostHigh,
      };
    }
  } catch (error) {
    logger.warn("Failed to fetch priority costs from service type, using defaults", error);
  }

  return DEFAULT_PRIORITY_COSTS;
}

// Calculate total credit cost with priority - uses pre-fetched costs if available (synchronous)
export function calculateCreditCostSync(
  baseCost: number,
  priority: number,
  costs: { low: number; medium: number; high: number }
): number {
  const priorityCostMap: Record<number, number> = {
    1: costs.low,
    2: costs.medium,
    3: costs.high,
  };
  return baseCost + (priorityCostMap[priority] ?? costs.medium);
}

export async function calculateCreditCost(
  baseCost: number,
  priority: number,
  serviceTypeId: string
): Promise<number> {
  const costs = await getPriorityCostsForService(serviceTypeId);
  return calculateCreditCostSync(baseCost, priority, costs);
}

// Legacy function for backward compatibility - deprecated
export async function getPriorityCosts(): Promise<{ low: number; medium: number; high: number }> {
  logger.warn("getPriorityCosts() is deprecated, use getPriorityCostsForService() instead");
  return { low: 0, medium: 1, high: 2 };
}

// No longer needed - priority costs are per service now
export function clearPriorityCostCache(): void {
  // Kept for backward compatibility but does nothing
}
