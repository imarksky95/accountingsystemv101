import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { getMe } from './auth';

interface User {
  user_id: number;
  username: string;
  role_id: number;
}


interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  login: () => {},
  logout: () => {},
});

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  // Restore user from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch {
        setUser(null);
      }
      // Optionally, validate token with backend
      getMe(token)
        .then(res => setUser(res.data))
        .catch(() => {
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        });
    }
  }, []);

  // Login: set user and token in state and localStorage
  const login = (user: User, token: string) => {
    setUser(user);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  };

  // Logout: clear user and token from state and localStorage
  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <UserContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};
