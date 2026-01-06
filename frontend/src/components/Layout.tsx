import { Link, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, AlertTriangle, Search, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Findings', href: '/findings', icon: AlertTriangle },
  { name: 'Events', href: '/events', icon: Activity },
  { name: 'Query', href: '/query', icon: Search },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-gray-900">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 px-6 border-b border-gray-800">
          <Shield className="h-8 w-8 text-indigo-400" />
          <div>
            <span className="text-lg font-bold text-white">SERAPH</span>
            <p className="text-xs text-gray-400">Security Lake Dashboard</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <div className="h-2 w-2 rounded-full bg-green-400" />
            <span>Connected to AWS</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
