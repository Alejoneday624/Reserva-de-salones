import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import TopBar from "../common/TopBar";
import Sidebar from "./Sidebar";

export default function AppLayout({ children }) {
  // Estado del menú lateral: en escritorio no tiene efecto (el sidebar siempre
  // está visible), en móvil controla el panel deslizante hamburguesa.
  const [menuAbierto, setMenuAbierto] = useState(false);
  const location = useLocation();

  // Al cambiar de ruta se cierra solo, para no dejar el panel tapando la
  // vista (patrón de React: ajustar estado durante el render).
  const [rutaPrevia, setRutaPrevia] = useState(location.pathname);
  if (rutaPrevia !== location.pathname) {
    setRutaPrevia(location.pathname);
    if (menuAbierto) setMenuAbierto(false);
  }

  // Escape también cierra el menú.
  useEffect(() => {
    if (!menuAbierto) return;
    const manejarEscape = (evento) => {
      if (evento.key === "Escape") setMenuAbierto(false);
    };
    window.addEventListener("keydown", manejarEscape);
    return () => window.removeEventListener("keydown", manejarEscape);
  }, [menuAbierto]);

  return (
    <div className="min-h-screen bg-slate-100">
      <TopBar onMenu={() => setMenuAbierto(true)} />
      <div className="flex">
        <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}