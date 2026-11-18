import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { RouterProvider, useRouter } from './router';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { ToastContainer } from './components/ui/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductEditorPage } from './pages/ProductEditorPage';
import { InventoryPage } from './pages/InventoryPage';
import { OrdersPage } from './pages/OrdersPage';
import { CustomersPage } from './pages/CustomersPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';

function AppRoutes() {
  const { pathname, searchParams, navigate } = useRouter();
  const { refreshSession } = useAuth();

  let screen = <DashboardPage />;
  if (pathname === '/login') {
    screen = <LoginPage />;
  } else {
    let content = <DashboardPage />;
    const productEditMatch = pathname.match(/^\/products\/([^/]+)\/edit$/);

    if (pathname === '/products') {
      content = <ProductsPage />;
    } else if (pathname === '/products/new') {
      content = <ProductEditorPage mode="create" />;
    } else if (pathname === '/products/edit') {
      content = (
        <ProductEditorPage mode="edit" productId={searchParams.get('id') || ''} />
      );
    } else if (productEditMatch) {
      content = (
        <ProductEditorPage
          mode="edit"
          productId={decodeURIComponent(productEditMatch[1])}
        />
      );
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
    screen = <ProtectedRoute>{content}</ProtectedRoute>;
  }

  return (
    <ErrorBoundary
      resetKey={pathname}
      onReset={() => void refreshSession()}
      onGoToLogin={() => navigate('/login', { replace: true })}
    >
      {screen}
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
            <ToastContainer />
          </AuthProvider>
        </ToastProvider>
      </RouterProvider>
    </ErrorBoundary>
  );
}
