import { Router } from "express"
import { PrismaClient } from "@prisma/client"

const router = Router()
const prisma = new PrismaClient()

const mapPlan = (plan) => ({
  id: plan.id,
  name: plan.name,
  slug: plan.slug,
  price: Number(plan.price),
  period: plan.period,
  description: plan.description,
  features: Array.isArray(plan.features) ? plan.features : [],
  icon: plan.icon,
  active: plan.active,
  subscribers: plan.subscribers,
  revenue: Number(plan.revenue),
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
})

const slugifyName = (name) =>
  name
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const ensureUniqueSlug = async (baseSlug, excludeId) => {
  let slug = baseSlug
  let suffix = 1

  while (true) {
    const existing = await prisma.plan.findUnique({ where: { slug } })
    if (!existing || existing.id === excludeId) {
      return slug
    }
    slug = `${baseSlug}-${suffix++}`
  }
}

const normalizeFeatures = (value, fallback = []) => {
  if (Array.isArray(value)) {
    return value.map((item) => `${item}`.trim()).filter(Boolean)
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (value && typeof value === "object") {
    return Object.values(value)
      .map((item) => `${item}`.trim())
      .filter(Boolean)
  }
  return fallback
}

const normalizeBoolean = (value, fallback) => {
  if (value === undefined || value === null) return fallback
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    if (["true", "1", "yes", "on"].includes(value.toLowerCase())) return true
    if (["false", "0", "no", "off"].includes(value.toLowerCase())) return false
  }
  if (typeof value === "number") {
    if (value === 1) return true
    if (value === 0) return false
  }
  return fallback
}

const parseDecimal = (value, field, { required = false, defaultValue = 0 } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new Error(`${field} is required`)
    }
    return defaultValue
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    throw new Error(`${field} must be a numeric value`)
  }
  return numeric
}

const parseInteger = (value, field, { required = false, defaultValue = 0 } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new Error(`${field} is required`)
    }
    return defaultValue
  }

  const numeric = Number.parseInt(value, 10)
  if (Number.isNaN(numeric)) {
    throw new Error(`${field} must be an integer value`)
  }
  return numeric
}

router.get("/", async (_req, res) => {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { createdAt: "asc" } })
    res.json(plans.map(mapPlan))
  } catch (error) {
    console.error("Error fetching plans:", error)
    res.status(500).json({ error: "Unable to fetch plans" })
  }
})

router.get("/:id", async (req, res) => {
  const planId = Number.parseInt(req.params.id, 10)
  if (Number.isNaN(planId)) {
    return res.status(400).json({ error: "Invalid plan id" })
  }

  try {
    const plan = await prisma.plan.findUnique({ where: { id: planId } })
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" })
    }
    res.json(mapPlan(plan))
  } catch (error) {
    console.error("Error fetching plan:", error)
    res.status(500).json({ error: "Unable to fetch plan" })
  }
})

router.post("/", async (req, res) => {
  try {
    const { name, price, period, description, features, icon, active, subscribers, revenue } = req.body

    if (!name || price === undefined || price === null || !period || !description) {
      return res.status(400).json({
        error: "Fields 'name', 'price', 'period' and 'description' are required",
      })
    }

    const baseSlugValue = slugifyName(name) || "plan"
    const priceValue = parseDecimal(price, "price", { required: true })
    const revenueValue = parseDecimal(revenue, "revenue", { defaultValue: 0 })
    const subscribersValue = parseInteger(subscribers, "subscribers", { defaultValue: 0 })
    const activeValue = normalizeBoolean(active, true)
    const normalizedFeatures = normalizeFeatures(features)
    const slug = await ensureUniqueSlug(baseSlugValue, undefined)

    const newPlan = await prisma.plan.create({
      data: {
        name: name.trim(),
        slug,
        price: priceValue,
        period: period.trim(),
        description: description.trim(),
        features: normalizedFeatures,
        icon: icon ? icon.trim() : "zap",
        active: activeValue ?? true,
        subscribers: subscribersValue,
        revenue: revenueValue,
      },
    })

    res.status(201).json(mapPlan(newPlan))
  } catch (error) {
    console.error("Error creating plan:", error)
    res.status(500).json({ error: error.message || "Unable to create plan" })
  }
})

router.put("/:id", async (req, res) => {
  const planId = Number.parseInt(req.params.id, 10)
  if (Number.isNaN(planId)) {
    return res.status(400).json({ error: "Invalid plan id" })
  }

  try {
    const existingPlan = await prisma.plan.findUnique({ where: { id: planId } })
    if (!existingPlan) {
      return res.status(404).json({ error: "Plan not found" })
    }

    const { name, price, period, description, features, icon, active, subscribers, revenue } = req.body

    const data = {}

    if (name) {
      data.name = name.trim()
      const slugBase = slugifyName(name) || "plan"
      data.slug = await ensureUniqueSlug(slugBase, planId)
    }

    if (price !== undefined) {
      data.price = parseDecimal(price, "price")
    }

    if (period) {
      data.period = period.trim()
    }

    if (description) {
      data.description = description.trim()
    }

    if (features !== undefined) {
      data.features = normalizeFeatures(features, existingPlan.features)
    }

    if (icon) {
      data.icon = icon.trim()
    }

    if (active !== undefined) {
      data.active = normalizeBoolean(active, existingPlan.active)
    }

    if (subscribers !== undefined) {
      data.subscribers = parseInteger(subscribers, "subscribers")
    }

    if (revenue !== undefined) {
      data.revenue = parseDecimal(revenue, "revenue")
    }

    const updatedPlan = await prisma.plan.update({
      where: { id: planId },
      data,
    })

    res.json(mapPlan(updatedPlan))
  } catch (error) {
    console.error("Error updating plan:", error)
    res.status(500).json({ error: error.message || "Unable to update plan" })
  }
})

router.delete("/:id", async (req, res) => {
  const planId = Number.parseInt(req.params.id, 10)
  if (Number.isNaN(planId)) {
    return res.status(400).json({ error: "Invalid plan id" })
  }

  try {
    await prisma.plan.delete({ where: { id: planId } })
    res.status(204).send()
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Plan not found" })
    }
    console.error("Error deleting plan:", error)
    res.status(500).json({ error: "Unable to delete plan" })
  }
})

export default router
