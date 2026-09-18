import { useState } from "react";
import { ChevronRight, SearchX } from "lucide-react";

const AVATAR_COLORS = [
  "bg-teal-500",
  "bg-blue-500",
  "bg-green-600",
  "bg-emerald-600",
  "bg-blue-600",
  "bg-teal-600",
  "bg-emerald-700",
  "bg-slate-700",
];

function getInitials(fullName = "") {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getColorForName(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function UserItem({ user, isSelected, onClick }) {
  const initials = getInitials(user.name);
  const colorClass = getColorForName(user.name);

  return (
    <button
      onClick={() => onClick?.(user)}
      className={`w-full flex items-center justify-between px-5 py-4 bg-white
        hover:bg-slate-50 hover:shadow-md hover:scale-[1.02]
        transition-all duration-200 border-b border-slate-100
        ${isSelected ? "bg-[#0c1e3c] text-white border-l-4 border-l-blue-300" : ""}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center
            text-white text-sm font-semibold shrink-0 shadow-sm ${colorClass}`}
        >
          {initials}
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-slate-800">{user.name}</p>
          <p className="text-xs text-slate-500">{user.programa}</p>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
    </button>
  );
}

export default function UserList({
  users = [],
  onSelectUser,
  loading = false,
  search = "",
  emptyMessage = "No hay usuarios registrados",
}) {
  const [selectedId, setSelectedId] = useState(null);

  const filteredUsers = users.filter((user) =>
    user.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleClick = (user) => {
    setSelectedId(user.id);
    onSelectUser?.(user);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse border-b border-slate-100">
            <div className="w-11 h-11 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 bg-slate-200 rounded" />
              <div className="h-2 w-24 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (filteredUsers.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 p-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
          <SearchX className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600 mb-1">
          {search ? "No se encontraron usuarios" : emptyMessage}
        </p>
        <p className="text-xs text-slate-400">
          {search ? "Intenta con otro nombre" : "No hay usuarios disponibles en el sistema"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {filteredUsers.map((user) => (
        <UserItem
          key={user.id}
          user={user}
          isSelected={selectedId === user.id}
          onClick={handleClick}
        />
      ))}
    </div>
  );
}
