import { Router } from "express";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { presetName, payload } = req.body ?? {};

    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Se requiere un payload JSON válido" });
    }

    res.status(200).json({
      message: "Comando recibido",
      presetName: presetName ?? null,
      receivedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error procesando comando:", error);
    res.status(500).json({ error: "No se pudo procesar el comando" });
  }
});

export default router;
