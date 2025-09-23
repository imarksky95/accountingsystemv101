import React, { createContext, useContext, useState, useEffect } from 'react';

export type CompanyContextType = {
  companyName: string;
  setCompanyName: (name: string) => void;
};

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
};

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companyName, setCompanyName] = useState<string>(localStorage.getItem('companyName') || 'Cash Management System');

  useEffect(() => {
    let mounted = true;
  const API_BASE = (process.env.REACT_APP_API_BASE_URL && process.env.REACT_APP_API_BASE_URL.replace(/\/$/, '')) || window.location.origin || 'https://accountingsystemv101-1.onrender.com';
  console.debug && console.debug('useCrud: resolved API_BASE =', API_BASE);
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/company-profile`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const name = data.company_name ?? data.NAME ?? data.name ?? '';
        if (mounted && name) {
          setCompanyName(name);
          try {
            localStorage.setItem('companyName', name);
          } catch {}
        }
      } catch (err) {
        console.debug('CompanyProvider: failed to fetch profile', err);
      }
    };
    fetchProfile();
    return () => { mounted = false; };
  }, []);

  return (
    <CompanyContext.Provider value={{ companyName, setCompanyName }}>
      {children}
    </CompanyContext.Provider>
  );
};
