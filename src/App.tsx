import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { RouterProvider, useRouter } from './router';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { ToastContainer } from './components/ui/ToastContainer';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { InventoryPage } from './pages/InventoryPage';
import { OrdersPage } from './pages/OrdersPage';
import { CustomersPage } from './pages/CustomersPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';

function AppRoutes() {
  const { pathname } = useRouter();

  if (pathname === '/login') {
    return <LoginPage />;
  }

  let content = <DashboardPage />;
  if (pathname === '/products') {
    content = <ProductsPage />;
  } else if (pathname === '/inventory') {
    content = <InventoryPage />;
  } else if (pathname === '/orders') {
    content = <OrdersPage />;
  } else if (pathname === '/customers') {
    content = <CustomersPage />;
  } else if (pathname === '/audit-logs') {
    content = <AuditLogsPage />;
  } else if (pathname === '/settings') {
    content = <SettingsPage />;
  }

  return <ProtectedRoute>{content}</ProtectedRoute>;
}

export default function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
          <ToastContainer />
        </AuthProvider>
      </ToastProvider>
    </RouterProvider>
  );
}
