import { PrismaClient } from "@prisma/client";
import { seedSampleData } from "../src/lib/sample-data.js";

const prisma = new PrismaClient();

async function main() {
  const summary = await seedSampleData(prisma);
  console.log("Datos demo cargados:", summary);
}

main()
  .catch((error) => {
    console.error("Error al ejecutar el seeder demo:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
