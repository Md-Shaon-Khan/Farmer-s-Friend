// Frontend/src/components/classify/ServerStatus.jsx
import useServerStatus from '../../hooks/useServerStatus.js';

const TEXT = {
  checking: 'Checking server…',
  online: 'Server online',
  offline: 'Server offline',
};

export default function ServerStatus() {
  const status = useServerStatus();
  return <span className={`status ${status}`}>{TEXT[status]}</span>;
}