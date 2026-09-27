import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const { appRouter } = await import("../src/server/routers/_app.ts");
  const { getProviderWorkload, canClaimAdditionalRequest } = await import(
    "../src/lib/provider-workload.ts"
  );

  const provider = await db.user.findUnique({
    where: { email: "cycle.provider.0927@test.wengz.local" },
  });
  const client = await db.user.findUnique({
    where: { email: "cycle.client.0927@test.wengz.local" },
  });
  if (!provider || !client) throw new Error("users missing");

  const session = (u) => ({
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      image: u.image,
      phone: u.phone,
    },
    expires: new Date(Date.now() + 864e5).toISOString(),
  });
  const caller = (u) =>
    appRouter.createCaller({ db, session: session(u), locale: "en", req: undefined });

  const providerCaller = caller(provider);
  const clientCaller = caller(client);

  const mine = await db.request.findMany({
    where: { providerId: provider.id, deletedAt: null },
    select: { id: true, title: true, status: true },
  });
  console.log("current jobs", mine);
  const wl = await getProviderWorkload(provider.id);
  console.log("workload", wl, "canClaim", canClaimAdditionalRequest(wl));

  const social = await db.serviceType.findFirst({ where: { name: "Social Media Design" } });
  const r3 = await clientCaller.request.create({
    title: "Cycle fake request 3 - capacity test",
    description:
      "Third request while provider may still have IN_PROGRESS work. Testing capacity guard on claim.",
    serviceTypeId: social.id,
    priority: 1,
  });
  console.log("created r3", r3.request.id);

  try {
    await providerCaller.provider.claimRequest({ requestId: r3.request.id });
    console.log("claim 3 while busy: SUCCEEDED (unexpected if still IN_PROGRESS)");
  } catch (e) {
    console.log("claim 3 while busy: BLOCKED —", e.message);
  }

  // Ensure #2 delivered
  const r2 = await db.request.findUnique({ where: { id: "cmuj84nb0000xooegls9t4ubx" } });
  if (r2?.status === "IN_PROGRESS") {
    await providerCaller.provider.deliverWork({
      requestId: r2.id,
      deliverableMessage: "Deliverable for request 2.",
    });
    console.log("delivered #2");
  }

  const wl2 = await getProviderWorkload(provider.id);
  console.log("after deliver workload", wl2, "canClaim", canClaimAdditionalRequest(wl2));

  try {
    await providerCaller.provider.claimRequest({ requestId: r3.request.id });
    console.log("claim 3 after deliver: OK");
  } catch (e) {
    console.log("claim 3 after deliver: FAILED —", e.message);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
