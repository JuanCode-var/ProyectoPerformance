// server/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import User, { type UserRole } from '../database/user.js';
import { signToken, JWT_SECRET } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

const COOKIE_NAME = process.env.COOKIE_NAME || 'perf_token';
const IN_PROD = process.env.NODE_ENV === 'production';
const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/; // validación básica

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password, role, title } = (req.body || {}) as {
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
      title?: string;
    };

    if (!name || !email || !password) return res.status(400).json({ error: 'Faltan campos' });

    const normEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normEmail)) return res.status(400).json({ error: 'Email inválido' });

    const exists = await User.findOne({ email: normEmail });
    if (exists) return res.status(409).json({ error: 'El correo ya está registrado' });

    const passwordHash = await bcrypt.hash(password, 10);

    // Por ahora aceptamos el rol enviado en registro (si es válido). Luego podrás restringir según políticas.
    let finalRole: UserRole = 'cliente';
    const allowed: UserRole[] = ['admin','operario','tecnico','otro_tecnico','cliente'];
    if (role && allowed.includes(role)) finalRole = role;
    const creatorPrivileged = false;

    const user = await User.create({ name, email: normEmail, passwordHash, role: finalRole, title });

    // Mongoose tipa _id como unknown en TS 5 + Mongoose 8; usar .id (string) o forzar a string
    const userId: string = (user as any).id ?? String((user as any)._id);

    // If public self-registration, start session as the new user. If an authenticated privileged user created this, do not swap their session.
    if (!creatorPrivileged) {
      const token = signToken({ _id: userId, name: user.name, email: user.email, role: user.role });
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: IN_PROD,
        sameSite: IN_PROD ? 'lax' : 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });
      // También devolvemos el token para clientes SPA como respaldo (dev/proxy)
      return res.status(201).json({ ok: true, token, user: { _id: userId, name: user.name, email: user.email, role: user.role, title: user.title } });
    }

    return res.status(201).json({ ok: true, user: { _id: userId, name: user.name, email: user.email, role: user.role, title: user.title } });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Error al registrar' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string };
    console.log('[auth/login] attempt', email);
    if (!email || !password) return res.status(400).json({ error: 'Faltan credenciales' });

    const normEmail = email.trim().toLowerCase();
    // RELAX: no rechazamos por regex aquí para permitir cuentas históricas mal formadas
    // if (!EMAIL_REGEX.test(normEmail)) return res.status(401).json({ error: 'Credenciales inválidas' });

    let user = await User.findOne({ email: normEmail });
    if (!user) {
      // fallback legacy: buscar exactamente lo que ingresó (trim), por si el email viejo quedó con TLD raro
      const rawTrim = email.trim();
      if (rawTrim !== normEmail) {
        user = await User.findOne({ email: rawTrim });
      }
    }
    if (!user || !user.isActive) return res.status(401).json({ error: 'Credenciales inválidas' });

    if (REQUIRE_EMAIL_VERIFICATION && !user.emailVerified) {
      return res.status(403).json({ error: 'Debes verificar tu correo antes de iniciar sesión' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    user.lastLogin = new Date();
    await user.save();

    // Derivar string id seguro para JWT y respuesta
    const userId: string = (user as any).id ?? String((user as any)._id);

    const token = signToken({ _id: userId, name: user.name, email: user.email, role: user.role });
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: IN_PROD,
      sameSite: IN_PROD ? 'lax' : 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });
    console.log('[auth/login] success set cookie for', user.email, 'normEmail=', normEmail);

    // Devolver también el token para permitir Authorization Bearer en el frontend (respaldo)
    return res.json({ ok: true, token, user: { _id: userId, name: user.name, email: user.email, role: user.role, title: user.title } });
  } catch (e: any) {
    console.error('[auth/login] error', e);
    return res.status(500).json({ error: e?.message || 'Error al iniciar sesión' });
  }
}

export async function me(req: Request, res: Response) {
  try {
    const u = req.user;
    if (!u) {
      console.log('[auth/me] no user (401)');
      return res.status(401).json({ error: 'No autenticado' });
    }
    console.log('[auth/me] ok user', u.email);
    return res.json({ ok: true, user: u });
  } catch (e) {
    console.error('[auth/me] error', e);
    return res.status(500).json({ error: 'Error' });
  }
}

export async function logout(_req: Request, res: Response) {
  const cookieName = COOKIE_NAME;
  res.clearCookie(cookieName, { path: '/' });
  return res.json({ ok: true });
}

// ---------- Password recovery ----------
export async function requestPasswordReset(req: Request, res: Response) {
  try {
    const { email } = (req.body || {}) as { email?: string };
    if (!email) return res.status(400).json({ error: 'Falta email' });

    const user = await User.findOne({ email });
    if (!user) return res.json({ ok: true }); // do not reveal

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 30); // 30m
    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();

    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    const link = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER as string, pass: process.env.EMAIL_PASS as string },
      });
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Recuperar contraseña',
        html: `<p>Para restablecer tu contraseña, haz clic en el siguiente enlace:</p><p><a href="${link}">Restablecer contraseña</a></p><p>Este enlace expira en 30 minutos.</p>`,
      });
    }

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Error al solicitar recuperación' });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { email, token, password } = (req.body || {}) as { email?: string; token?: string; password?: string };
    if (!email || !token || !password) return res.status(400).json({ error: 'Faltan parámetros' });

    const user = await User.findOne({ email, resetPasswordToken: token, resetPasswordExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ error: 'Token inválido o expirado' });

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Error al restablecer contraseña' });
  }
}

// ---------- Optional email verification ----------
export async function requestEmailVerification(req: Request, res: Response) {
  try {
    const { email } = (req.body || {}) as { email?: string };
    if (!email) return res.status(400).json({ error: 'Falta email' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.emailVerified) return res.json({ ok: true });

    const token = crypto.randomBytes(32).toString('hex');
    user.verificationToken = token;
    user.verificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60); // 1h
    await user.save();

    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    const link = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER as string, pass: process.env.EMAIL_PASS as string },
      });
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verifica tu correo',
        html: `<p>Verifica tu correo haciendo clic aquí:</p><p><a href="${link}">Verificar correo</a></p>`,
      });
    }

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Error al enviar verificación' });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const { email, token } = (req.body || {}) as { email?: string; token?: string };
    if (!email || !token) return res.status(400).json({ error: 'Faltan parámetros' });

    const user = await User.findOne({ email, verificationToken: token, verificationTokenExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ error: 'Token inválido o expirado' });

    user.emailVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Error al verificar correo' });
  }
}
