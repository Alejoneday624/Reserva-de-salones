import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UserProvider } from "./context/UserContext";
import ProtectedRoute from "./components/common/ProtectedRoute";

import SelectUser from "./pages/SelectUser";

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          {/* Página inicial: selección de usuario */}
          <Route path="/" element={<SelectUser />} />

          {/* Rutas protegidas: se irán agregando a medida que se creen las páginas */}
          {/*
          <Route path="/catalogo" element={
            <ProtectedRoute>
              <Catalogo />
            </ProtectedRoute>
          } />
          */}
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;