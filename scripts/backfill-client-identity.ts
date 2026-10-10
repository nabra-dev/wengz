/**
 * One-shot backfill: index latest DELIVERABLE files for each COMPLETED request.
 * Safe to re-run (unique on clientId + fileUrl).
 *
 * Usage: npx tsx scripts/backfill-client-identity.ts
 */
import { PrismaClient } from "@prisma/client";
import { indexClientIdentityFromRequest } from "../src/lib/client-identity";

const db = new PrismaClient();

async function main() {
  const completed = await db.request.findMany({
    where: { status: "COMPLETED", deletedAt: null },
    select: { id: true, clientId: true, serviceTypeId: true },
    orderBy: { completedAt: "asc" },
  });

  console.log(`Found ${completed.length} completed request(s)`);

  let totalIndexed = 0;
  let requestsWithFiles = 0;

  for (const request of completed) {
    const indexed = await indexClientIdentityFromRequest(db, {
      clientId: request.clientId,
      requestId: request.id,
      serviceTypeId: request.serviceTypeId,
    });
    if (indexed > 0) {
      requestsWithFiles += 1;
      totalIndexed += indexed;
      console.log(`  ${request.id}: indexed ${indexed} file(s)`);
    }
  }

  console.log(
    `Done. ${requestsWithFiles} request(s) contributed ${totalIndexed} identity asset upsert(s).`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
