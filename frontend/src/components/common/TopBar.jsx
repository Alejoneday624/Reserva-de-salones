import { LayoutGrid } from "lucide-react";

export default function TopBar() {
  return (
    <header className="bg-[#0c1e3c] text-white px-6 py-4 flex items-center gap-4">
      <div className="bg-white/10 rounded-lg p-2">
        <LayoutGrid className="w-6 h-6" />
      </div>
      <div>
        <h1 className="text-lg font-bold leading-tight">Salas de Estudio UAN</h1>
        <p className="text-xs text-slate-300 tracking-wide uppercase">
          Universidad Antonio Nariño
        </p>
      </div>
    </header>
  );
}
