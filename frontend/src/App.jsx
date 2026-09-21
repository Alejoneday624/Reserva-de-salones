import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UserProvider } from "./context/UserContext";
import ProtectedRoute from "./components/common/ProtectedRoute";

import SelectUser from "./pages/SelectUser";
import Catalogo from "./pages/Catalogo";
import SalonDetalle from "./pages/SalonDetalle";

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SelectUser />} />

          <Route path="/catalogo" element={
            <ProtectedRoute>
              <Catalogo />
            </ProtectedRoute>
          } />

          <Route path="/catalogo/:id" element={
            <ProtectedRoute>
              <SalonDetalle />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;