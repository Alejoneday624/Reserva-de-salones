import { createContext, useContext, useState, useEffect, useCallback } from "react";

const UserContext = createContext();
const TIMEOUT_MS = 10 * 60 * 1000;
const ACTIVITY_KEY = "lastActivity";
const USER_KEY = "usuario";

function getStoredUser() {
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function updateActivity() {
  localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
}

function isExpired() {
  const last = localStorage.getItem(ACTIVITY_KEY);
  if (!last) return true;
  return Date.now() - Number(last) > TIMEOUT_MS;
}

export function UserProvider({ children }) {
  const [nombreUsuario, setNombreUsuarioState] = useState(getStoredUser);
  const [expired, setExpired] = useState(false);

  const setNombreUsuario = useCallback((user) => {
    setNombreUsuarioState(user);
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      updateActivity();
    } else {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ACTIVITY_KEY);
    }
  }, []);

  const logout = useCallback(() => {
    setNombreUsuarioState(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    setExpired(false);
  }, []);

  useEffect(() => {
    if (!nombreUsuario) return;

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    const onActivity = () => updateActivity();
    activityEvents.forEach((e) => window.addEventListener(e, onActivity));

    updateActivity();

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
