export function Footer() {
  return (
    <footer className="border-t border-gray-200/60 bg-gray-50 dark:border-orbis-border/60 dark:bg-orbis-surface">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img src="/logo/orbis-mark.svg" alt="" className="h-6 w-6" />
              <span className="text-sm font-bold">ORBIS.ID</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Your identity, your data, your rules. A member-owned self-sovereign identity platform.
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Product</h4>
            <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
              <li><a href="#features" className="hover:text-orbis-primary dark:hover:text-orbis-secondary">Features</a></li>
              <li><a href="#tiers" className="hover:text-orbis-primary dark:hover:text-orbis-secondary">Pricing</a></li>
              <li><a href="/wallet" className="hover:text-orbis-primary dark:hover:text-orbis-secondary">Wallet</a></li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Developers</h4>
            <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
              <li><a href="#" className="hover:text-orbis-primary dark:hover:text-orbis-secondary">Documentation</a></li>
              <li><a href="#" className="hover:text-orbis-primary dark:hover:text-orbis-secondary">API Reference</a></li>
              <li><a href="#" className="hover:text-orbis-primary dark:hover:text-orbis-secondary">GitHub</a></li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Company</h4>
            <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
              <li><a href="#" className="hover:text-orbis-primary dark:hover:text-orbis-secondary">About</a></li>
              <li><a href="#" className="hover:text-orbis-primary dark:hover:text-orbis-secondary">Governance</a></li>
              <li><a href="#" className="hover:text-orbis-primary dark:hover:text-orbis-secondary">Privacy</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-200/60 pt-6 text-center text-xs text-gray-400 dark:border-orbis-border/60 dark:text-gray-500">
          &copy; {new Date().getFullYear()} ORBIS.ID. Member-owned. Privacy by design.
        </div>
      </div>
    </footer>
  );
}