import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasAccess, canEdit } from '@/lib/permissions';
import { getStaffSession } from '@/lib/session';
import ReceptionHome from '@/components/staff/ReceptionHome';
import HousekeepingHome from '@/components/staff/HousekeepingHome';
import KitchenHome from '@/components/staff/KitchenHome';
import BarHome from '@/components/staff/BarHome';
import ExperiencesHome from '@/components/staff/ExperiencesHome';
import StaffOrderHome from '@/components/staff/StaffOrderHome';
import ActionRequiredPanel from '@/components/staff/ActionRequiredPanel';
import StaffNavBar from '@/components/StaffNavBar';
import StaffBottomNav from '@/components/StaffBottomNav';
import MorningBriefing from '@/components/MorningBriefing';
import { useDepartmentAlerts } from '@/hooks/useDepartmentAlerts';
import { BedDouble, Sparkles, UtensilsCrossed, Wine, Compass, ShoppingBag } from 'lucide-react';

interface RoleDef {
  key: string;
  label: string;
  perm: string;
  icon: React.ReactNode;
  activeClass: string;
}

const ROLES: RoleDef[] = [
  { key: 'reception',    label: 'Reception',    perm: 'reception',    icon: <BedDouble className="w-4 h-4" />,       activeClass: 'bg-blue-600 text-white border-blue-600' },
  { key: 'housekeeping', label: 'Housekeeping', perm: 'housekeeping', icon: <Sparkles className="w-4 h-4" />,        activeClass: 'bg-emerald-600 text-white border-emerald-600' },
  { key: 'kitchen',      label: 'Kitchen',      perm: 'kitchen',      icon: <UtensilsCrossed className="w-4 h-4" />, activeClass: 'bg-orange-600 text-white border-orange-600' },
  { key: 'bar',          label: 'Bar',          perm: 'bar',          icon: <Wine className="w-4 h-4" />,            activeClass: 'bg-purple-600 text-white border-purple-600' },
  { key: 'experiences',  label: 'Experiences',  perm: 'experiences',  icon: <Compass className="w-4 h-4" />,         activeClass: 'bg-amber-600 text-white border-amber-600' },
  { key: 'orders',       label: 'Orders',       perm: 'orders',       icon: <ShoppingBag className="w-4 h-4" />,     activeClass: 'bg-cyan-600 text-white border-cyan-600' },
];

const BRIEFING_ROLES = ['reception'];
const TASKS_ROLES = ['reception', 'housekeeping', 'experiences'];

const StaffShell = () => {
  const navigate = useNavigate();
  const session = getStaffSession();
  const perms: string[] = session?.permissions || [];
  const isAdmin = perms.includes('admin');

  const availableRoles = useMemo(() => {
    if (isAdmin) return ROLES;
    return ROLES.filter(r => {
      if (r.key === 'orders') return canEdit(perms, r.perm);
      return hasAccess(perms, r.perm);
    });
  }, [perms, isAdmin]);

  const [activeRole, setActiveRole] = useState(() => availableRoles[0]?.key || 'reception');
  const alerts = useDepartmentAlerts();

  if (!session) {
    navigate('/');
    return null;
  }

  const showBriefing = isAdmin || BRIEFING_ROLES.includes(activeRole);
  const showTasks = isAdmin || TASKS_ROLES.includes(activeRole);

  return (
    <div className="min-h-screen bg-navy-texture overflow-x-hidden">
      <StaffNavBar />
      <div className="max-w-2xl mx-auto px-4 pb-24 sm:pb-6">

        {availableRoles.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {availableRoles.map(r => (
              <button
                key={r.key}
                onClick={() => setActiveRole(r.key)}
                className={`relative flex items-center gap-2 font-display text-xs tracking-wider whitespace-nowrap min-h-[44px] px-4 py-2.5 rounded-full border transition-colors ${
                  activeRole === r.key
                    ? r.activeClass
                    : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                } ${alerts[r.key as keyof typeof alerts] && activeRole !== r.key ? 'tab-pulse' : ''}`}
              >
                {r.icon}
                {r.label}
                {alerts[r.key as keyof typeof alerts] && activeRole !== r.key && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-background" />
                )}
              </button>
            ))}
          </div>
        )}

        {showBriefing && <MorningBriefing />}
        {showTasks && <ActionRequiredPanel />}

        {activeRole === 'reception'    && <ReceptionHome />}
        {activeRole === 'housekeeping' && <HousekeepingHome />}
        {activeRole === 'kitchen'      && <KitchenHome />}
        {activeRole === 'bar'          && <BarHome />}
        {activeRole === 'experiences'  && <ExperiencesHome />}
        {activeRole === 'orders'       && <StaffOrderHome />}

      </div>
      <StaffBottomNav />
    </div>
  );
};

export default StaffShell;
