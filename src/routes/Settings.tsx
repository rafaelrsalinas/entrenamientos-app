import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import HazardBand from '../components/HazardBand';
import ActionSheet from '../components/ActionSheet';
import { useToast } from '../components/Toast';

const APP_VERSION = 'V9.2 BOMBERO';
const DB_REGION = 'EU-W-1';

function initials(email: string | null | undefined) {
  if (!email) return 'X';
  const part = email.split('@')[0];
  if (!part) return 'X';
  const segs = part.split(/[._-]/);
  return (
    segs
      .slice(0, 2)
      .map((p) => (p ? p.charAt(0).toUpperCase() : ''))
      .join('') || part.charAt(0).toUpperCase()
  );
}

export default function Settings() {
  const { user, session } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [logoutOpen, setLogoutOpen] = useState(false);

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Error al cerrar sesión');
      return;
    }
    nav('/login', { replace: true });
  }

  const createdAt = user?.created_at
    ? new Date(user.created_at)
        .toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
        .toUpperCase()
        .replace(/\./g, '')
    : '';

  return (
    <div className="container">
      <div className="tac-op">
        OP.BOMBERO · {user?.email?.split('@')[0]?.toUpperCase() ?? 'OPERATIVO'}
      </div>
      <h1 className="tac-title">PERFIL<span className="dot">.</span></h1>

      <HazardBand thickness={5} />

      <div className="profile-card mt-md">
        <div className="profile-avatar">{initials(user?.email)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="profile-email">{user?.email}</div>
          <div className="profile-meta">DESDE · {createdAt || '—'}</div>
        </div>
        {session && <div className="profile-online">● ONLINE</div>}
      </div>

      <div className="tac-section">DATOS</div>
      <div className="settings-list">
        <div className="settings-row">
          <span>Sincronización</span>
          <span className="settings-row-val green">SUPABASE · {DB_REGION}</span>
        </div>
        <div className="settings-row">
          <span>Fuente del plan</span>
          <span className="settings-row-val">EXCEL V9</span>
        </div>
      </div>

      <div className="tac-section">PREFERENCIAS</div>
      <div className="settings-list">
        <div className="settings-row">
          <span>Unidad</span>
          <span className="settings-row-val">KG</span>
        </div>
        <div className="settings-row">
          <span>Haptic feedback</span>
          <span className="settings-row-val orange">ON</span>
        </div>
        <div className="settings-row">
          <span>Auto-PR</span>
          <span className="settings-row-val orange">ON</span>
        </div>
      </div>

      <div className="tac-section">SESIÓN</div>
      <div className="settings-list">
        <button
          className="settings-row settings-row-btn danger"
          onClick={() => setLogoutOpen(true)}
        >
          <span>Cerrar sesión</span>
          <span className="settings-row-val">→</span>
        </button>
      </div>

      <div className="settings-foot">
        ENTRENAMIENTOS · {APP_VERSION}
        <br />
        REACT · SUPABASE · VERCEL · PWA
        <br />
        BUILT FOR OPOSICIÓN BOMBERO
      </div>

      <ActionSheet
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="¿CERRAR SESIÓN?"
        description="Tendrás que volver a entrar con el enlace mágico."
        actions={[{ label: 'CERRAR SESIÓN', onPress: logout, destructive: true }]}
      />
    </div>
  );
}
