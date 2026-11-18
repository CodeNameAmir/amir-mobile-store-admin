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

export function normalizeRouteTarget(rawTarget: string): string {
  if (!rawTarget) return '/';
  const cleanedRaw = rawTarget.startsWith('#') ? rawTarget.slice(1) : rawTarget;
  const withSlash = cleanedRaw.startsWith('/') ? cleanedRaw : `/${cleanedRaw}`;
  const qIdx = withSlash.indexOf('?');
  const pathPart = qIdx >= 0 ? withSlash.slice(0, qIdx) : withSlash;
  const queryPart = qIdx >= 0 ? withSlash.slice(qIdx) : '';
  const normalizedPath =
    pathPart.length > 1 ? pathPart.replace(/\/+$/, '') : pathPart || '/';
  return `${normalizedPath}${queryPart}`;
}

function splitRouteParts(target: string): RouterLocation {
  const normalized = normalizeRouteTarget(target);
  const qIdx = normalized.indexOf('?');
  if (qIdx >= 0) {
    return {
      pathname: normalized.slice(0, qIdx) || '/',
      search: normalized.slice(qIdx),
    };
  }
  return {
    pathname: normalized || '/',
    search: '',
  };
}

function readWindowLocation(): RouterLocation {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '' };
  }
  const hash = window.location.hash || '';
  if (hash.startsWith('#/')) {
    return splitRouteParts(hash.slice(1));
  }
  const pathname = window.location.pathname || '/';
  const search = window.location.search || '';
  if (pathname !== '/' && pathname !== '/index.html') {
    return splitRouteParts(`${pathname}${search}`);
  }
  return splitRouteParts(`/${search}`);
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<RouterLocation>(() => readWindowLocation());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Normalize non-hash deep links (e.g., /products -> /#/products) on initial load
    // so browser refresh on any static host never hits server 404.
    if (!window.location.hash.startsWith('#/')) {
      const current = readWindowLocation();
      const targetHash = `#${current.pathname}${current.search}`;
      window.history.replaceState(null, '', `/${targetHash}`);
      setLocation(current);
    }

    const handleSync = () => {
      setLocation(readWindowLocation());
    };
    window.addEventListener('hashchange', handleSync);
    window.addEventListener('popstate', handleSync);
    return () => {
      window.removeEventListener('hashchange', handleSync);
      window.removeEventListener('popstate', handleSync);
    };
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const normalized = normalizeRouteTarget(to);
    if (typeof window !== 'undefined') {
      const targetUrl = `/#${normalized}`;
      const currentHash = window.location.hash || '#/';
      if (currentHash !== `#${normalized}` || window.location.pathname !== '/') {
        if (options?.replace) {
          window.history.replaceState(null, '', targetUrl);
        } else {
          window.history.pushState(null, '', targetUrl);
        }
      }
      setLocation(splitRouteParts(normalized));
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
  const normalized = normalizeRouteTarget(to);

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
    navigate(normalized, { replace });
  };

  return (
    <a href={`#${normalized}`} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
