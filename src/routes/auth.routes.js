import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { generateUniqueTwoFactorCode } from '../lib/twoFactor.js';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const DEFAULT_ROLE_SLUG = 'user';

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
    const twoFactorCode = await generateUniqueTwoFactorCode(prisma);
    const user = await prisma.user.create({
      data: {
        email,
        password: hash,
        firstName,
        lastName,
        role: {
          connect: { slug: DEFAULT_ROLE_SLUG },
        },
        twoFactorCode,
      },
    });
    console.log('Usuario creado:', user);
    res.status(201).json({ id: user.id, email: user.email });
  } catch (e) {
    console.error('Error en el registro:', e);
    res.status(500).json({ error: 'Error en el registro' });
  }
});

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
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ twoFactorRequired: false, token });
  } catch (e) {
    console.error('Error en el login:', e);
    res.status(500).json({ error: 'Error en el login' });
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
