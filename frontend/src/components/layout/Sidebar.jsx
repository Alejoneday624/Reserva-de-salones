import { NavLink } from "react-router-dom";
import { CalendarCheck, LayoutGrid } from "lucide-react";

const ENLACES = [
  { to: "/catalogo", etiqueta: "Catálogo", Icono: LayoutGrid },
  { to: "/mis-reservas", etiqueta: "Mis Reservas", Icono: CalendarCheck },
];

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-[#0c1e3c] border-r border-white/10 flex flex-col">
      <p className="px-3 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">
        Menú
      </p>

      <nav className="flex-1 px-3 space-y-1">
        {ENLACES.map(({ to, etiqueta, Icono }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-teal-500 text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <Icono className="w-4 h-4" />
            {etiqueta}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
