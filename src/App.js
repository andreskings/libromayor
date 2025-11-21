import React, { useState } from 'react';
import './App.css';
import Historial from './components/historial';
import Empresas from './components/Empresas';
import Registro from './components/registro';
import Balance from './components/balance';
import { useAuth } from './context/AuthContext';

const VIEWS = {
  MAIN: 'main',
  REGISTRO: 'registro',
  EMPRESAS: 'empresas',
  HISTORIAL: 'historial',
  BALANCE: 'balance'
};

function App() {
  const { user, loading, login, register, logout } = useAuth();
  const [view, setView] = useState(VIEWS.MAIN);
  const [authMode, setAuthMode] = useState('login');
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setAuthError('');

    try {
      if (authMode === 'login') {
        await login({ email: formData.email, password: formData.password });
      } else {
        await register(formData);
      }
      setView(VIEWS.MAIN);
    } catch (error) {
      setAuthError(error.body?.message || 'Error al autenticar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBackToMain = () => setView(VIEWS.MAIN);

  const renderMainView = () => (
    <div className="container">
      <div className="app-header">
        <div>
          <h2>Menú Principal</h2>
          <p className="app-welcome">Bienvenido, {user?.nombre || user?.email}</p>
        </div>
        <button className="logout-button" onClick={() => { logout(); setView(VIEWS.MAIN); }}>
          Cerrar sesión
        </button>
      </div>
      <div className="button-container" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button className="registro-button" onClick={() => setView(VIEWS.REGISTRO)}>Hacer Registro</button>
        <button className="empresas-button" onClick={() => setView(VIEWS.EMPRESAS)}>Empresas</button>
        <button className="history-button" onClick={() => setView(VIEWS.HISTORIAL)}>Ver Historial</button>
        <button className="balance-button" onClick={() => setView(VIEWS.BALANCE)}>Balance</button>
      </div>
    </div>
  );

  const renderAuthScreen = () => (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Libro Mayor</h1>
        <p>{authMode === 'login' ? 'Inicia sesión para continuar' : 'Crea una cuenta para comenzar'}</p>
        {authError && <div className="auth-error">{authError}</div>}
        <form onSubmit={handleAuthSubmit}>
          {authMode === 'register' && (
            <div>
              <label htmlFor="nombre">Nombre</label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                placeholder="Nombre completo"
                value={formData.nombre}
                onChange={handleInputChange}
                required
              />
            </div>
          )}
          <div>
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="correo@empresa.com"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>
          <div>
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
          </div>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Procesando...' : authMode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>
        <div className="auth-switch">
          {authMode === 'login' ? (
            <span>
              ¿No tienes cuenta?
              <button type="button" onClick={() => setAuthMode('register')}>
                Regístrate
              </button>
            </span>
          ) : (
            <span>
              ¿Ya tienes cuenta?
              <button type="button" onClick={() => setAuthMode('login')}>
                Inicia sesión
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return renderAuthScreen();
  }

  return (
    <div className="App">
      {view === VIEWS.MAIN && renderMainView()}
      {view === VIEWS.HISTORIAL && <Historial onBack={handleBackToMain} />}
      {view === VIEWS.EMPRESAS && <Empresas onBack={handleBackToMain} />}
      {view === VIEWS.REGISTRO && <Registro onBack={handleBackToMain} />}
      {view === VIEWS.BALANCE && <Balance onBack={handleBackToMain} />}
    </div>
  );
}

export default App;