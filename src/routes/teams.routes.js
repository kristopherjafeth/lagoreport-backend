import { Router } from "express";
import { PrismaClient, TeamCrewRole } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

const TEAM_ROLES = new Set(Object.values(TeamCrewRole));

const buildTeamInclude = () => ({
  captains: {
    include: { captain: true },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
  },
  mariners: {
    include: { mariner: true },
    orderBy: [{ role: "asc" }, { orderIndex: "asc" }, { id: "asc" }],
  },
});

const mapCaptainOption = (captain) => ({
  id: captain.id,
  name: captain.name,
  cedula: captain.cedula,
});

const mapMarinerOption = (mariner) => ({
  id: mariner.id,
  name: mariner.name,
  cedula: mariner.cedula,
});

const mapTeamCaptain = (assignment) => ({
  id: assignment.captainId,
  name: assignment.captain?.name ?? null,
  cedula: assignment.captain?.cedula ?? null,
  isPrimary: Boolean(assignment.isPrimary),
});

const mapTeamMariner = (assignment) => ({
  id: assignment.marinerId,
  name: assignment.mariner?.name ?? null,
  cedula: assignment.mariner?.cedula ?? null,
  role: assignment.role,
  orderIndex: assignment.orderIndex,
});

const mapTeam = (team) => ({
  id: team.id,
  name: team.name,
  description: team.description || null,
  defaultCompanySupervisorName: team.defaultCompanySupervisorName || null,
  defaultClientSupervisorName: team.defaultClientSupervisorName || null,
  createdAt: team.createdAt,
  updatedAt: team.updatedAt,
  captains: Array.isArray(team.captains) ? team.captains.map(mapTeamCaptain) : [],
  mariners: Array.isArray(team.mariners) ? team.mariners.map(mapTeamMariner) : [],
});

const normalizeRequiredString = (value, fieldLabel) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new Error(`El campo "${fieldLabel}" es obligatorio`);
  }
  return normalized;
};

const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = `${value}`.trim();
  return normalized.length > 0 ? normalized : null;
};

const toInteger = (value, fieldLabel) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`El campo "${fieldLabel}" es inválido`);
  }
  return parsed;
};

const parseTeamPayload = (rawPayload) => {
  if (!rawPayload || typeof rawPayload !== "object") {
    throw new Error("Datos de equipo inválidos");
  }

  const name = normalizeRequiredString(rawPayload.name, "nombre del equipo");
  const description = normalizeOptionalString(rawPayload.description);
  const defaultCompanySupervisorName = normalizeOptionalString(rawPayload.defaultCompanySupervisorName);
  const defaultClientSupervisorName = normalizeOptionalString(rawPayload.defaultClientSupervisorName);

  const rawCaptains = Array.isArray(rawPayload.captains) ? rawPayload.captains : [];
  if (rawCaptains.length === 0) {
    throw new Error("Debes asignar al menos un capitán al equipo");
  }

  const captainAssignments = rawCaptains.map((entry, index) => {
    const sourceId = entry?.captainId ?? entry?.id;
    const captainId = toInteger(sourceId, `capitán #${index + 1}`);
    const isPrimary = Boolean(entry?.isPrimary);
    return { captainId, isPrimary };
  });

  const captainIdSet = new Set();
  captainAssignments.forEach(({ captainId }) => {
    if (captainIdSet.has(captainId)) {
      throw new Error("Los capitanes no pueden repetirse en el equipo");
    }
    captainIdSet.add(captainId);
  });

  const primaryCount = captainAssignments.filter((assignment) => assignment.isPrimary).length;
  if (primaryCount === 0) {
    captainAssignments[0].isPrimary = true;
  } else if (primaryCount > 1) {
    throw new Error("Solo un capitán puede ser marcado como principal del equipo");
  }

  const rawMariners = Array.isArray(rawPayload.mariners) ? rawPayload.mariners : [];
  const marinerAssignments = rawMariners.map((entry, index) => {
    const sourceId = entry?.marinerId ?? entry?.id;
    const marinerId = toInteger(sourceId, `tripulante #${index + 1}`);
    const roleRaw = typeof entry?.role === "string" ? entry.role.trim().toUpperCase() : "";
    if (!TEAM_ROLES.has(roleRaw)) {
      throw new Error(`El rol del tripulante #${index + 1} es inválido`);
    }
    const orderIndexValue = entry?.orderIndex ?? index;
    const orderIndex = Number.isInteger(orderIndexValue) ? orderIndexValue : Number.parseInt(orderIndexValue, 10);
    return {
      marinerId,
      role: roleRaw,
      orderIndex: Number.isInteger(orderIndex) && orderIndex >= 0 ? orderIndex : index,
    };
  });

  const marinerIdSet = new Set();
  marinerAssignments.forEach(({ marinerId }) => {
    if (marinerIdSet.has(marinerId)) {
      throw new Error("Los tripulantes no pueden repetirse en el equipo");
    }
    marinerIdSet.add(marinerId);
  });

  marinerAssignments.sort((a, b) => a.orderIndex - b.orderIndex);
  marinerAssignments.forEach((assignment, index) => {
    assignment.orderIndex = index;
  });

  return {
    name,
    description,
    defaultCompanySupervisorName,
    defaultClientSupervisorName,
    captains: captainAssignments,
    mariners: marinerAssignments,
  };
};

