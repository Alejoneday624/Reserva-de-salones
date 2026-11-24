import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UserProvider } from "./context/UserContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";

import SelectUser from "./pages/SelectUser";
import Catalogo from "./pages/Catalogo";
import SalonDetalle from "./pages/SalonDetalle";
import MisReservas from "./pages/MisReservas";
import ConsultaReservas from "./pages/ConsultaReservas";

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SelectUser />} />

          <Route path="/catalogo" element={
            <ProtectedRoute>
              <AppLayout>
                <Catalogo />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/catalogo/:id" element={
            <ProtectedRoute>
              <AppLayout>
                <SalonDetalle />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/mis-reservas" element={
            <ProtectedRoute>
              <AppLayout>
                <MisReservas />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/consulta-reservas" element={
            <ProtectedRoute>
              <AppLayout>
                <ConsultaReservas />
              </AppLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;
