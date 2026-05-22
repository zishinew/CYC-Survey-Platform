"use client";
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export function Header() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (pathname === '/') {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setShow(true);
    }
  }, [pathname]);

  return (
    <header className={`flex-shrink-0 z-50 bg-white h-16 sm:h-20 border-b border-gray-200/50 transition-opacity duration-[1200ms] ease-in-out ${pathname === '/' && !show ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}>
      <div className="h-1 w-full bg-[var(--color-cyc-primary)]" />
      <div className="w-full h-[calc(100%-0.375rem)] px-4 sm:px-8">
        <div className="flex justify-between items-center h-full">
          <Link href="/" className="flex items-center h-full py-1">
            <Image
              src="/logo.png"
              alt="CYC Logo"
              width={250}
              height={70}
              className="object-contain h-full w-auto dark:brightness-110"
              priority
            />
          </Link>
          <nav className="flex space-x-6">
            <Link
              href="/admin"
              className="text-gray-700 dark:text-slate-300 hover:text-[var(--color-cyc-secondary)] dark:hover:text-white text-sm font-semibold transition-colors"
            >
              Admin
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
