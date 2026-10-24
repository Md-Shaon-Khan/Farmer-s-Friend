// Frontend/src/components/common/Button.jsx
import { Link } from 'react-router-dom';

export default function Button({
  to,
  href,
  variant = 'solid', // solid | out
  size,              // 'sm' | undefined
  className = '',
  children,
  ...rest
}) {
  const cls = ['btn', variant !== 'solid' && variant, size, className]
    .filter(Boolean)
    .join(' ');

  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}