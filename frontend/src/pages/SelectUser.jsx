import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { getListaUsuarios } from "../api/usuariosApi";
import { useUser } from "../context/UserContext";
import TopBar from "../components/common/TopBar";
import SearchBar from "../components/common/SearchBar";
import UserList from "../components/UserList";
import ConfirmModal from "../components/common/ConfirmModal";

export default function SelectUser() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const { setNombreUsuario } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    const cargarDatos = async () => {
      setCargando(true);
      try {
        const data = await getListaUsuarios();
        setDatos(data);
      } catch (err) {
        console.error("Error al cargar datos:", err);
        setError("No se pudieron cargar los datos");
      } finally {
        setCargando(false);
      }
    };

    cargarDatos();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <TopBar />

      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-h-[calc(100vh-120px)] flex flex-col">
          {/* Encabezado */}
          <div className="flex items-center gap-2 mb-1">
            <User className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Identificación de usuario
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            ¿Quién eres?
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Selecciona tu nombre de la siguiente lista de estudiantes
            preestablecidos para acceder instantáneamente a tu panel de reservas.
          </p>

          {/* Barra de búsqueda */}
          {!cargando && !error && (
            <SearchBar value={search} onChange={setSearch} />
          )}

          {/* Estado de carga */}
          {cargando && (
            <div className="text-slate-400 text-sm text-center py-8">
              Cargando usuarios...
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Lista de usuarios */}
          {!cargando && !error && (
            <div className="overflow-y-auto flex-1 min-h-0">
              <UserList
                users={datos?.usuarios_lista ?? []}
                search={search}
                onSelectUser={(user) => {
                  setSelectedUser(user);
                  setShowModal(true);
                }}
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showModal}
        userName={selectedUser?.name}
        onConfirm={() => {
          setNombreUsuario(selectedUser);
          setShowModal(false);
          navigate("/catalogo");
        }}
        onCancel={() => {
          setShowModal(false);
          setSelectedUser(null);
        }}
      />
    </div>
  );
}
