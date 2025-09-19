import { useState, useCallback } from 'react';
import axios from 'axios';

export interface CrudOptions<T> {
  endpoint: string;
  initialData?: T[];
}

export function useCrud<T>({ endpoint, initialData = [] }: CrudOptions<T>) {
  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(endpoint);
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
      await axios.post(endpoint, item);
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
      await axios.put(`${endpoint}/${id}`, item);
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
      await axios.delete(`${endpoint}/${id}`);
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
