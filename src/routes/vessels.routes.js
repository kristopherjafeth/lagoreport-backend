import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

const normalizeString = (value) => {
  if (value === undefined || value === null) return null;
  const text = `${value}`.trim();
  return text.length ? text : null;
};

const mapVesselDocument = (document) => ({
  id: document.id,
  title: document.title,
  fileUrl: document.fileUrl,
  fileType: document.fileType || null,
  fileKey: document.fileKey || null,
  uploadedAt: document.uploadedAt,
});

const mapVessel = (vessel) => ({
  id: vessel.id,
  name: vessel.name,
  registration: vessel.registration || null,
  vesselType: vessel.vesselType || null,
  flag: vessel.flag || null,
  owner: vessel.owner || null,
  notes: vessel.notes || null,
  photoUrl: vessel.photoUrl || null,
  createdAt: vessel.createdAt,
  updatedAt: vessel.updatedAt,
  documentsCount: vessel._count?.documents ?? (Array.isArray(vessel.documents) ? vessel.documents.length : 0),
  documents: Array.isArray(vessel.documents) ? vessel.documents.map(mapVesselDocument) : undefined,
});

router.get("/", async (_req, res) => {
  try {
    const vessels = await prisma.vessel.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { documents: true } },
      },
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
  const photoUrl = normalizeString(req.body?.photoUrl);
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
        photoUrl,
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

router.get("/:id/documents", async (req, res) => {
  const vesselId = parseVesselId(req.params.id);
  if (!vesselId) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const documents = await prisma.vesselDocument.findMany({
      where: { vesselId },
      orderBy: { uploadedAt: "desc" },
    });
    return res.json(documents.map(mapVesselDocument));
  } catch (error) {
    console.error("[vessels] list documents error", error);
    return res.status(500).json({ error: "No se pudieron obtener los documentos de la embarcación" });
  }
});

router.post("/:id/documents", async (req, res) => {
  const vesselId = parseVesselId(req.params.id);
  if (!vesselId) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const vessel = await prisma.vessel.findUnique({ where: { id: vesselId }, select: { id: true } });
    if (!vessel) {
      return res.status(404).json({ error: "Embarcación no encontrada" });
    }

    const title = normalizeString(req.body?.title);
    const fileUrl = normalizeString(req.body?.fileUrl);
    const rawType = req.body?.fileType;
    const rawKey = req.body?.fileKey;

    if (!title) {
      throw new Error("El nombre del documento es obligatorio");
    }

    if (!fileUrl) {
      throw new Error("La URL del documento es obligatoria");
    }

    const document = await prisma.vesselDocument.create({
      data: {
        vesselId,
        title,
        fileUrl,
        fileType: typeof rawType === "string" ? rawType.trim() || null : null,
        fileKey: typeof rawKey === "string" ? rawKey.trim() || null : null,
      },
    });

    return res.status(201).json(mapVesselDocument(document));
  } catch (error) {
    console.error("[vessels] create document error", error);
    return res.status(400).json({ error: error?.message || "No se pudo guardar el documento" });
  }
});

router.delete("/:id/documents/:documentId", async (req, res) => {
  const vesselId = parseVesselId(req.params.id);
  const documentId = parseVesselId(req.params.documentId);

  if (!vesselId || !documentId) {
    return res.status(400).json({ error: "Identificadores inválidos" });
  }

  try {
    const document = await prisma.vesselDocument.findFirst({
      where: { id: documentId, vesselId },
    });

    if (!document) {
      return res.status(404).json({ error: "Documento no encontrado" });
    }

    await prisma.vesselDocument.delete({ where: { id: document.id } });

    return res.status(204).send();
  } catch (error) {
    console.error("[vessels] delete document error", error);
    return res.status(500).json({ error: "No se pudo eliminar el documento" });
  }
});

router.get("/:id", async (req, res) => {
  const vesselId = parseVesselId(req.params.id);
  if (!vesselId) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      include: {
        documents: {
          orderBy: { uploadedAt: "desc" },
        },
        _count: { select: { documents: true } },
      },
    });
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
  const photoUrl = normalizeString(req.body?.photoUrl);
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
        photoUrl,
      },
      include: {
        documents: {
          orderBy: { uploadedAt: "desc" },
        },
        _count: { select: { documents: true } },
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
