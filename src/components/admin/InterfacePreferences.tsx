import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BedDouble, ShoppingBag, Users, UtensilsCrossed, Wine, Sparkles, Globe, Package, BarChart2, BookOpen, Building2, UserCog, Calendar } from 'lucide-react';

export const PREF_KEY = 'admin_ui_prefs';

export interface UIPref {
  [tabValue: string]: boolean;
}

export const DEFAULT_PREFS: UIPref = {
  // Operations
  rooms: true,
  orders: true,
  'guest-services': true,
  kitchen: true,
  bar: true,
  housekeeping: true,
  // People
  payroll: true,
  schedules: true,
  // Config
  menu: true,
  reports: true,
  inventory: true,
  'resort-ops': true,
  'guest-portal': true,
};

const TAB_GROUPS = [
  {
    label: 'Operations',
    tabs: [
      { value: 'rooms', label: 'Reception', icon: <BedDouble className="w-4 h-4" /> },
      { value: 'orders', label: 'Orders', icon: <ShoppingBag className="w-4 h-4" /> },
      { value: 'guest-services', label: 'Guest Services', icon: <Users className="w-4 h-4" /> },
      { value: 'kitchen', label: 'Kitchen Monitor', icon: <UtensilsCrossed className="w-4 h-4" /> },
      { value: 'bar', label: 'Bar Monitor', icon: <Wine className="w-4 h-4" /> },
      { value: 'housekeeping', label: 'Housekeeping', icon: <Sparkles className="w-4 h-4" /> },
    ],
  },
  {
    label: 'People',
    tabs: [
      { value: 'payroll', label: 'HR', icon: <UserCog className="w-4 h-4" /> },
      { value: 'schedules', label: 'Schedules', icon: <Calendar className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Config',
    tabs: [
      { value: 'menu', label: 'Menu', icon: <BookOpen className="w-4 h-4" /> },
      { value: 'reports', label: 'Reports', icon: <BarChart2 className="w-4 h-4" /> },
      { value: 'inventory', label: 'Inventory', icon: <Package className="w-4 h-4" /> },
      { value: 'resort-ops', label: 'Resort Ops', icon: <Building2 className="w-4 h-4" /> },
      { value: 'guest-portal', label: 'Guest Portal', icon: <Globe className="w-4 h-4" /> },
    ],
  },
];

export async function loadUIPref(): Promise<UIPref> {
  const { data } = await supabase.from('site_settings' as any).select('value').eq('key', PREF_KEY).single();
  if (data?.value) return { ...DEFAULT_PREFS, ...(data.value as UIPref) };
  return DEFAULT_PREFS;
}

const InterfacePreferences = () => {
  const [prefs, setPrefs] = useState<UIPref>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadUIPref().then(p => { setPrefs(p); setLoaded(true); });
  }, []);

  const toggle = (key: string) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const save = async () => {
    setSaving(true);
    await supabase.from('site_settings' as any).upsert({ key: PREF_KEY, value: prefs });
    toast.success('Interface preferences saved — reload to apply');
    setSaving(false);
  };

  const resetAll = () => setPrefs(DEFAULT_PREFS);

  if (!loaded) return null;

  return (
    <section className="mt-8">
      <h3 className="font-display text-sm tracking-wider text-foreground mb-1">Interface</h3>
      <p className="font-body text-xs text-muted-foreground mb-4">Choose which tabs appear in the admin panel. Admin Tools are always available.</p>

      <div className="space-y-5">
        {TAB_GROUPS.map(group => (
          <div key={group.label}>
            <p className="font-display text-[10px] tracking-widest text-muted-foreground uppercase mb-2">{group.label}</p>
            <div className="space-y-1">
              {group.tabs.map(tab => (
                <div key={tab.value} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-secondary border border-border">
                  <div className="flex items-center gap-2.5">
                    <span className="text-muted-foreground">{tab.icon}</span>
                    <span className="font-body text-sm text-foreground">{tab.label}</span>
                  </div>
                  <Switch
                    checked={prefs[tab.value] ?? true}
                    onCheckedChange={() => toggle(tab.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-5">
        <Button onClick={save} disabled={saving} className="flex-1 font-display tracking-wider">
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
        <Button onClick={resetAll} variant="outline" className="font-display tracking-wider">
          Reset
        </Button>
      </div>
    </section>
  );
};

export default InterfacePreferences;
