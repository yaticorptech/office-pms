import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onUnauthorized, tokenStore } from '../services/api.js';
import { authApi } from '../services/resources.js';
import { ROLES } from '../utils/constants.js';
import { useToast } from './ToastContext.jsx';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // `initialising` covers the first token check, so protected routes don't flash
  // the login screen on a hard refresh.
  const [initialising, setInitialising] = useState(true);
  const toast = useToast();

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      if (!tokenStore.get()) {
        setInitialising(false);
        return;
      }
      try {
        const response = await authApi.me();
        if (!cancelled) setUser(response.data);
      } catch {
        // Expired or revoked token — start clean.
        tokenStore.clear();
      } finally {
        if (!cancelled) setInitialising(false);
      }
    };

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // Any 401 from any request ends the session exactly once.
  useEffect(
    () =>
      onUnauthorized(() => {
        setUser((current) => {
          if (current) toast.warning('Your session has expired. Please sign in again.');
          return null;
        });
        tokenStore.clear();
      }),
    [toast],
  );

  const signIn = useCallback(async (credentials) => {
    const response = await authApi.login(credentials);
    tokenStore.set(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      initialising,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === ROLES.ADMIN,
      signIn,
      signOut,
      updateUser: (patch) => setUser((current) => ({ ...current, ...patch })),
    }),
    [user, initialising, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
};
