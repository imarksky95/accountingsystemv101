import { useState, useEffect } from 'react';
import { buildUrl, tryFetchWithFallback, API_BASE as RESOLVED_API_BASE } from '../apiBase';

console.debug && console.debug('useRoles: resolved API_BASE =', RESOLVED_API_BASE || '(empty, using fallback)');

export function useRoles() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchRoles() {
    setLoading(true);
    try {
      const path = `/api/roles`;
      const res = await tryFetchWithFallback(path, { cache: 'no-store' });
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
  const url = buildUrl(path);
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
