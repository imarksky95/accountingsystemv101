import { useState, useCallback } from 'react';
import axios from 'axios';

export interface CrudOptions<T> {
  endpoint: string;
  initialData?: T[];
}

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://accountingsystemv101-1.onrender.com';

// Debug: print resolved API base so deployed bundle shows which host it's using
console.log('useCrud: resolved API_BASE =', API_BASE);

export function useCrud<T>({ endpoint, initialData = [] }: CrudOptions<T>) {
  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
      const res = await axios.get(url);
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  // Add
  const add = useCallback(async (item: Partial<T>) => {
    setLoading(true);
    setError(null);
    try {
      const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
      await axios.post(url, item);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, fetchAll]);

  // Update
  const update = useCallback(async (id: string | number, item: Partial<T>) => {
    setLoading(true);
    setError(null);
    try {
      const base = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
      await axios.put(`${base}/${id}`, item);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, fetchAll]);

  // Delete
  const remove = useCallback(async (id: string | number) => {
    setLoading(true);
    setError(null);
    try {
      const base = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
      await axios.delete(`${base}/${id}`);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, fetchAll]);

  return {
    data,
    loading,
    error,
    fetchAll,
    add,
    update,
    remove,
    setData,
  };
}
