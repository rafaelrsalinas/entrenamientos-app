import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import TabBar from './components/TabBar';

export default function App() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !session) nav('/login', { replace: true });
  }, [loading, session, nav]);

  if (loading) {
    return (
      <div className="centered">
        <div className="spinner" />
      </div>
    );
  }
  if (!session) return null;

  // Ocultar tab bar durante una sesión activa para no competir con el botón Finalizar
  const inSession = loc.pathname.startsWith('/session/');

  return (
    <div className="app">
      <main className={`container${inSession ? ' container-narrow' : ''}`}>
        <Outlet />
      </main>
      {!inSession && <TabBar />}
    </div>
  );
}