router.get("/dependencies", async (req, res) => {
  try {
    const [captains, mariners] = await Promise.all([
      prisma.captain.findMany({ orderBy: { name: "asc" } }),
      prisma.mariner.findMany({ orderBy: { name: "asc" } }),
    ]);

    res.json({
      captains: captains.map(mapCaptainOption),
      mariners: mariners.map(mapMarinerOption),
    });
  } catch (error) {
    console.error("[teams] dependencies error:", error);
    res.status(500).json({ error: "No se pudieron cargar las dependencias del módulo de equipos" });
  }
});

router.get("/", async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      orderBy: { name: "asc" },
      include: buildTeamInclude(),
    });

    res.json(teams.map(mapTeam));
  } catch (error) {
    console.error("[teams] list error:", error);
    res.status(500).json({ error: "No se pudo obtener la lista de equipos" });
  }
});

router.get("/:id", async (req, res) => {
  const teamId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ error: "Identificador de equipo inválido" });
  }

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: buildTeamInclude(),
    });

    if (!team) {
      return res.status(404).json({ error: "Equipo no encontrado" });
    }

    return res.json(mapTeam(team));
  } catch (error) {
    console.error("[teams] detail error:", error);
    return res.status(500).json({ error: "No se pudo obtener la información del equipo" });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = parseTeamPayload(req.body);
    const uniqueCaptainIds = [...new Set(payload.captains.map((assignment) => assignment.captainId))];
    const uniqueMarinerIds = [...new Set(payload.mariners.map((assignment) => assignment.marinerId))];

    const [captains, mariners] = await Promise.all([
      uniqueCaptainIds.length > 0
        ? prisma.captain.findMany({ where: { id: { in: uniqueCaptainIds } } })
        : Promise.resolve([]),
      uniqueMarinerIds.length > 0
        ? prisma.mariner.findMany({ where: { id: { in: uniqueMarinerIds } } })
        : Promise.resolve([]),
    ]);

    if (captains.length !== uniqueCaptainIds.length) {
      throw new Error("Algunos capitanes seleccionados no existen");
    }

    if (uniqueMarinerIds.length > 0 && mariners.length !== uniqueMarinerIds.length) {
      throw new Error("Algunos tripulantes seleccionados no existen");
    }

    const createdTeam = await prisma.$transaction(async (tx) => {
      const teamRecord = await tx.team.create({
        data: {
          name: payload.name,
          description: payload.description,
          defaultCompanySupervisorName: payload.defaultCompanySupervisorName,
          defaultClientSupervisorName: payload.defaultClientSupervisorName,
        },
      });

      await Promise.all(
        payload.captains.map((assignment) =>
          tx.teamCaptain.create({
            data: {
              teamId: teamRecord.id,
              captainId: assignment.captainId,
              isPrimary: assignment.isPrimary,
            },
          })
        )
      );

      if (payload.mariners.length > 0) {
        await Promise.all(
          payload.mariners.map((assignment) =>
            tx.teamMariner.create({
              data: {
                teamId: teamRecord.id,
                marinerId: assignment.marinerId,
                role: assignment.role,
                orderIndex: assignment.orderIndex,
              },
            })
          )
        );
      }

      return tx.team.findUnique({
        where: { id: teamRecord.id },
        include: buildTeamInclude(),
      });
    });

    if (!createdTeam) {
      throw new Error("No se pudo crear el equipo");
    }

    return res.status(201).json(mapTeam(createdTeam));
  } catch (error) {
    console.error("[teams] create error:", error);
    return res.status(400).json({ error: error.message || "No se pudo crear el equipo" });
  }
});

