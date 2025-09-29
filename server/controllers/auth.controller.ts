// server/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import User, { type UserRole } from '../database/user.js';
import { signToken, JWT_SECRET } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import TelemetryEvent from '../database/telemetryEvent.js';
import { recordVisit } from './admin.controller.js';

const COOKIE_NAME = process.env.COOKIE_NAME || 'perf_token';
const IN_PROD = process.env.NODE_ENV === 'production';
const REQUIRE_EMAIL_VERIFICATION = false; // Deshabilitado (eliminada verificación por ahora)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/; // validación básica

function sanitizeBaseUrl(raw: string | undefined): string {
  let b = raw?.trim() || '';
  if (!b) return 'http://localhost:5173';
  // Si viene solo puerto (ej: 5173) o empieza con ':')
  if (/^:?\d{2,5}$/.test(b)) {
    b = `http://localhost:${b.replace(':','')}`;
  }
  // Si no tiene protocolo, asumir http
  if (!/^https?:\/\//i.test(b)) {
    b = 'http://' + b.replace(/^\/*/, '');
  }
  // Quitar trailing slash extra
  b = b.replace(/\/$/, '');
  return b;
}

function hrTimer() { const s = process.hrtime.bigint(); return () => Number(process.hrtime.bigint() - s)/1e6; }
const METRICS_ENABLED = process.env.METRICS_ENABLED !== 'false';
const METRICS_SAMPLE_RATE = Math.min(1, Math.max(0, Number(process.env.METRICS_SAMPLE_RATE || '1')));
async function emitTelemetry(kind: string, base: Record<string, any>) {
  try { if (!METRICS_ENABLED) return; if (METRICS_SAMPLE_RATE<1 && Math.random()>METRICS_SAMPLE_RATE) return; TelemetryEvent.create({ kind, ts:new Date(), ...base }).catch(()=>{}); } catch {}
}
function hashEmailPart(e?: string|null) { if(!e) return null; try { return crypto.createHash('sha256').update(e).digest('hex').slice(0,10);} catch { return null; } }

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
    const allowed: UserRole[] = ['admin','operario','tecnico','cliente'];
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
  const stop = hrTimer();
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
    if (!user || !user.isActive) { await emitTelemetry('auth_login_fail', { emailHash: hashEmailPart(email), reason:'not_found_or_inactive', durationMs: stop() }); return res.status(401).json({ error: 'Credenciales inválidas' }); }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) { await emitTelemetry('auth_login_fail', { emailHash: hashEmailPart(email), reason:'bad_password', durationMs: stop() }); return res.status(401).json({ error: 'Credenciales inválidas' }); }

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

    await emitTelemetry('auth_login_ok', { userId: userId, role: user.role, durationMs: stop() });
    // Registrar visita de perfil tras login (una vez por día)
    try {
      const profileRoute = user.role === 'admin' ? '/admin' : '/';
      recordVisit(profileRoute, { _id: userId, name: user.name, email: user.email, role: user.role } as any);
    } catch {}
    // Devolver también el token para permitir Authorization Bearer en el frontend (respaldo)
    return res.json({ ok: true, token, user: { _id: userId, name: user.name, email: user.email, role: user.role, title: user.title } });
  } catch (e: any) {
    await emitTelemetry('auth_login_fail', { emailHash: hashEmailPart((req.body as any)?.email), reason:'exception', durationMs: stop(), error: e?.message });
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
  const stop = hrTimer();
  try {
    const { email } = (req.body || {}) as { email?: string };
    if (!email) return res.status(400).json({ error: 'Falta email' });

    const normEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normEmail });
    if (!user) { await emitTelemetry('email.sent', { emailType:'password_reset', success:true, durationMs: stop() }); return res.json({ ok: true }); } // do not reveal

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 30); // 30m
    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();

    const baseUrl = sanitizeBaseUrl(process.env.APP_BASE_URL);
    const link = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(normEmail)}`;

    console.log('[auth/requestPasswordReset] Link generado =>', link);

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER as string, pass: process.env.EMAIL_PASS as string },
      });

      const logoDiskPath = path.join(process.cwd(), 'public', 'LogoChoucair.png');
      const hasLogo = fs.existsSync(logoDiskPath);
      const logoTag = hasLogo
        ? '<img src="cid:logoChoucair" alt="Choucair" style="max-height:64px;display:block;margin:0 auto 10px;" />'
        : '<div style="font-size:26px;font-weight:600;color:#ffffff;margin:0 0 6px 0;">Choucair</div>';

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: normEmail,
        subject: 'Solicitud de restablecimiento de contraseña',
        html: `<!DOCTYPE html>
<html lang="es">
<head><meta charSet="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Restablecer contraseña</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f5f7fa;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(90deg,#0f5132,#000);padding:28px 30px;text-align:center;">
            ${logoTag}
            <div style="font-size:11px;letter-spacing:3px;color:#d1d5db;font-weight:500;">BUSINESS CENTRIC TESTING</div>
          </td>
        </tr>
        <tr><td style="padding:34px 40px 10px 40px;">
          <h1 style="margin:0 0 18px 0;font-size:22px;line-height:1.25;color:#111827;font-weight:600;">Restablecimiento de contraseña</h1>
          <p style="margin:0 0 14px 0;font-size:15px;line-height:1.5;color:#374151;">Hola,<br/>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta asociada al correo <strong style="color:#111827;">${normEmail}</strong>.</p>
          <p style="margin:0 0 18px 0;font-size:15px;line-height:1.5;color:#374151;">Si realizaste esta solicitud, haz clic en el botón a continuación para crear una nueva contraseña. Este enlace es válido durante <strong>30 minutos</strong>.</p>
          <div style="text-align:center;margin:34px 0;">
            <a href="${link}" style="display:inline-block;background:linear-gradient(90deg,#0f5132,#000);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:30px;letter-spacing:.5px;">Restablecer contraseña</a>
          </div>
          <p style="margin:0 0 16px 0;font-size:13px;line-height:1.5;color:#6b7280;">Si no solicitaste este cambio, puedes ignorar este mensaje. Tu contraseña actual seguirá funcionando.</p>
          <p style="margin:0 0 6px 0;font-size:12px;line-height:1.4;color:#9ca3af;">Por motivos de seguridad: no compartas este correo ni reenvíes el enlace.</p>
        </td></tr>
        <tr><td style="padding:24px 40px 36px 40px;">
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 22px 0;"/>
          <p style="margin:0;font-size:11px;line-height:1.5;color:#9ca3af;text-align:center;">© ${new Date().getFullYear()} Choucair. Todos los derechos reservados.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        attachments: hasLogo ? [{ filename: 'LogoChoucair.png', path: logoDiskPath, cid: 'logoChoucair' }] : []
      });
      await emitTelemetry('email.sent', { emailType:'password_reset', success:true, durationMs: stop() });
    } else {
      await emitTelemetry('email.sent', { emailType:'password_reset', success:false, durationMs: stop(), error:'smtp_not_configured' });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    await emitTelemetry('email.sent', { emailType:'password_reset', success:false, durationMs: stop(), error: e?.message });
    return res.status(500).json({ error: e?.message || 'Error al solicitar recuperación' });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    let { email, token, password } = (req.body || {}) as { email?: string; token?: string; password?: string };
    if (!token || !password) return res.status(400).json({ error: 'Faltan parámetros' });
    const normEmail = email?.trim().toLowerCase();

    let user = normEmail
      ? await User.findOne({ email: normEmail, resetPasswordToken: token, resetPasswordExpires: { $gt: new Date() } })
      : null;

    if (!user) {
      // Fallback: buscar solo por token válido (permite reset aunque el email param falte o esté mal)
      user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: new Date() } });
    }

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

// ---------- Email verification (ELIMINADO) ----------
// Se ha eliminado la funcionalidad de verificación de correo por ahora.
// Mantener campos en el esquema permite una futura reactivación sin migración.
// export async function requestEmailVerification() { /* removed */ }
// export async function verifyEmail() { /* removed */ }
