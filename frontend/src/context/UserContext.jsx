import { createContext, useContext, useState, useEffect } from "react";
// import { obtenerUsuarios } from "../api/reservasApi"; // TODO: descomentar cuando el backend esté listo

const UserContext = createContext();

export function UserProvider({ children }) {
  const [nombreUsuario, setNombreUsuario] = useState(null);
  const [listaUsuarios, setListaUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false); // false porque aún no se está cargando nada real

  useEffect(() => {
    // TODO: cuando el backend esté listo, reemplazar este bloque por la llamada real:
    //
    // async function cargarUsuarios() {
    //   try {
    //     setCargando(true);
    //     const data = await obtenerUsuarios();
    //     setListaUsuarios(data);
    //   } catch (error) {
    //     console.error("Error al cargar usuarios:", error);
    //   } finally {
    //     setCargando(false);
    //   }
    // }
    // cargarUsuarios();

    // Datos temporales de prueba mientras no hay backend
    setListaUsuarios([
      { id: 1, nombre: "María López" },
      { id: 2, nombre: "Juan Pérez" },
      { id: 3, nombre: "Carlos Ruiz" },
    ]);
  }, []);

  return (
    <UserContext.Provider
      value={{ nombreUsuario, setNombreUsuario, listaUsuarios, cargando }}
    >
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