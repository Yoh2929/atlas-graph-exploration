import { useCallback, useEffect, useState } from "react";
import { changePassword as apiChangePassword, fetchMe, login as apiLogin, logout as apiLogout, register as apiRegister, updateProfile as apiUpdateProfile } from "../api/auth.api";
import type { User } from "../types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try { setUser(await fetchMe()); }
    catch { setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    localStorage.removeItem("atlas_token");
    void loadUser();
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password);
    await loadUser();
  }, [loadUser]);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    await apiRegister(email, password, displayName);
    await login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    try { await apiLogout(); } finally { setUser(null); }
  }, []);

  const updateProfile = useCallback(async (displayName: string) => {
    setUser(await apiUpdateProfile(displayName));
  }, []);

  return { user, loading, login, register, logout, updateProfile, changePassword: apiChangePassword };
}
