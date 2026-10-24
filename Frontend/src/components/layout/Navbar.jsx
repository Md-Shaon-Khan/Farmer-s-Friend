// Frontend/src/components/layout/Navbar.jsx
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Logo from '../common/Logo.jsx';
import Button from '../common/Button.jsx';
import ServerStatus from '../classify/ServerStatus.jsx';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/viral', label: 'Viral' },
  { to: '/bacterial', label: 'Bacterial' },
  { to: '/fungal', label: 'Fungal' },
  { to: '/normal', label: 'Normal' },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`nav-wrap ${scrolled ? 'scrolled' : ''}`}>
      <header className="nav">
        <Link className="brand" to="/">
          <Logo /> Paddy Check
        </Link>

        <nav className={`links ${open ? 'open' : ''}`} aria-label="Main">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => (isActive ? 'on' : '')}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-right">
          {pathname === '/classify' ? (
            <ServerStatus />
          ) : (
            <Button to="/classify" size="sm">Classify a leaf</Button>
          )}
          <button
            type="button"
            className={`menu-btn ${open ? 'open' : ''}`}
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>
    </div>
  );
}