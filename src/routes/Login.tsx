import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { session, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && session) nav('/', { replace: true });
  }, [loading, session, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="centered">
      <div className="card narrow">
        <h1>entrenamientos</h1>
        <p className="muted">Introduce tu email y recibirás un enlace mágico para entrar.</p>
        {sent ? (
          <p className="success">📬 Revisa tu correo y abre el enlace desde este dispositivo.</p>
        ) : (
          <form onSubmit={onSubmit} className="col">
            <input
              type="email"
              required
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="primary" disabled={busy}>{busy ? 'Enviando…' : 'Enviar enlace'}</button>
            {error && <p className="error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
