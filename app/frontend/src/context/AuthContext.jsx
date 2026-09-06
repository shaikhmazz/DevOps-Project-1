import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sf_user");
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {
      /* ignore */
    }
    setReady(true);
  }, []);

  const login = (email) => {
    const u = { email: email.toLowerCase().trim() };
    try {
      localStorage.setItem("sf_user", JSON.stringify(u));
    } catch (e) {
      console.warn("Could not persist session to localStorage:", e);
    }
    setUser(u);
    return u;
  };

  const logout = () => {
    try {
      localStorage.removeItem("sf_user");
    } catch (e) {
      /* ignore */
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