router.put("/:id", async (req, res) => {
  const teamId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ error: "Identificador de equipo inválido" });
  }

  try {
    const existingTeam = await prisma.team.findUnique({ where: { id: teamId } });
    if (!existingTeam) {
      return res.status(404).json({ error: "Equipo no encontrado" });
    }

    const payload = parseTeamPayload(req.body);
    const uniqueCaptainIds = [...new Set(payload.captains.map((assignment) => assignment.captainId))];
    const uniqueMarinerIds = [...new Set(payload.mariners.map((assignment) => assignment.marinerId))];

    const [captains, mariners] = await Promise.all([
      prisma.captain.findMany({ where: { id: { in: uniqueCaptainIds } } }),
      uniqueMarinerIds.length > 0
        ? prisma.mariner.findMany({ where: { id: { in: uniqueMarinerIds } } })
        : Promise.resolve([]),
    ]);

    if (captains.length !== uniqueCaptainIds.length) {
      throw new Error("Algunos capitanes seleccionados no existen");
    }

    if (uniqueMarinerIds.length > 0 && mariners.length !== uniqueMarinerIds.length) {
      throw new Error("Algunos tripulantes seleccionados no existen");
    }

    const updatedTeam = await prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { id: teamId },
        data: {
          name: payload.name,
          description: payload.description,
          defaultCompanySupervisorName: payload.defaultCompanySupervisorName,
          defaultClientSupervisorName: payload.defaultClientSupervisorName,
        },
      });

      const [existingCaptains, existingMariners] = await Promise.all([
        tx.teamCaptain.findMany({ where: { teamId } }),
        tx.teamMariner.findMany({ where: { teamId } }),
      ]);

      const incomingCaptainsMap = new Map(payload.captains.map((assignment) => [assignment.captainId, assignment]));
      const incomingMarinersMap = new Map(payload.mariners.map((assignment) => [assignment.marinerId, assignment]));

      await Promise.all(
        existingCaptains
          .filter((record) => !incomingCaptainsMap.has(record.captainId))
          .map((record) => tx.teamCaptain.delete({ where: { id: record.id } }))
      );

      await Promise.all(
        payload.captains.map(async (assignment) => {
          const current = existingCaptains.find((record) => record.captainId === assignment.captainId);
          if (current) {
            if (current.isPrimary !== assignment.isPrimary) {
              await tx.teamCaptain.update({
                where: { id: current.id },
                data: { isPrimary: assignment.isPrimary },
              });
            }
          } else {
            await tx.teamCaptain.create({
              data: {
                teamId,
                captainId: assignment.captainId,
                isPrimary: assignment.isPrimary,
              },
            });
          }
        })
      );

      await Promise.all(
        existingMariners
          .filter((record) => !incomingMarinersMap.has(record.marinerId))
          .map((record) => tx.teamMariner.delete({ where: { id: record.id } }))
      );

      await Promise.all(
        payload.mariners.map(async (assignment) => {
          const current = existingMariners.find((record) => record.marinerId === assignment.marinerId);
          if (current) {
            if (current.role !== assignment.role || current.orderIndex !== assignment.orderIndex) {
              await tx.teamMariner.update({
                where: { id: current.id },
                data: {
                  role: assignment.role,
                  orderIndex: assignment.orderIndex,
                },
              });
            }
          } else {
            await tx.teamMariner.create({
              data: {
                teamId,
                marinerId: assignment.marinerId,
                role: assignment.role,
                orderIndex: assignment.orderIndex,
              },
            });
          }
        })
      );

      return tx.team.findUnique({
        where: { id: teamId },
        include: buildTeamInclude(),
      });
    });

    if (!updatedTeam) {
      throw new Error("No se pudo actualizar el equipo");
    }

    return res.json(mapTeam(updatedTeam));
  } catch (error) {
    console.error("[teams] update error:", error);
    return res.status(400).json({ error: error.message || "No se pudo actualizar el equipo" });
  }
});

router.delete("/:id", async (req, res) => {
  const teamId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ error: "Identificador de equipo inválido" });
  }

  try {
    await prisma.team.delete({ where: { id: teamId } });
    return res.status(204).send();
  } catch (error) {
    console.error("[teams] delete error:", error);

    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Equipo no encontrado" });
    }

    if (error?.code === "P2003") {
      return res.status(409).json({ error: "No se puede eliminar el equipo porque está vinculado a uno o más reportes" });
    }

    return res.status(500).json({ error: "No se pudo eliminar el equipo" });
  }
});

export default router;
