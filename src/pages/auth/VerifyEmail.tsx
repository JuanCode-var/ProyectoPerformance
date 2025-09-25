// src/pages/auth/VerifyEmail.tsx
import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';

export default function VerifyEmailPage() {
  const loc = useLocation();
  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const onVerify = async () => {
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      setStatus('ok');
      setMessage('Correo verificado. Ya puedes iniciar sesión.');
    } catch (e: any) {
      setStatus('error');
      setMessage(e?.message || 'Error al verificar');
    }
  };

  const onResend = async () => {
    try {
      const res = await fetch('/api/auth/request-email-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      await res.json();
      setMessage('Si el correo existe, enviamos un nuevo enlace.');
    } catch {
      setMessage('Error al reenviar');
    }
  };

  return (
    <div className="w-full flex justify-center pt-24 px-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardHeader className="text-center pb-6 pt-8 bg-gradient-to-r from-green-700 to-black text-white rounded-t-2xl">
          <CardTitle>Verificación de correo</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="text-sm">Correo: <b>{email || '(no especificado)'}</b></div>
            <div>
              <Button onClick={onVerify} className="bg-gradient-to-r from-green-700 to-black hover:from-green-900 hover:to-black text-white">Verificar</Button>
            </div>
            <div>
              <Button variant="outline" onClick={onResend} className="border-gray-300">Reenviar enlace</Button>
            </div>
            {message && (
              <div className={status === 'error' ? 'text-red-600 text-sm' : 'text-green-700 text-sm'}>{message}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
