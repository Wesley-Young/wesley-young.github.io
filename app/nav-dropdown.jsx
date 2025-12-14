'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef } from 'react';

export default function NavDropdown({ items }) {
  const detailsRef = useRef(null);

  const closeMenu = useCallback(() => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const details = detailsRef.current;
      if (!details || !details.open) return;
      if (details.contains(event.target)) return;
      details.open = false;
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <details ref={detailsRef} className="nav-dropdown">
      <summary aria-label="Open navigation menu">Menu</summary>
      <div className="nav-dropdown-menu">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            target={item.target}
            rel={item.rel}
            onClick={closeMenu}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
