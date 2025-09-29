// src/pages/auth/ForgotPassword.tsx
import React, { useState } from 'react';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      setSent(true);
    } catch (e: any) {
      setError(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center pt-24 px-4 relative">
      {/* Botón global esquina */}
      <Button
        type="button"
        onClick={() => navigate('/login')}
        variant="outline"
        className="fixed top-4 left-4 flex items-center gap-2 h-10 px-5 border-gray-300 bg-white/85 backdrop-blur-md hover:bg-white shadow-md rounded-full text-sm font-medium transition-all hover:shadow-lg hover:scale-[1.02]"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </Button>
      <div className="w-full max-w-md relative mt-4">
        <Card className="w-full rounded-2xl">
          <CardHeader className="text-center pb-6 pt-8 bg-gradient-to-r from-green-700 to-black text-white rounded-t-2xl">
            <CardTitle>Olvidé mi contraseña</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {sent ? (
              <div className="text-green-700 text-sm">Si el correo existe, enviamos un enlace de recuperación.</div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">Correo</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                {error && <div className="text-red-600 text-sm">{error}</div>}
                <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-green-700 to-black hover:from-green-900 hover:to-black text-white">
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
