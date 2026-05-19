import Link from 'next/link';
import Image from 'next/image';

export function Header() {
  return (
    <header className="flex-shrink-0 z-50 bg-white shadow-sm h-16 sm:h-20">
      <div className="h-1.5 w-full bg-[var(--color-cyc-primary)]" />
      <div className="w-full h-[calc(100%-0.375rem)] px-4 sm:px-8">
        <div className="flex justify-between items-center h-full">
          <Link href="/" className="flex items-center h-full py-1">
            <Image 
              src="/logo.jpg" 
              alt="CYC Logo" 
              width={250} 
              height={70} 
              className="object-contain h-full w-auto"
              priority
            />
          </Link>
          <nav className="flex space-x-6">
            <Link 
              href="/admin" 
              className="text-gray-700 hover:text-[var(--color-cyc-secondary)] text-sm font-semibold transition-colors"
            >
              Admin
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
