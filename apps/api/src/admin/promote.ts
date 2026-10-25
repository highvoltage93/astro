import { prisma } from "../prisma/client";

async function main(): Promise<void> {
  const username = process.argv[2]?.trim();
  if (!username || process.argv.length !== 3) throw new Error("Usage: node apps/api/dist/admin/promote.js <username>");
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true, role: true } });
  if (!user) throw new Error("Account not found. Register the account first; no account or password was changed.");
  if (user.role === "ADMIN") { console.log("Account is already an administrator."); return; }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    await tx.auditEvent.create({ data: {
      action: "admin.user.promote-cli", entity: "User", entityId: user.id,
      metadata: { source: "server-cli", previousRole: user.role, role: "ADMIN" }
    } });
  });
  console.log("Administrator role granted. Open /admin using this account.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unable to grant administrator role.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
