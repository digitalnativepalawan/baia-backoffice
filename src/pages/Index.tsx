import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResortProfile } from '@/hooks/useResortProfile';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';
import { getStaffSession, setStaffSession, isRemembered } from '@/lib/session';
import ThemeToggle from '@/components/ThemeToggle';

const Index = () => {
  const navigate = useNavigate();
  const { data: profile } = useResortProfile();
  const logoSize = profile?.logo_size || 128;

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(() => isRemembered());
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    const existing = getStaffSession();
    if (existing) {
      const perms: string[] = existing.permissions || [];
      const isAdmin = existing.isAdmin || perms.includes('admin');
      navigate(isAdmin ? '/admin' : '/staff', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async () => {
    if (!name.trim() || !pin) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('employee-auth', {
        body: { action: 'verify', name: name.trim(), pin },
      });
      if (error || data?.error) {
        toast.error(data?.error || 'Login failed');
        setLoading(false);
        return;
      }

      setStaffSession(
        {
          name: data.employee.name,
          employeeId: data.employee.id,
          isAdmin: data.isAdmin || false,
          permissions: data.permissions || [],
        },
        remember,
      );
      localStorage.setItem('emp_id', data.employee.id);
      localStorage.setItem('emp_name', data.employee.name);
      toast.success(`Welcome, ${data.employee.name}`);

      if (isAdminMode) {
        const perms = data.permissions || [];
        if (data.isAdmin || perms.includes('admin')) {
          navigate('/admin');
        } else {
          toast.error('Admin access required');
        }
      } else {
        navigate('/staff');
      }
    } catch {
      toast.error('Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-navy-texture flex flex-col items-center justify-center px-6 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {profile?.logo_url && (
        <div className="mb-6" style={{ width: logoSize, height: logoSize }}>
          <img
            src={profile.logo_url}
            alt={profile.resort_name || 'Resort logo'}
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {profile?.resort_name && (
        <h1 className="font-display text-4xl md:text-5xl tracking-[0.2em] text-foreground text-center mb-2">
          {profile.resort_name}
        </h1>
      )}

      {profile?.tagline && (
        <p className="font-body text-sm text-muted-foreground tracking-wider mb-1">{profile.tagline}</p>
      )}

      <div className="mb-10" />

      <div className="w-full max-w-xs space-y-3">
        <p className="font-display text-xs tracking-[0.2em] text-muted-foreground text-center uppercase mb-4">
          {isAdminMode ? 'Admin Login' : 'Staff Login'}
        </p>

        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          className="bg-secondary border-border text-foreground font-body text-center text-lg h-12"
          onKeyDown={e => { if (e.key === 'Enter') document.getElementById('home-pin')?.focus(); }}
          autoFocus
        />
        <Input
          id="home-pin"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="PIN"
          className="bg-secondary border-border text-foreground font-body text-center text-2xl tracking-[0.5em] h-14"
          onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
        />

        <div className="flex items-center gap-2 px-1">
          <Checkbox
            id="remember-me"
            checked={remember}
            onCheckedChange={(v) => setRemember(v === true)}
          />
          <label htmlFor="remember-me" className="font-body text-sm text-muted-foreground cursor-pointer select-none">
            Remember me on this device
          </label>
        </div>

        <Button
          onClick={handleLogin}
          disabled={loading || !name.trim() || !pin}
          className="w-full font-display text-sm tracking-wider h-12"
        >
          {loading ? 'Verifying...' : 'Sign In'}
        </Button>

        <button
          onClick={() => { setIsAdminMode(v => !v); setName(''); setPin(''); }}
          className="w-full flex items-center justify-center gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
        >
          <Shield className="w-3.5 h-3.5" />
          {isAdminMode ? 'Switch to Staff Login' : 'Admin Login'}
        </button>
      </div>
    </div>
  );
};

export default Index;
