import { z } from "zod";

/**
 * Cursor-based pagination schema for list queries
 * Supports efficient pagination for large datasets
 */
export const paginationInputSchema = z
  .object({
    limit: z.number().min(1).max(100).default(20).describe("Number of items per page"),
    cursor: z.string().nullish().describe("Cursor for pagination (id of last item)"),
    sortBy: z.enum(["createdAt", "updatedAt"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export type PaginationInput = z.infer<typeof paginationInputSchema>;

/**
 * Pagination result with meta information
 */
export interface PaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

/**
 * Create pagination parameters for Prisma queries
 */
export function createPaginationParams(input: PaginationInput) {
  const { limit, cursor, sortBy, sortOrder } = input;

  const take = limit + 1; // Fetch one extra to check if there are more

  const skip = cursor ? 1 : 0; // Skip the cursor itself

  const orderBy = {
    [sortBy]: sortOrder,
  };

  return {
    take: sortOrder === "desc" ? -take : take,
    skip,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy,
  };
}

/**
 * Process Prisma pagination results
 */
export function processPaginationResult<T extends { id: string }>(
  items: T[],
  limit: number
): PaginationResult<T> {
  const hasMore = items.length > limit;
  const itemsToReturn = hasMore ? items.slice(0, limit) : items;

  return {
    items: itemsToReturn,
    nextCursor: hasMore ? (itemsToReturn.at(-1)?.id ?? null) : null,
    hasMore,
  };
}

/**
 * Combined pagination helper for cleaner code
 */
export function createPaginationHelper<T extends { id: string }>(input: PaginationInput) {
  const params = createPaginationParams(input);

  return {
    params,
    processResult: (items: T[]) => processPaginationResult(items, input.limit),
  };
}

/**
 * Default select statement for Request to reduce payload size
 */
export const requestSelectShort = {
  id: true,
  title: true,
  status: true,
  priority: true,
  serviceTypeId: true,
  clientId: true,
  providerId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
} as const;

/**
 * Extended select for Request detail view
 */
export const requestSelectFull = {
  ...requestSelectShort,
  description: true,
  creditCost: true,
  formData: true,
  attributeResponses: true,
  currentRevisionCount: true,
  isRevision: true,
  attachments: true,
  estimatedDelivery: true,
} as const;

/**
 * Default select for User to exclude sensitive data
 */
export const userSelectPublic = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
  createdAt: true,
} as const;

/**
 * Select for user profile
 */
export const userSelectProfile = {
  ...userSelectPublic,
  phone: true,
  providerProfile: {
    select: {
      bio: true,
      portfolio: true,
      skillsTags: true,
      isActive: true,
    },
  },
} as const;

/**
 * Query optimization helper
 * Prevents N+1 queries by batching related data
 */
export async function batchFetch<T, K extends string | number>(
  ids: K[],
  fetcher: (ids: K[]) => Promise<Map<K, T>>,
  onNotFound?: (missingIds: K[]) => void
): Promise<Map<K, T>> {
  if (ids.length === 0) return new Map();

  const result = await fetcher(ids);

  const foundIds = new Set(result.keys());
  const missingIds = ids.filter((id) => !foundIds.has(id));

  if (missingIds.length > 0 && onNotFound) {
    onNotFound(missingIds);
  }

  return result;
}

/**
 * Chunk array into smaller arrays
 * Useful for batch processing
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Debounce expensive operations
 */
export function createDebounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
}
