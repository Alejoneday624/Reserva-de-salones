import { Navigate } from "react-router-dom";
import { useUser } from "../../context/UserContext";

export default function ProtectedRoute({ children }) {
  const { nombreUsuario } = useUser();

  if (!nombreUsuario) {
    return <Navigate to="/" replace />;
  }

  return children;
}
