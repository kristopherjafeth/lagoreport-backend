import { Router } from "express";
import { PrismaClient } from "@prisma/client";

import {
  ALL_PERMISSION_VALUES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_VALUE_SET,
  SYSTEM_ROLE_SLUGS as SYSTEM_ROLE_SLUG_KEYS,
} from "../constants/permissions.js";

const router = Router();
const prisma = new PrismaClient();
const SYSTEM_ROLE_SLUGS = new Set(SYSTEM_ROLE_SLUG_KEYS);

const slugify = (value) =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ensureUniqueSlug = async (baseSlug, excludeId) => {
  if (!baseSlug) {
    throw new Error("El slug no puede estar vacío");
  }

  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await prisma.role.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) {
      return slug;
    }
    slug = `${baseSlug}-${suffix++}`;
  }
};

const normalizePermissions = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => `${item}`.trim())
      .filter(Boolean)
      .filter((item, index, array) => array.indexOf(item) === index);
  }
  if (typeof value === "string") {
    return value
      .split(/[\r?\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, array) => array.indexOf(item) === index);
  }
  if (typeof value === "object") {
    return Object.values(value || {})
      .map((item) => `${item}`.trim())
      .filter(Boolean)
      .filter((item, index, array) => array.indexOf(item) === index);
  }
  return [];
};

const mapRole = (role) => ({
  id: role.id,
  name: role.name,
  slug: role.slug,
  description: role.description ?? null,
  permissions: Array.isArray(role.permissions)
    ? role.permissions
    : role.permissions && typeof role.permissions === "object"
    ? Object.values(role.permissions)
    : [],
  usersCount: role._count?.users ?? role.usersCount ?? 0,
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
});

router.get("/permissions", (_req, res) => {
  res.json({
    groups: PERMISSION_GROUPS,
    all: ALL_PERMISSION_VALUES,
    defaults: DEFAULT_ROLE_PERMISSIONS,
  });
});

const buildSearchFilter = (search) => {
  if (!search || !`${search}`.trim()) {
    return undefined;
  }
  const term = `${search}`.trim();
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { slug: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ],
  };
};

const findRoleByIdentifier = async (identifier) => {
  const numericId = Number.parseInt(identifier, 10);
  if (!Number.isNaN(numericId)) {
    return prisma.role.findUnique({ where: { id: numericId }, include: { _count: { select: { users: true } } } });
  }
  const normalizedSlug = slugify(identifier);
  return prisma.role.findUnique({ where: { slug: normalizedSlug }, include: { _count: { select: { users: true } } } });
};

router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    const where = buildSearchFilter(search);

    const roles = await prisma.role.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { users: true } } },
    });

    res.json(roles.map(mapRole));
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ error: "Unable to fetch roles" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const role = await findRoleByIdentifier(req.params.id);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }
    res.json(mapRole(role));
  } catch (error) {
    console.error("Error fetching role:", error);
    res.status(500).json({ error: "Unable to fetch role" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, slug, description, permissions } = req.body ?? {};

    if (!name || !`${name}`.trim()) {
      return res.status(400).json({ error: "Field 'name' is required" });
    }

    const baseSlug = slugify(slug && `${slug}`.trim().length ? slug : name) || slugify(name);
    if (!baseSlug) {
      return res.status(400).json({ error: "Unable to derive a slug for the role" });
    }

    const uniqueSlug = await ensureUniqueSlug(baseSlug, undefined);
    const normalizedPermissions = normalizePermissions(permissions);
    const invalidPermissions = normalizedPermissions.filter((permission) => !PERMISSION_VALUE_SET.has(permission));

    if (invalidPermissions.length > 0) {
      return res.status(400).json({
        error: `Los siguientes permisos no son válidos: ${invalidPermissions.join(", ")}`,
        invalidPermissions,
      });
    }

    const createdRole = await prisma.role.create({
      data: {
        name: `${name}`.trim(),
        slug: uniqueSlug,
        description: description ? `${description}`.trim() : null,
        permissions: normalizedPermissions,
      },
      include: { _count: { select: { users: true } } },
    });

    res.status(201).json(mapRole(createdRole));
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "A role with the provided name or slug already exists" });
    }
    console.error("Error creating role:", error);
    res.status(500).json({ error: error.message || "Unable to create role" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const currentRole = await findRoleByIdentifier(req.params.id);
    if (!currentRole) {
      return res.status(404).json({ error: "Role not found" });
    }

    const { name, slug, description, permissions } = req.body ?? {};
    const data = {};

    if (name !== undefined) {
      const trimmedName = `${name}`.trim();
      if (!trimmedName) {
        return res.status(400).json({ error: "Field 'name' cannot be empty" });
      }
      data.name = trimmedName;
    }

    if (slug !== undefined) {
      const trimmedSlug = `${slug}`.trim();
      if (!trimmedSlug) {
        return res.status(400).json({ error: "Field 'slug' cannot be empty" });
      }
      const baseSlug = slugify(trimmedSlug);
      data.slug = await ensureUniqueSlug(baseSlug, currentRole.id);
    } else if (name !== undefined) {
      const baseSlug = slugify(name);
      if (baseSlug) {
        data.slug = await ensureUniqueSlug(baseSlug, currentRole.id);
      }
    }

    if (description !== undefined) {
      data.description = description ? `${description}`.trim() : null;
    }

    if (permissions !== undefined) {
      const normalizedPermissions = normalizePermissions(permissions);
      const invalidPermissions = normalizedPermissions.filter((permission) => !PERMISSION_VALUE_SET.has(permission));

      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          error: `Los siguientes permisos no son válidos: ${invalidPermissions.join(", ")}`,
          invalidPermissions,
        });
      }

      data.permissions = normalizedPermissions;
    }

    const updatedRole = await prisma.role.update({
      where: { id: currentRole.id },
      data,
      include: { _count: { select: { users: true } } },
    });

    res.json(mapRole(updatedRole));
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "A role with the provided name or slug already exists" });
    }
    console.error("Error updating role:", error);
    res.status(500).json({ error: error.message || "Unable to update role" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const role = await findRoleByIdentifier(req.params.id);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    if (SYSTEM_ROLE_SLUGS.has(role.slug)) {
      return res.status(400).json({ error: "System roles cannot be removed" });
    }

    if (role._count?.users) {
      return res.status(409).json({ error: "Cannot delete role with assigned users" });
    }

    await prisma.role.delete({ where: { id: role.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({ error: "Unable to delete role" });
  }
});

export default router;
