import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';
import { sendTwoFactorCodeEmail } from '../lib/mailer.js';

// Util para generar código 2FA de 6 dígitos
function generateSixDigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash simple (sha256) para no guardar el código plano
function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Registro
router.post('/register', async (req, res) => {
  console.log('POST /register - body:', req.body);
  const { email, password, firstName, lastName } = req.body;
  if (!email || !password || !firstName || !lastName) {
    console.log('Faltan campos en el registro');
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      console.log('Correo ya registrado:', email);
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hash, firstName, lastName },
    });
    console.log('Usuario creado:', user);
    res.status(201).json({ id: user.id, email: user.email });
  } catch (e) {
    console.error('Error en el registro:', e);
    res.status(500).json({ error: 'Error en el registro' });
  }
});

// Memoria simple para limitar reenvíos e intentos (reinicia al reiniciar el proceso)
const resendCounters = new Map(); // key: userId value: { count, firstAt }
const MAX_RESENDS = 3;
const RESEND_WINDOW_MS = 10 * 60 * 1000; // 10 minutos

function canResend(userId) {
  const now = Date.now();
  const item = resendCounters.get(userId);
  if (!item) {
    resendCounters.set(userId, { count: 1, firstAt: now });
    return true;
  }
  if (now - item.firstAt > RESEND_WINDOW_MS) {
    // ventana expirada, reiniciar
    resendCounters.set(userId, { count: 1, firstAt: now });
    return true;
  }
  if (item.count >= MAX_RESENDS) return false;
  item.count += 1;
  return true;
}

// Login
router.post('/login', async (req, res) => {
  console.log('POST /login - body:', req.body);
  const { email, password } = req.body;
  if (!email || !password) {
    console.log('Faltan campos en el login');
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('Usuario no encontrado:', email);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.log('Contraseña incorrecta para:', email);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    // Flujo 2FA: generar código, guardar y enviar (simulado)
    const code = generateSixDigitCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
    await prisma.twoFactorCode.create({
      data: {
        codeHash,
        expiresAt,
        userId: user.id,
      }
    });
  console.log(`Codigo 2FA para ${email}: ${code} (expira ${expiresAt.toISOString()})`);
  // Enviar correo (o fallback consola)
  await sendTwoFactorCodeEmail({ to: email, code });
    // Emitimos un tempToken corto (solo para verificar 2FA)
    const tempToken = jwt.sign({ userId: user.id, stage: '2fa' }, JWT_SECRET, { expiresIn: '10m' });
    res.json({ twoFactorRequired: true, tempToken });
  } catch (e) {
    console.error('Error en el login:', e);
    res.status(500).json({ error: 'Error en el login' });
  }
});

// Verificar código 2FA
router.post('/verify-2fa', async (req, res) => {
  const { code } = req.body;
  const authHeader = req.headers['authorization'];
  const tempToken = authHeader && authHeader.split(' ')[1];
  if (!code || !tempToken) {
    return res.status(400).json({ error: 'Código y tempToken requeridos' });
  }
  try {
    let payload;
    try {
      payload = jwt.verify(tempToken, JWT_SECRET);
    } catch (_) {
      return res.status(401).json({ error: 'Temp token inválido o expirado' });
    }
    if (payload.stage !== '2fa') {
      return res.status(400).json({ error: 'Estado inválido para 2FA' });
    }
    const userId = payload.userId;
    const codeHash = hashCode(code);
    const record = await prisma.twoFactorCode.findFirst({
      where: {
        userId,
        codeHash,
        used: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { id: 'desc' }
    });
    if (!record) {
      return res.status(401).json({ error: 'Código inválido o expirado' });
    }
    // Marcar como usado
    await prisma.twoFactorCode.update({ where: { id: record.id }, data: { used: true } });
    // Emitir token final
    const finalToken = jwt.sign({ userId, email: (await prisma.user.findUnique({ where: { id: userId } })).email }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token: finalToken });
  } catch (e) {
    console.error('Error en verify-2fa:', e);
    res.status(500).json({ error: 'Error verificando 2FA' });
  }
});

// Reenviar código 2FA mientras siga vigente el tempToken (estado stage: '2fa')
router.post('/resend-2fa', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const tempToken = authHeader && authHeader.split(' ')[1];
  if (!tempToken) {
    return res.status(400).json({ error: 'Temp token requerido' });
  }
  let payload;
  try {
    payload = jwt.verify(tempToken, JWT_SECRET);
  } catch (_) {
    return res.status(401).json({ error: 'Temp token inválido o expirado' });
  }
  if (payload.stage !== '2fa') {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const userId = payload.userId;
  // Rate limiting simple
  if (!canResend(userId)) {
    return res.status(429).json({ error: 'Límite de reenvíos alcanzado, espera unos minutos' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    // Invalidar códigos anteriores pendientes (opcional: marcarlos usados)
    await prisma.twoFactorCode.updateMany({
      where: { userId, used: false, expiresAt: { gt: new Date() } },
      data: { used: true }
    });
    // Generar nuevo
    const newCode = generateSixDigitCode();
    const codeHash = hashCode(newCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.twoFactorCode.create({ data: { codeHash, expiresAt, userId } });
    console.log(`(Reenvío) Codigo 2FA para ${user.email}: ${newCode} (expira ${expiresAt.toISOString()})`);
    await sendTwoFactorCodeEmail({ to: user.email, code: newCode });
    res.json({ message: 'Código reenviado' });
  } catch (e) {
    console.error('Error en /resend-2fa:', e);
    res.status(500).json({ error: 'Error reenviando código' });
  }
});

// Logout (solo frontend borra el token, pero endpoint para compatibilidad)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout exitoso (el frontend debe borrar el token)' });
});

// Ruta protegida para obtener datos del usuario autenticado
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        role: true,
        avatarUrl: true,
        phoneNumber: true,
      },
    });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ user });
  } catch (e) {
    console.error('Error en /me:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
