import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Briefcase, Monitor } from 'lucide-react';
import { getStaffSession } from '@/lib/session';
import { getHomeRoute } from '@/lib/getHomeRoute';

const StaffBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getStaffSession();
  if (!session) return null;

  const perms: string[] = session.permissions || [];
  const homeRoute = getHomeRoute(perms);

  const tabs = [
    { label: 'Home', icon: Home, path: homeRoute },
    { label: 'My Work', icon: Briefcase, path: '/employee-portal' },
    { label: 'Service', icon: Monitor, path: '/service' },
  ];

  const isActive = (path: string) =>
    path === homeRoute
      ? location.pathname === path
      : location.pathname.startsWith(path);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-background/95 backdrop-blur border-t border-border safe-area-pb">
      <div className="flex items-stretch h-16">
        {tabs.map(({ label, icon: Icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              isActive(path)
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive(path) ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="font-display text-[10px] tracking-wider uppercase">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default StaffBottomNav;
