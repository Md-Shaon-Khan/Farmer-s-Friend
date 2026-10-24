// Frontend/src/hooks/useClassifier.js
import { useCallback, useEffect, useState } from 'react';
import { predictLeaf } from '../lib/api.js';

export default function useClassifier() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | analyzing | done
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // free the old object URL whenever it changes / on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectFile = useCallback((f) => {
    if (!f || !f.type.startsWith('image/')) {
      setError('Please choose an image file (JPG or PNG).');
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError('');
    setResult(null);
    setPhase('idle');
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setPreviewUrl('');
    setResult(null);
    setError('');
    setPhase('idle');
  }, []);

  const analyze = useCallback(async () => {
    if (!file) return;
    setError('');
    setPhase('analyzing');
    try {
      const data = await predictLeaf(file);
      setResult(data);
      setPhase('done');
    } catch (err) {
      console.error(err);
      setError(
        err.message.startsWith('Server responded')
          ? `The classifier returned an error (${err.message}). Check the uvicorn terminal for details.`
          : "Couldn't reach the classifier. Check that the backend is running and that your page address is in ALLOWED_ORIGINS in config.py."
      );
      setPhase('idle');
    }
  }, [file]);

  return { file, previewUrl, phase, result, error, setError, selectFile, analyze, reset };
}