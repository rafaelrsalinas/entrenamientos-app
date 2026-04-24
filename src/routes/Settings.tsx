import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import ActionSheet from '../components/ActionSheet';
import { useToast } from '../components/Toast';
import { haptic } from '../lib/haptics';

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();
  const [confirmLogout, setConfirmLogout] = useState(false);

  async function logout() {
    haptic('warning');
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
  }

  return (
    <>
      <h1 className="large-title">Ajustes</h1>

      <section className="card">
        <div className="label">Cuenta</div>
        <div style={{ marginTop: 8 }}>{user?.email ?? '—'}</div>
      </section>

      <section className="card mt-md">
        <div className="label">Sobre la app</div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Registro de entrenamientos personal. Stack: React + Supabase + Vercel.
        </p>
        <p className="small muted">
          <a
            href="https://github.com/rafaelrsalinas/entrenamientos-app"
            target="_blank"
            rel="noreferrer"
          >
            Código en GitHub →
          </a>
        </p>
      </section>

      <button
        className="full mt-md destructive"
        onClick={() => setConfirmLogout(true)}
      >
        Cerrar sesión
      </button>

      <ActionSheet
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="¿Cerrar sesión?"
        description="Tendrás que volver a entrar con el enlace mágico."
        actions={[{ label: 'Cerrar sesión', onPress: logout, destructive: true }]}
      />
    </>
  );
}
