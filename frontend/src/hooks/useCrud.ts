import { useState, useCallback } from 'react';
import axios from 'axios';
import { buildUrl, API_BASE as RESOLVED_API_BASE } from '../apiBase';

export interface CrudOptions<T> {
  endpoint: string; // e.g. '/api/contacts'
  initialData?: T[];
}

export function useCrud<T>({ endpoint, initialData = [] }: CrudOptions<T>) {
  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.debug && console.debug('useCrud: resolved API_BASE =', RESOLVED_API_BASE || '(empty, using fallback)');

  const makeUrl = (ep: string) => buildUrl(ep.startsWith('/') ? ep : '/' + ep);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = makeUrl(endpoint);
      const res = await axios.get(url);
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  const add = useCallback(async (item: Partial<T>) => {
    setLoading(true);
    setError(null);
    try {
      const url = makeUrl(endpoint);
      await axios.post(url, item);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, fetchAll]);

  const update = useCallback(async (id: string | number, item: Partial<T>) => {
    setLoading(true);
    setError(null);
    try {
      const url = makeUrl(`${endpoint}/${id}`);
      await axios.put(url, item);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, fetchAll]);

  const remove = useCallback(async (id: string | number) => {
    setLoading(true);
    setError(null);
    try {
      const url = makeUrl(`${endpoint}/${id}`);
      await axios.delete(url);
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
