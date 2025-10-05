import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

const normalizeString = (value) => {
  if (value === undefined || value === null) return null;
  const text = `${value}`.trim();
  return text.length ? text : null;
};

const mapVessel = (vessel) => ({
  id: vessel.id,
  name: vessel.name,
  registration: vessel.registration || null,
  vesselType: vessel.vesselType || null,
  flag: vessel.flag || null,
  owner: vessel.owner || null,
  notes: vessel.notes || null,
  createdAt: vessel.createdAt,
  updatedAt: vessel.updatedAt,
});

router.get("/", async (_req, res) => {
  try {
    const vessels = await prisma.vessel.findMany({
      orderBy: { name: "asc" },
    });

    return res.json(vessels.map(mapVessel));
  } catch (error) {
    console.error("[vessels] list error", error);
    return res.status(500).json({ error: "No se pudo obtener la lista de embarcaciones" });
  }
});

router.post("/", async (req, res) => {
  try {
    const name = normalizeString(req.body?.name);
    const registration = normalizeString(req.body?.registration);
    const vesselType = normalizeString(req.body?.vesselType);
    const flag = normalizeString(req.body?.flag);
    const owner = normalizeString(req.body?.owner);
    const notes = normalizeString(req.body?.notes);

    if (!name) {
      throw new Error("El nombre de la embarcación es obligatorio");
    }

    const vessel = await prisma.vessel.create({
      data: {
        name,
        registration,
        vesselType,
        flag,
        owner,
        notes,
      },
    });

    return res.status(201).json(mapVessel(vessel));
  } catch (error) {
    console.error("[vessels] create error", error);

    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Ya existe una embarcación con esa matrícula" });
    }

    return res.status(400).json({ error: error?.message || "No se pudo crear la embarcación" });
  }
});

const parseVesselId = (rawId) => {
  const parsed = Number.parseInt(rawId, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

router.get("/:id", async (req, res) => {
  const vesselId = parseVesselId(req.params.id);
  if (!vesselId) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const vessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
    if (!vessel) {
      return res.status(404).json({ error: "Embarcación no encontrada" });
    }

    return res.json(mapVessel(vessel));
  } catch (error) {
    console.error("[vessels] get error", error);
    return res.status(500).json({ error: "No se pudo obtener la embarcación" });
  }
});

router.put("/:id", async (req, res) => {
  const vesselId = parseVesselId(req.params.id);
  if (!vesselId) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const existing = await prisma.vessel.findUnique({ where: { id: vesselId } });
    if (!existing) {
      return res.status(404).json({ error: "Embarcación no encontrada" });
    }

    const name = normalizeString(req.body?.name);
    const registration = normalizeString(req.body?.registration);
    const vesselType = normalizeString(req.body?.vesselType);
    const flag = normalizeString(req.body?.flag);
    const owner = normalizeString(req.body?.owner);
    const notes = normalizeString(req.body?.notes);

    if (!name) {
      throw new Error("El nombre de la embarcación es obligatorio");
    }

    const updated = await prisma.vessel.update({
      where: { id: vesselId },
      data: {
        name,
        registration,
        vesselType,
        flag,
        owner,
        notes,
      },
    });

    return res.json(mapVessel(updated));
  } catch (error) {
    console.error("[vessels] update error", error);

    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Ya existe una embarcación con esa matrícula" });
    }

    return res.status(400).json({ error: error?.message || "No se pudo actualizar la embarcación" });
  }
});

router.delete("/:id", async (req, res) => {
  const vesselId = parseVesselId(req.params.id);
  if (!vesselId) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    await prisma.vessel.delete({ where: { id: vesselId } });
    return res.status(204).send();
  } catch (error) {
    console.error("[vessels] delete error", error);
    return res.status(500).json({ error: "No se pudo eliminar la embarcación" });
  }
});

export default router;
