import { useEffect, useState, useCallback, useRef } from 'react';

export function useLoad(loader, keys, interval = 0) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const current = useRef(loader);
  current.current = loader;
  const refresh = useCallback(() => setTick(t => t + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    setData(null); setError(null); setLoading(true);
    async function run() {
      try {
        const result = await current.current(controller.signal);
        if (!controller.signal.aborted) { setData(result); setError(null); }
      } catch (e) { if (!controller.signal.aborted) setError(e); }
      finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (interval) timer = setTimeout(run, interval);
        }
      }
    }
    run();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [...keys, tick, interval]);
  return { data, error, loading, refresh };
}
