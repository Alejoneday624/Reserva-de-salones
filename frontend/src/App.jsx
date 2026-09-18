import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UserProvider } from "./context/UserContext";
import ProtectedRoute from "./components/common/ProtectedRoute";

import SelectUser from "./pages/SelectUser";
import Catalogo from "./pages/Catalogo";

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          {/* Página inicial: selección de usuario */}
          <Route path="/" element={<SelectUser />} />

          {/* Ruta protegida */}
          <Route path="/catalogo" element={
            <ProtectedRoute>
              <Catalogo />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;