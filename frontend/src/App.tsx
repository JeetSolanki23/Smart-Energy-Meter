import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";
import DeviceUsage from "./pages/DeviceUsage";
import Usage from "./pages/Usage";
import Bills from "./pages/Bills";
import AdminDashboard from "./pages/AdminDashboard";
import DeviceManagement from "./pages/DeviceManagement";
import DeviceRegister from "./pages/DeviceRegister";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="smartmeter-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* User */}
            <Route path="/dashboard" element={<ProtectedRoute requiredRole="user"><Dashboard /></ProtectedRoute>} />
            <Route path="/device/:deviceId" element={<ProtectedRoute requiredRole="user"><DeviceUsage /></ProtectedRoute>} />
            <Route path="/usage" element={<ProtectedRoute requiredRole="user"><Usage /></ProtectedRoute>} />
            <Route path="/bills" element={<ProtectedRoute requiredRole="user"><Bills /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/devices" element={<ProtectedRoute requiredRole="admin"><DeviceManagement /></ProtectedRoute>} />
            <Route path="/admin/device/register" element={<ProtectedRoute requiredRole="admin"><DeviceRegister /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
