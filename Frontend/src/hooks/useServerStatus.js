// Frontend/src/hooks/useServerStatus.js
import { useEffect, useState } from 'react';
import { checkHealth } from '../lib/api.js';

export default function useServerStatus() {
  const [status, setStatus] = useState('checking'); // checking | online | offline

  useEffect(() => {
    let alive = true;
    checkHealth()
      .then(() => alive && setStatus('online'))
      .catch(() => alive && setStatus('offline'));
    return () => {
      alive = false;
    };
  }, []);

  return status;
}