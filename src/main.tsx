import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import Login from './routes/Login.tsx';
import Home from './routes/Home.tsx';
import Session from './routes/Session.tsx';
import History from './routes/History.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<App />}>
          <Route path="/" element={<Home />} />
          <Route path="/session/:sessionId" element={<Session />} />
          <Route path="/history" element={<History />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
