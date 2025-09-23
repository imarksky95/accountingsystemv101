import { useState, useEffect } from 'react';

const API_BASE = (process.env.REACT_APP_API_BASE_URL && process.env.REACT_APP_API_BASE_URL !== '')
  ? process.env.REACT_APP_API_BASE_URL
  : (window?.location?.origin || '');

export function useRoles() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchRoles() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/roles`, { cache: 'no-store' });
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
      const res = await fetch(`${API_BASE}/api/roles/${roleId}`, {
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
