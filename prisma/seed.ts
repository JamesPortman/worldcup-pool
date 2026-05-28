import { PrismaClient } from "@prisma/client";
import { teams } from "../data/worldcup2026";

const prisma = new PrismaClient();

async function main() {
  for (const t of teams) {
    await prisma.team.upsert({
      where: { code: t.code },
      update: { name: t.name, group: t.group },
      create: { code: t.code, name: t.name, group: t.group },
    });
  }
  console.log(`Seeded ${teams.length} teams.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
