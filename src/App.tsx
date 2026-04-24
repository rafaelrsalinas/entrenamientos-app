import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';

export default function App() {
  const { session, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !session) nav('/login', { replace: true });
  }, [loading, session, nav]);

  if (loading) return <div className="centered">Cargando…</div>;
  if (!session) return null;

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">💪 entrenamientos</Link>
        <nav className="nav">
          <Link to="/">Hoy</Link>
          <Link to="/history">Historial</Link>
          <button className="link" onClick={() => supabase.auth.signOut()}>Salir</button>
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
