/**
 * Timed full-cycle smoke via tRPC createCaller (no browser).
 * Usage: node --import tsx scripts/smoke-full-cycle.mjs
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const stamp = Date.now();
const timings = [];
const warnings = [];

async function timed(name, fn) {
  const t0 = performance.now();
  try {
    const result = await fn();
    const ms = +(performance.now() - t0).toFixed(1);
    timings.push({ step: name, ms, ok: true });
    console.log(`✓ ${name} (${ms}ms)`);
    return result;
  } catch (e) {
    const ms = +(performance.now() - t0).toFixed(1);
    timings.push({ step: name, ms, ok: false, error: e?.message || String(e) });
    console.error(`✗ ${name} (${ms}ms):`, e?.message || e);
    throw e;
  }
}

function sessionFor(user) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image,
      phone: user.phone,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

async function main() {
  // Dynamic import after env is loaded
  const { appRouter } = await import("../src/server/routers/_app.ts");

  const createCaller = (user) =>
    appRouter.createCaller({
      db,
      session: sessionFor(user),
      locale: "en",
      req: undefined,
    });

  console.log("\n=== SMOKE FULL CYCLE ===\n");

  const admin = await timed("load admin", () =>
    db.user.findFirst({ where: { email: "nabraagency20@gmail.com", deletedAt: null } })
  );
  if (!admin) throw new Error("Admin not found");

  const clientEmail = `smoke.cycle.${stamp}@example.com`;
  const providerEmail = `smoke.prov.${stamp}@example.com`;

  // Ensure bcrypt password hash for client (via existing smoke client pattern - create via prisma)
  const bcryptMod = await import("bcryptjs");
  const bcrypt = bcryptMod.default ?? bcryptMod;
  const clientHash = await bcrypt.hash("SmokeTest@2026!", 10);

  const client = await timed("create client user", () =>
    db.user.create({
      data: {
        email: clientEmail,
        name: "Smoke Cycle Client",
        password: clientHash,
        role: "CLIENT",
        phone: `10${String(stamp).slice(-8)}`,
      },
    })
  );

  const freePkg = await timed("find free package", () =>
    db.package.findFirst({ where: { price: 0, isActive: true } })
  );
  if (!freePkg) throw new Error("No free package");

  await timed("activate free subscription", () =>
    db.clientSubscription.create({
      data: {
        userId: client.id,
        packageId: freePkg.id,
        remainingCredits: freePkg.credits,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 86400000),
        isActive: true,
      },
    })
  );

  // Provider via admin caller
  const adminCaller = createCaller(admin);
  const servicesEarly = await db.serviceType.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, creditCost: true },
  });
  if (!servicesEarly.length) throw new Error("No services");

  await timed("admin.createUser(PROVIDER)", () =>
    adminCaller.admin.createUser({
      name: "Smoke Cycle Provider",
      email: providerEmail,
      password: "SmokeProv@2026!",
      phone: `+20 ${String(stamp).slice(-10)}`,
      role: "PROVIDER",
      supportedServiceIds: servicesEarly.map((s) => s.id),
    })
  );

  const provider = await db.user.findUnique({
    where: { email: providerEmail },
    include: { providerProfile: true },
  });
  if (!provider?.providerProfile) throw new Error("Provider profile missing");

  const services = servicesEarly;

  // Pick cheapest service the free package allows
  const freeWithServices = await db.package.findUnique({
    where: { id: freePkg.id },
    include: { services: true },
  });
  const allowedIds = freeWithServices?.supportAllServices
    ? services.map((s) => s.id)
    : (freeWithServices?.services || []).map((s) => s.serviceId);
  const service =
    services
      .filter((s) => allowedIds.includes(s.id))
      .sort((a, b) => (a.creditCost || 0) - (b.creditCost || 0))[0] || services[0];

  const clientCaller = createCaller(client);
  const created = await timed("request.create", () =>
    clientCaller.request.create({
      title: `Smoke cycle request ${stamp}`,
      description:
        "Automated full-cycle smoke test request description for monitoring performance and responses.",
      serviceTypeId: service.id,
      priority: 1,
    })
  );
  const requestId = created.request.id;

  await timed("admin.assignRequest", () =>
    adminCaller.admin.assignRequest({
      requestId,
      providerId: provider.id,
    })
  );

  const providerCaller = createCaller(provider);
  await timed("provider.startWork", () =>
    providerCaller.provider.startWork({
      requestId,
      estimatedDeliveryMinutes: 60,
    })
  );

  await timed("provider.deliverWork", () =>
    providerCaller.provider.deliverWork({
      requestId,
      deliverableMessage: "Smoke deliverable ready for client review and approval.",
    })
  );

  await timed("request.approve", () => clientCaller.request.approve({ requestId }));

  await timed("request.rate", () =>
    clientCaller.request.rate({
      requestId,
      rating: 5,
      reviewText: "Great smoke cycle delivery",
    })
  );

  // Payment path: subscribe to paid package + proof + approve
  const paidPkg = await db.package.findFirst({
    where: { price: { gt: 0 }, isActive: true },
    orderBy: { price: "asc" },
  });
  if (paidPkg) {
    const sub = await timed("create paid subscription pending", () =>
      db.clientSubscription.create({
        data: {
          userId: client.id,
          packageId: paidPkg.id,
          remainingCredits: paidPkg.credits,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 86400000),
          isActive: false,
        },
      })
    );

    const proof = await timed("create payment proof", () =>
      db.paymentProof.create({
        data: {
          subscriptionId: sub.id,
          userId: client.id,
          senderName: "Smoke Cycle Client",
          senderBank: "CIB",
          senderCountry: "Egypt",
          amount: paidPkg.price,
          currency: "USD",
          transferDate: new Date(),
          referenceNumber: `SMOKE-${stamp}`,
          notes: "Smoke cycle payment",
          transferImage: "https://placehold.co/600x400/png",
          status: "PENDING",
        },
      })
    );

    await timed("payment.approvePayment", () =>
      adminCaller.payment.approvePayment({ paymentId: proof.id })
    );
  } else {
    warnings.push("No paid package found — skipped payment approve");
  }

  // Perf: admin dashboard queries
  await timed("admin.getStats", () => adminCaller.admin.getStats());
  await timed("admin.getAnalytics", () => adminCaller.admin.getAnalytics());
  await timed("admin.getAllSubscriptions(limit:5)", () =>
    adminCaller.admin.getAllSubscriptions({ limit: 5 })
  );
  await timed("admin dashboard batch (3 parallel)", () =>
    Promise.all([
      adminCaller.admin.getStats(),
      adminCaller.admin.getAnalytics(),
      adminCaller.admin.getAllSubscriptions({ limit: 5 }),
    ])
  );

  const final = await db.request.findUnique({
    where: { id: requestId },
    include: { rating: true },
  });
  const wallet = await db.providerWallet.findUnique({ where: { providerId: provider.id } });
  const ledger = await db.providerFinanceLedger.findFirst({
    where: { requestId },
  });

  console.log("\n=== RESULT ===");
  console.log({
    requestId,
    status: final?.status,
    rating: final?.rating?.rating,
    walletHeldCredits: wallet?.heldCredits,
    walletBalanceCredits: wallet?.balanceCredits,
    walletPendingCredits: wallet?.pendingCredits,
    ledgerStatus: ledger?.status,
    ledgerAvailableAt: ledger?.availableAt,
    ledgerProviderCredits: ledger?.providerCredits,
    ledgerProviderUsd: ledger?.providerAmountUsd,
    clientEmail,
    providerEmail,
  });

  if (ledger?.status !== "HOLD") {
    throw new Error(`Expected ledger HOLD after approve, got ${ledger?.status}`);
  }
  if ((wallet?.heldCredits ?? 0) <= 0) {
    throw new Error("Expected wallet heldCredits > 0 after approve");
  }
  if ((ledger?.providerCredits ?? 0) !== (wallet?.heldCredits ?? -1)) {
    throw new Error(
      `Expected heldCredits (${wallet?.heldCredits}) to match ledger providerCredits (${ledger?.providerCredits})`
    );
  }

  console.log("\n=== TIMINGS (ms) ===");
  console.table(timings);

  const slow = timings.filter((t) => t.ms > 500);
  if (slow.length) {
    console.log("\n⚠ Slow steps (>500ms):");
    console.table(slow);
  }
  if (warnings.length) {
    console.log("\n⚠ Warnings:");
    warnings.forEach((w) => console.log(" -", w));
  }

  const failed = timings.filter((t) => !t.ok);
  if (failed.length || final?.status !== "COMPLETED") {
    process.exitCode = 1;
  } else {
    console.log("\nALL PASSED");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
