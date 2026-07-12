import { Link } from "@tanstack/react-router";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200/60 bg-white/80 backdrop-blur-lg dark:border-orbis-border/60 dark:bg-orbis-dark/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo/orbis-mark.svg" alt="ORBIS.ID" className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
            ORBIS.ID
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link
            to="/"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-orbis-primary dark:text-gray-400 dark:hover:text-orbis-secondary"
            activeProps={{ className: "text-orbis-primary dark:text-orbis-secondary" }}
          >
            Home
          </Link>
          <a
            href="#features"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-orbis-primary dark:text-gray-400 dark:hover:text-orbis-secondary"
          >
            Features
          </a>
          <a
            href="#tiers"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-orbis-primary dark:text-gray-400 dark:hover:text-orbis-secondary"
          >
            Tiers
          </a>
          <Link
            to="/wallet"
            className="rounded-full bg-orbis-primary px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-orbis-accent hover:shadow-lg hover:shadow-orbis-primary/25"
          >
            Open Wallet
          </Link>
        </nav>

        <Link
          to="/wallet"
          className="rounded-full bg-orbis-primary px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-orbis-accent md:hidden"
        >
          Wallet
        </Link>
      </div>
    </header>
  );
}