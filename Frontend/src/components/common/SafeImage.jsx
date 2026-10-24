// Frontend/src/components/common/SafeImage.jsx
import { useState } from 'react';

// Renders nothing if the image file is missing (same as the old onerror="this.remove()")
export default function SafeImage({ src, alt = '', ...rest }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={src} alt={alt} onError={() => setFailed(true)} {...rest} />;
}