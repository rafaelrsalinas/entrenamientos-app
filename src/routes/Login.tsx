import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import HazardBand from '../components/HazardBand';

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
      toast.error('Email no válido');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setSent(true);
      toast.success('Enlace enviado');
    }
  }

  return (
    <div className="login-screen">
      <div className="login-meta">OP.BOMBERO · V9.2</div>
      <h1 className="login-title">
        ACCESO<span className="dot">.</span>
      </h1>
      <div className="login-sub">IDENTIFICACIÓN POR CORREO · ENLACE MÁGICO</div>

      <div className="login-hazard">
        <HazardBand thickness={5} bleed={false} />
      </div>

      <form onSubmit={onSubmit} className="login-form">
        <div className="login-field-label">&gt; CORREO OPERATIVO</div>
        <input
          className="login-input"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="rafa@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={sent}
        />

        <button className="login-submit" type="submit" disabled={busy || sent || !email}>
          {sent ? '✓ ENLACE ENVIADO · ABRE TU CORREO' : busy ? 'ENVIANDO…' : 'ENVIAR ENLACE DE ACCESO →'}
        </button>

        <p className="login-hint">
          No guardamos contraseñas. Te enviamos un enlace de un solo uso al correo. Abre el enlace
          desde este mismo dispositivo.
        </p>
      </form>

      <div className="login-foot">
        <span>F1 · HIPERTROFIA</span>
        <span>SUPABASE · EU-W-1</span>
        <span>PWA</span>
      </div>
    </div>
  );
}
