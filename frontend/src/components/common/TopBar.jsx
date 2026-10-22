import { LayoutGrid, Menu, User, LogOut } from "lucide-react";
import { useUser } from "../../context/UserContext";

// onMenu (opcional): si se pasa, se muestra el botón hamburguesa visible
// solo en móvil (md:hidden) para abrir/desplegar el menú lateral.
export default function TopBar({ sinMarca = false, onMenu }) {
  const { nombreUsuario, logout } = useUser();

  return (
    <header className="bg-[#0c1e3c] text-white px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-4">
      {onMenu && (
        <button
          type="button"
          onClick={onMenu}
          className="md:hidden shrink-0 rounded-lg p-2 bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Abrir menú"
          aria-controls="menu-principal"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {!sinMarca && (
        <>
          <div className="hidden sm:block bg-white/10 rounded-lg p-2 shrink-0">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold leading-tight truncate">
              Salas de Estudio UAN
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-300 tracking-wide uppercase truncate">
              Universidad Antonio Nariño
            </p>
          </div>
        </>
      )}

      {nombreUsuario && (
        <div className={`flex items-center gap-2 sm:gap-3 ${sinMarca ? "ml-auto" : ""}`}>
          <div className="bg-white/10 rounded-full p-2 shrink-0">
            <User className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium hidden sm:inline">
            {nombreUsuario.name}
          </span>
          <button
            onClick={logout}
            className="bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-colors shrink-0"
            title="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      )}
    </header>
  );
}