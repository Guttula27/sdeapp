import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

export function useApi<T = any>() {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const execute = useCallback(async (
    request: () => Promise<any>,
    opts?: { successMsg?: string; onSuccess?: (data: T) => void; silent?: boolean },
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await request();
      const result = res.data?.data ?? res.data;
      setData(result);
      if (opts?.successMsg) toast.success(opts.successMsg);
      opts?.onSuccess?.(result);
      return result as T;
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Something went wrong';
      setError(msg);
      if (!opts?.silent) toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, execute };
}

// Convenience wrappers
export function useGet<T>(path: string, deps: any[] = []) {
  const [data, setData]   = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(path);
      setData(res.data);
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Failed to fetch';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [path]);

  return { data, loading, refetch: fetch };
}
