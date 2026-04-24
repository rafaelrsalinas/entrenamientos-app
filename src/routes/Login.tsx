import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (!loading && session) nav('/', { replace: true });
  }, [loading, session, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Introduce un email válido.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success('Enlace enviado. Revisa tu correo.');
    }
  }

  return (
    <div className="centered">
      <div className="card narrow">
        <h1 style={{ fontSize: 28 }}>entrenamientos</h1>
        <p className="muted">Enlace mágico por email. Sin contraseñas.</p>
        {sent ? (
          <div className="col gap-sm mt-md">
            <p className="success">📬 Enlace enviado a <strong>{email}</strong></p>
            <p className="muted small">Abre el email desde este mismo dispositivo.</p>
            <button className="link" onClick={() => setSent(false)}>Usar otro email</button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="col mt-md">
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="primary" disabled={busy || !email}>
              {busy ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
