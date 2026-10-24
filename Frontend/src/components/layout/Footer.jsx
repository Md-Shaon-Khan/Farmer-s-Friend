// Frontend/src/components/layout/Footer.jsx
import { Link } from 'react-router-dom';
import Logo from '../common/Logo.jsx';

const FOOT_LINKS = [
  { to: '/viral', label: 'Viral' },
  { to: '/bacterial', label: 'Bacterial' },
  { to: '/fungal', label: 'Fungal' },
  { to: '/normal', label: 'Normal' },
  { to: '/classify', label: 'Classify' },
];

export default function Footer() {
  return (
    <footer className="foot">
      <div className="row">
        <Link className="brand" to="/">
          <Logo /> Paddy Check
        </Link>
        <nav aria-label="Footer">
          {FOOT_LINKS.map((l) => (
            <Link key={l.to} to={l.to}>{l.label}</Link>
          ))}
        </nav>
      </div>
      <p className="note">
        This is only a guide. Please show the leaf to a local agriculture officer before you
        spray anything.
      </p>
    </footer>
  );
}