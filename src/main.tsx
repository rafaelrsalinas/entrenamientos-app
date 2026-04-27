import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import Login from './routes/Login.tsx';
import Home from './routes/Home.tsx';
import Session from './routes/Session.tsx';
import Summary from './routes/Summary.tsx';
import History from './routes/History.tsx';
import ExerciseHistory from './routes/ExerciseHistory.tsx';
import Plan from './routes/Plan.tsx';
import Settings from './routes/Settings.tsx';
import NotFound from './routes/NotFound.tsx';
import { ToastProvider } from './components/Toast.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<App />}>
            <Route path="/" element={<Home />} />
            <Route path="/session/:sessionId" element={<Session />} />
            <Route path="/session/:sessionId/summary" element={<Summary />} />
            <Route path="/history" element={<History />} />
            <Route path="/exercise/:exerciseId" element={<ExerciseHistory />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  </StrictMode>,
);
