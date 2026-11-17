import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';

interface RouterLocation {
  pathname: string;
  search: string;
}

interface RouterContextValue {
  location: RouterLocation;
  pathname: string;
  searchParams: URLSearchParams;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

function normalizePath(rawPath: string): string {
  if (!rawPath) return '/';
  const [pathOnly, query] = rawPath.split('?');
  const cleaned = pathOnly.length > 1 ? pathOnly.replace(/\/+$/, '') : pathOnly || '/';
  return query ? `${cleaned}?${query}` : cleaned;
}

function readWindowLocation(): RouterLocation {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '' };
  }
  const pathname =
    window.location.pathname.length > 1
      ? window.location.pathname.replace(/\/+$/, '')
      : window.location.pathname || '/';
  return {
    pathname,
    search: window.location.search || '',
  };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<RouterLocation>(() => readWindowLocation());

  useEffect(() => {
    const handlePopState = () => {
      setLocation(readWindowLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const normalized = normalizePath(to.startsWith('/') ? to : `/${to}`);
    if (typeof window !== 'undefined') {
      const current = `${window.location.pathname}${window.location.search}`;
      if (current !== normalized) {
        if (options?.replace) {
          window.history.replaceState(null, '', normalized);
        } else {
          window.history.pushState(null, '', normalized);
        }
      }
      setLocation(readWindowLocation());
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  return (
    <RouterContext.Provider
      value={{
        location,
        pathname: location.pathname,
        searchParams,
        navigate,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used within RouterProvider');
  }
  return ctx;
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  replace?: boolean;
}

export function Link({ to, replace, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      rest.target === '_blank'
    ) {
      return;
    }
    e.preventDefault();
    navigate(to, { replace });
  };

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
