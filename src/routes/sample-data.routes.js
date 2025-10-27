import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { clearSampleData, getSampleDataStatus, seedSampleData } from "../lib/sample-data.js";

const router = Router();
const prisma = new PrismaClient();

router.get("/", async (req, res) => {
  try {
    const status = await getSampleDataStatus(prisma);
    res.json(status);
  } catch (error) {
    console.error("[sample-data] status error", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "No se pudo obtener el estado de los datos demo" });
  }
});

router.post("/fill", async (req, res) => {
  try {
    const summary = await seedSampleData(prisma);
    res.json({
      message: "Datos de ejemplo generados correctamente",
      summary
    });
  } catch (error) {
    console.error("[sample-data] seed error", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "No se pudieron crear los datos demo" });
  }
});

router.post("/clear", async (req, res) => {
  try {
    await clearSampleData(prisma);
    res.json({
      message: "Datos de ejemplo eliminados",
      summary: {
        vesselCount: 0,
        captainCount: 0,
        customerCount: 0,
        reportCount: 0
      }
    });
  } catch (error) {
    console.error("[sample-data] clear error", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "No se pudieron eliminar los datos demo" });
  }
});

export default router;
