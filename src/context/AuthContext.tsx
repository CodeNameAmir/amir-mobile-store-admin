import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AdminUiPreferences, AuthUser } from '../types/admin';
import { adminApi } from '../services/adminApi';
import { clearAllAdminCache } from '../services/adminCache';
import { ApiError, registerApiHooks } from '../services/apiClient';
import {
  canViewFullSensitiveData,
  hasAnyPermission,
  hasExplicitRbacPermissions,
  hasPermission,
  type AdminPermission,
} from '../utils/permissions';
import { useToast } from './ToastContext';

const UI_PREFS_STORAGE_KEY = 'ams_admin_ui_prefs_v1';

const DEFAULT_PREFS: AdminUiPreferences = {
  lowStockThreshold: 5,
  compactRows: false,
  theme: 'light',
};

function readPreferences(): AdminUiPreferences {
  try {
    const raw = window.localStorage.getItem(UI_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<AdminUiPreferences>;
    return {
      lowStockThreshold:
        typeof parsed.lowStockThreshold === 'number' && parsed.lowStockThreshold >= 1
          ? Math.min(100, Math.round(parsed.lowStockThreshold))
          : DEFAULT_PREFS.lowStockThreshold,
      compactRows: Boolean(parsed.compactRows),
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'forbidden'
  | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  isAdmin: boolean;
  hasGranularRbac: boolean;
  can: (permission: Exclude<AdminPermission, '*'>) => boolean;
  canAny: (permissions: Array<Exclude<AdminPermission, '*'>>) => boolean;
  canViewFullPii: boolean;
  sessionExpiredNotice: boolean;
  preferences: AdminUiPreferences;
  updatePreferences: (next: Partial<AdminUiPreferences>) => void;
  refreshSession: () => Promise<void>;
  applyAuthenticatedUser: (user: AuthUser | null) => void;
  logout: (allDevices?: boolean) => Promise<void>;
  clearSessionExpiredNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const [preferences, setPreferences] = useState<AdminUiPreferences>(() => readPreferences());
  const { pushToast } = useToast();

  const applyAuthenticatedUser = useCallback((nextUser: AuthUser | null) => {
    if (!nextUser) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }
    setUser(nextUser);
    setSessionExpiredNotice(false);
    setStatus(nextUser.role === 'admin' ? 'authenticated' : 'forbidden');
  }, []);

  const refreshSession = useCallback(async () => {
    setStatus('loading');
    try {
      const verified = await adminApi.verifyAdminAccess();
      applyAuthenticatedUser(verified.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setStatus('forbidden');
        // Best-effort non-blocking fetch to show customer email on AccessDeniedPage
        void adminApi
          .getMe()
          .then((me) => {
            if (me.user) applyAuthenticatedUser(me.user);
          })
          .catch(() => undefined);
        return;
      }
      applyAuthenticatedUser(null);
    }
  }, [applyAuthenticatedUser]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    registerApiHooks({
      onUnauthorized: () => {
        clearAllAdminCache();
        setUser(null);
        setStatus('unauthenticated');
        setSessionExpiredNotice(true);
      },
      onForbidden: () => {
        setStatus((prev) => (prev === 'authenticated' ? 'forbidden' : prev));
      },
    });
    return () => registerApiHooks({});
  }, []);

  const logout = useCallback(
    async (allDevices = false) => {
      try {
        await adminApi.logout(allDevices);
      } catch {
        // Always clear client session state even if network call fails
      } finally {
        clearAllAdminCache();
        setUser(null);
        setStatus('unauthenticated');
        setSessionExpiredNotice(false);
        pushToast({
          tone: 'info',
          title: allDevices ? 'خروج از تمام دستگاه‌ها انجام شد' : 'از پنل مدیریت خارج شدید',
        });
      }
    },
    [pushToast]
  );

  useEffect(() => {
    const isDark = preferences.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [preferences.theme]);

  const updatePreferences = useCallback((next: Partial<AdminUiPreferences>) => {
    setPreferences((prev) => {
      const merged: AdminUiPreferences = {
        lowStockThreshold:
          typeof next.lowStockThreshold === 'number'
            ? Math.max(1, Math.min(100, Math.round(next.lowStockThreshold)))
            : prev.lowStockThreshold,
        compactRows: typeof next.compactRows === 'boolean' ? next.compactRows : prev.compactRows,
        theme: next.theme === 'dark' || next.theme === 'light' ? next.theme : prev.theme ?? 'light',
      };
      try {
        window.localStorage.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // Ignore storage errors
      }
      return merged;
    });
  }, []);

  const clearSessionExpiredNotice = useCallback(() => {
    setSessionExpiredNotice(false);
  }, []);

  const can = useCallback(
    (permission: Exclude<AdminPermission, '*'>) => hasPermission(user, permission),
    [user]
  );

  const canAny = useCallback(
    (permissions: Array<Exclude<AdminPermission, '*'>>) => hasAnyPermission(user, permissions),
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        isAdmin: status === 'authenticated' && user?.role === 'admin',
        hasGranularRbac: hasExplicitRbacPermissions(user),
        can,
        canAny,
        canViewFullPii: canViewFullSensitiveData(user),
        sessionExpiredNotice,
        preferences,
        updatePreferences,
        refreshSession,
        applyAuthenticatedUser,
        logout,
        clearSessionExpiredNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
