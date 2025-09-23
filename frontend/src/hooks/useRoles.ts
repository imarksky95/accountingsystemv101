import { useState, useEffect } from 'react';

let API_BASE = (process.env.REACT_APP_API_BASE_URL && process.env.REACT_APP_API_BASE_URL !== '')
  ? process.env.REACT_APP_API_BASE_URL
  : (window?.location?.origin || '');
API_BASE = API_BASE.replace(/\/$/, '');
console.debug && console.debug('useRoles: resolved API_BASE =', API_BASE);

export function useRoles() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchRoles() {
    setLoading(true);
    try {
      const path = `/api/roles`;
      const primary = API_BASE ? `${API_BASE}${path}` : path;
      const fallback = 'https://accountingsystemv101-1.onrender.com' + path;
      console.debug && console.debug('useRoles: fetching', primary);
      let res = await fetch(primary, { cache: 'no-store' }).catch(err => {
        console.warn('useRoles: primary fetch failed, trying fallback', err && err.message ? err.message : err);
        return fetch(fallback, { cache: 'no-store' });
      });
      console.debug && console.debug('useRoles: response status', res.status);
  console.debug && console.debug('useRoles: response status', res.status);
  const data = await res.json();
      setRoles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch roles', e);
    } finally {
      setLoading(false);
    }
  }

  async function updateRole(roleId: number, payload: any) {
    try {
      const token = localStorage.getItem('token');
  const path = `/api/roles/${roleId}`;
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update role');
      const updated = await res.json();
      setRoles(prev => prev.map(r => (r.role_id === updated.role_id ? updated : r)));
      return updated;
    } catch (e) {
      console.error('Update role failed', e);
      throw e;
    }
  }

  useEffect(() => {
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { roles, loading, fetchRoles, updateRole };
}
