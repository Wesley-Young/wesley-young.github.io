'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef } from 'react';

export interface NavItem {
  href: string;
  label: string;
  target?: string;
  rel?: string;
}

export default function NavDropdown({ items }: { items: NavItem[] }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const closeMenu = useCallback(() => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const details = detailsRef.current;
      if (!details?.open) return;
      if (details.contains(event.target as Node)) return;
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
          <Link key={item.href} href={item.href} target={item.target} rel={item.rel} onClick={closeMenu}>
            {item.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
