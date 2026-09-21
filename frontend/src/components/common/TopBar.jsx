import { LayoutGrid, User, LogOut } from "lucide-react";
import { useUser } from "../../context/UserContext";

export default function TopBar() {
  const { nombreUsuario, logout } = useUser();

  return (
    <header className="bg-[#0c1e3c] text-white px-6 py-4 flex items-center gap-4">
      <div className="bg-white/10 rounded-lg p-2">
        <LayoutGrid className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <h1 className="text-lg font-bold leading-tight">Salas de Estudio UAN</h1>
        <p className="text-xs text-slate-300 tracking-wide uppercase">
          Universidad Antonio Nariño
        </p>
      </div>

      {nombreUsuario && (
        <div className="flex items-center gap-3">
          <div className="bg-white/10 rounded-full p-2">
            <User className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium hidden sm:inline">
            {nombreUsuario.name}
          </span>
          <button
            onClick={logout}
            className="bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      )}
    </header>
  );
}
