import { createContext, useContext, useState, useEffect, useCallback } from "react";

const UserContext = createContext();
const TIMEOUT_MS = 10 * 60 * 1000;
const ACTIVITY_KEY = "lastActivity";
const USER_KEY = "usuario";

// Usamos sessionStorage en lugar de localStorage: la sesión se guarda en la
// pestaña y desaparece cuando el usuario la cierra o cierra el navegador.
function getStoredUser() {
  try {
    const stored = sessionStorage.getItem(USER_KEY);
    if (!stored) return null;

    // Al restaurar la sesión validamos que no haya expirado por inactividad.
    if (isExpired()) {
      clearSession();
      return null;
    }

    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function updateActivity() {
  sessionStorage.setItem(ACTIVITY_KEY, Date.now().toString());
}

function isExpired() {
  const last = sessionStorage.getItem(ACTIVITY_KEY);
  if (!last) return true;
  return Date.now() - Number(last) > TIMEOUT_MS;
}

function clearSession() {
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(ACTIVITY_KEY);
}

export function UserProvider({ children }) {
  const [nombreUsuario, setNombreUsuarioState] = useState(getStoredUser);
  const [expired, setExpired] = useState(false);

  const setNombreUsuario = useCallback((user) => {
    setNombreUsuarioState(user);
    if (user) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      updateActivity();
    } else {
      clearSession();
    }
  }, []);

  const logout = useCallback(() => {
    setNombreUsuarioState(null);
    clearSession();
    setExpired(false);
  }, []);

  useEffect(() => {
    if (!nombreUsuario) return;

    // Solo actualizamos la actividad con interacciones reales del usuario.
    // No al montar: hacerlo reiniciaba el contador y "revivía" la sesión.
    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    const onActivity = () => updateActivity();
    activityEvents.forEach((e) => window.addEventListener(e, onActivity));

    const interval = setInterval(() => {
      if (isExpired()) {
        alert("Sesión expirada");
        setExpired(true);
        logout();
      }
    }, 30000);

    return () => {
      activityEvents.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(interval);
    };
  }, [nombreUsuario, logout]);

  return (
    <UserContext.Provider value={{ nombreUsuario, setNombreUsuario, logout, expired }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser debe usarse dentro de un UserProvider");
  }
  return context;
}
