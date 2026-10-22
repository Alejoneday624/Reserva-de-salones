import { NavLink } from "react-router-dom";
import { CalendarCheck, LayoutGrid, X } from "lucide-react";

const ENLACES = [
  { to: "/catalogo", etiqueta: "Catálogo", Icono: LayoutGrid },
  { to: "/mis-reservas", etiqueta: "Mis Reservas", Icono: CalendarCheck },
];

// En escritorio (md en adelante) es la barra lateral fija de siempre.
// En móvil se vuelve un panel deslizante desde la izquierda que se abre con
// el botón hamburguesa del TopBar; `abierto`/`onCerrar` lo controlan.
export default function Sidebar({ abierto = false, onCerrar }) {
  return (
    <>
      {/* Fondo oscuro detrás del panel: solo en móvil. */}
      <div
        onClick={onCerrar}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-black/50 md:hidden ${abierto ? "" : "hidden"}`}
      />

      <aside
        id="menu-principal"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 max-w-[80vw] flex-col shrink-0 bg-[#0c1e3c] border-r border-white/10 transition-transform duration-200 md:static md:translate-x-0 md:w-56 md:max-w-none ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-3 pt-4 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Menú
          </p>
          {/* Cierre visible solo en móvil. */}
          <button
            type="button"
            onClick={onCerrar}
            className="md:hidden rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {ENLACES.map(({ to, etiqueta, Icono }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onCerrar}
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
    </>
  );
}