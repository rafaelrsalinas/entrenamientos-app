import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="centered">
      <div className="card narrow">
        <h1>404</h1>
        <p className="muted">Esta página no existe.</p>
        <Link to="/" className="link">← Volver al inicio</Link>
      </div>
    </div>
  );
}
