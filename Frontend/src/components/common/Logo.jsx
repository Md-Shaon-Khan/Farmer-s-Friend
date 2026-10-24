// Frontend/src/components/common/Logo.jsx
export default function Logo({ size = 26 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path
        d="M16 29V14M16 14C16 7 11 4 5 4c0 7 4 10 11 10zM16 18c0-6 4-9 11-9 0 7-4 10-11 10z"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}