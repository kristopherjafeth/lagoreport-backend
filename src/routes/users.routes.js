import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";

const router = Router();
const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

const allowedStatuses = new Set(["active", "inactive", "suspended"]);
const DEFAULT_ROLE_SLUG = "user";

const normalizeRoleSlug = (value) => {
  if (value === undefined || value === null) return null;
  return `${value}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "");
};

const fetchRoleOrThrow = async (slug, { allowNull = false } = {}) => {
  const normalized = normalizeRoleSlug(slug);

  if (!normalized) {
    if (allowNull) {
      return null;
    }
    const fallback = await prisma.role.findUnique({ where: { slug: DEFAULT_ROLE_SLUG } });
    if (!fallback) {
      throw new Error("Default role is not configured");
    }
    return fallback;
  }

  const role = await prisma.role.findUnique({ where: { slug: normalized } });
  if (!role) {
    const error = new Error(`Role '${normalized}' not found`);
    error.code = "ROLE_NOT_FOUND";
    throw error;
  }
  return role;
};

const mapUser = (user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  name: `${user.firstName} ${user.lastName}`.trim(),
  email: user.email,
  role: user.role?.slug ?? user.roleKey ?? DEFAULT_ROLE_SLUG,
  roleId: user.role?.id ?? null,
  roleName: user.role?.name ?? null,
  roleDescription: user.role?.description ?? null,
  rolePermissions: Array.isArray(user.role?.permissions)
    ? user.role.permissions
    : user.role?.permissions && typeof user.role.permissions === "object"
    ? Object.values(user.role.permissions)
    : [],
  plan: user.plan,
  status: user.status,
  devices: user.devices,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  avatar: user.avatarUrl ?? null,
  phoneNumber: user.phoneNumber ?? null,
});

const parseDevices = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const numeric = Number.parseInt(value, 10);
  if (Number.isNaN(numeric) || numeric < 0) {
    throw new Error("devices must be a non-negative integer");
  }
  return numeric;
};

const parseDate = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date format for lastLogin");
  }
  return date;
};

const normalizeStatus = (value, fallback = "active") => {
  if (!value) return fallback;
  const normalized = `${value}`.toLowerCase().trim();
  return allowedStatuses.has(normalized) ? normalized : fallback;
};

const sanitizePlan = (value, fallback = "Básico") => {
  if (!value) return fallback;
  const plan = `${value}`.trim();
  return plan.length ? plan : fallback;
};

router.get("/", async (req, res) => {
  try {
    const { search, role, status } = req.query;

    const where = {};

    if (search && `${search}`.trim()) {
      const term = `${search}`.trim();
      where.OR = [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ];
    }

    if (role && role !== "all") {
      const normalizedRole = normalizeRoleSlug(role);
      if (normalizedRole) {
        where.roleKey = normalizedRole;
      }
    }

    if (status && status !== "all") {
      where.status = normalizeStatus(status);
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { role: true },
    });

    res.json(users.map(mapUser));
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Unable to fetch users" });
  }
});

router.get("/:id", async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(mapUser(user));
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Unable to fetch user" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      plan,
      status,
      devices,
      lastLogin,
      avatar,
      phoneNumber,
    } = req.body ?? {};

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: "Fields 'firstName', 'lastName' and 'email' are required" });
    }

    const normalizedEmail = `${email}`.trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: "A user with that email already exists" });
    }

    const passwordSource = password && `${password}`.trim().length >= 6 ? `${password}`.trim() : crypto.randomBytes(12).toString("hex");
    const hashedPassword = await bcrypt.hash(passwordSource, SALT_ROUNDS);

    let lastLoginDate = null;
    try {
      lastLoginDate = lastLogin ? parseDate(lastLogin) : new Date();
    } catch (dateError) {
      return res.status(400).json({ error: dateError.message });
    }

    let devicesValue = 0;
    try {
      devicesValue = parseDevices(devices, 0);
    } catch (parseError) {
      return res.status(400).json({ error: parseError.message });
    }

    let roleRecord;
    try {
      roleRecord = await fetchRoleOrThrow(role);
    } catch (roleError) {
      const statusCode = roleError.code === "ROLE_NOT_FOUND" ? 400 : 500;
      return res.status(statusCode).json({ error: roleError.message });
    }

    const newUser = await prisma.user.create({
      data: {
        firstName: `${firstName}`.trim(),
        lastName: `${lastName}`.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        plan: sanitizePlan(plan),
        status: normalizeStatus(status),
        devices: devicesValue,
        lastLogin: lastLoginDate,
        avatarUrl: avatar ? `${avatar}`.trim() : null,
        phoneNumber: phoneNumber ? `${phoneNumber}`.trim() || null : null,
        role: {
          connect: { slug: roleRecord.slug },
        },
      },
      include: { role: true },
    });

    res.status(201).json(mapUser(newUser));
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: error.message || "Unable to create user" });
  }
});

router.put("/:id", async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
  const existing = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const {
      firstName,
      lastName,
      email,
      password,
      role,
      plan,
      status,
      devices,
      lastLogin,
      avatar,
      phoneNumber,
    } = req.body ?? {};

    const data = {};

    if (firstName !== undefined) {
      data.firstName = `${firstName}`.trim();
    }

    if (lastName !== undefined) {
      data.lastName = `${lastName}`.trim();
    }

    if (email !== undefined) {
      const normalizedEmail = `${email}`.trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({ error: "Email cannot be empty" });
      }
      if (normalizedEmail !== existing.email) {
        const conflict = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (conflict && conflict.id !== userId) {
          return res.status(409).json({ error: "Another user with that email already exists" });
        }
      }
      data.email = normalizedEmail;
    }

    if (password !== undefined) {
      if (password && `${password}`.trim().length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      if (password) {
        data.password = await bcrypt.hash(`${password}`.trim(), SALT_ROUNDS);
      }
    }

    if (role !== undefined) {
      try {
        const roleRecord = await fetchRoleOrThrow(role);
        data.role = {
          connect: { slug: roleRecord.slug },
        };
      } catch (roleError) {
        const statusCode = roleError.code === "ROLE_NOT_FOUND" ? 400 : 500;
        return res.status(statusCode).json({ error: roleError.message });
      }
    }

    if (plan !== undefined) {
      data.plan = sanitizePlan(plan, existing.plan);
    }

    if (status !== undefined) {
      data.status = normalizeStatus(status, existing.status);
    }

    if (devices !== undefined) {
      try {
        data.devices = parseDevices(devices, existing.devices);
      } catch (parseError) {
        return res.status(400).json({ error: parseError.message });
      }
    }

    if (lastLogin !== undefined) {
      if (lastLogin === null || lastLogin === "") {
        data.lastLogin = null;
      } else {
        try {
          data.lastLogin = parseDate(lastLogin);
        } catch (parseError) {
          return res.status(400).json({ error: parseError.message });
        }
      }
    }

    if (avatar !== undefined) {
      data.avatarUrl = avatar ? `${avatar}`.trim() : null;
    }

    if (phoneNumber !== undefined) {
      const normalizedPhone = `${phoneNumber}`.trim();
      data.phoneNumber = normalizedPhone.length ? normalizedPhone : null;
    }

  const updated = await prisma.user.update({ where: { id: userId }, data, include: { role: true } });
    res.json(mapUser(updated));
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: error.message || "Unable to update user" });
  }
});

router.delete("/:id", async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Unable to delete user" });
  }
});

export default router;
