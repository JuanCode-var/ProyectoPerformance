// src/pages/auth/ResetPassword.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [manualToken, setManualToken] = useState('');
  const effectiveToken = token || manualToken.trim();
  const tokenMissing = !token && !manualToken;

  useEffect(() => {
    if (!token && window.location.pathname.includes('passaword')) {
      // Intentar corregir si alguien llegó con la ruta mal escrita
      try {
        const search = window.location.search;
        window.history.replaceState(null, '', '/reset-password' + search);
      } catch {}
    }
  }, [token]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: effectiveToken, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      setDone(true);
      setTimeout(() => nav('/login'), 1500);
    } catch (e: any) {
      setError(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex justify-center pt-24 px-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardHeader className="text-center pb-6 pt-8 bg-gradient-to-r from-green-700 to-black text-white rounded-t-2xl">
          <CardTitle>Restablecer contraseña</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {(!token && email) && (
            <div className="mb-4 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 p-2 rounded">
              No se detectó token en el enlace. Asegúrate de copiar el enlace completo del correo. Puedes pegar manualmente el token abajo.
            </div>
          )}
          {window.location.pathname.includes('passaword') && (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded">
              Ruta incorrecta (passaword). Se corrigió a /reset-password automáticamente.
            </div>
          )}
          {tokenMissing && (
            <div className="mb-4">
              <label className="block text-sm mb-1">Token (pegar manualmente)</label>
              <Input value={manualToken} onChange={e => setManualToken(e.target.value)} placeholder="token..." />
            </div>
          )}
          {done ? (
            <div className="text-green-700">Contraseña actualizada. Redirigiendo...</div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Nueva contraseña</label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm mb-1">Confirmar contraseña</label>
                <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-green-700 to-black hover:from-green-900 hover:to-black text-white">
                {loading ? 'Guardando...' : 'Guardar'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
