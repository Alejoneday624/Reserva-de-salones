import { createContext, useContext, useState } from "react";

const UserContext = createContext();

function getStoredUser() {
  try {
    const stored = localStorage.getItem("usuario");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function UserProvider({ children }) {
  const [nombreUsuario, setNombreUsuarioState] = useState(getStoredUser);

  const setNombreUsuario = (user) => {
    setNombreUsuarioState(user);
    if (user) {
      localStorage.setItem("usuario", JSON.stringify(user));
    } else {
      localStorage.removeItem("usuario");
    }
  };

  return (
    <UserContext.Provider value={{ nombreUsuario, setNombreUsuario }}>
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