import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getStaffSession } from '@/lib/session';

interface OpenTabModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OpenTabModal = ({ open, onOpenChange }: OpenTabModalProps) => {
  const qc = useQueryClient();
  const [locationValue, setLocationValue] = useState('');
  const [guestName, setGuestName] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: tables = [] } = useQuery({
    queryKey: ['resort_tables'],
    queryFn: async () => {
      const { data } = await supabase.from('resort_tables').select('*').eq('active', true).order('table_name');
      return data || [];
    },
  });

  const { data: occupiedUnits = [] } = useQuery({
    queryKey: ['occupied-units-tab'],
    queryFn: async () => {
      const todayISO = new Date().toISOString().split('T')[0];
      const { data: bookings } = await supabase
        .from('resort_ops_bookings')
        .select('unit_id, resort_ops_units(name)')
        .lte('check_in', todayISO)
        .gte('check_out', todayISO)
        .is('checked_out_at', null);

      if (!bookings || bookings.length === 0) return [];

      const { data: unitsList } = await supabase
        .from('units')
        .select('id, unit_name')
        .eq('active', true);

      const unitsMap = new Map(
        (unitsList || []).map(u => [u.unit_name.toLowerCase().trim(), u])
      );

      const seen = new Set<string>();
      return bookings
        .map(b => {
          const opsName = (b.resort_ops_units as any)?.name || '';
          const unit = unitsMap.get(opsName.toLowerCase().trim());
          if (!unit || seen.has(unit.unit_name)) return null;
          seen.add(unit.unit_name);
          return { id: unit.id, unit_name: unit.unit_name };
        })
        .filter(Boolean) as { id: string; unit_name: string }[];
    },
    refetchInterval: 30000,
  });

  const handleOpenTab = async () => {
    if (!locationValue) {
      toast.error('Please select a table or room');
      return;
    }
    if (!guestName.trim()) {
      toast.error('Guest name is required');
      return;
    }

    const [locType, locDetail] = locationValue.split('::', 2);
    const staffSession = getStaffSession();

    setBusy(true);
    try {
      const { error } = await supabase.from('tabs').insert({
        location_type: locType,
        location_detail: locDetail,
        guest_name: guestName.trim(),
        status: 'Open',
        opened_by: staffSession?.name || '',
      });

      if (error) throw error;

      toast.success(`Tab opened for ${guestName.trim()} at ${locDetail}`);
      qc.invalidateQueries({ queryKey: ['open-tabs-waitstaff'] });
      qc.invalidateQueries({ queryKey: ['open-tabs-picker'] });

      // Reset and close
      setLocationValue('');
      setGuestName('');
      onOpenChange(false);
    } catch {
      toast.error('Failed to open tab');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setLocationValue('');
      setGuestName('');
    }
    onOpenChange(isOpen);
  };

  const now = new Date();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider text-foreground">Open New Tab</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Location selector */}
          <div className="space-y-1.5">
            <label className="font-display text-xs tracking-wider text-muted-foreground">TABLE / LOCATION</label>
            <Select value={locationValue} onValueChange={setLocationValue}>
              <SelectTrigger className="bg-secondary border-border text-foreground font-body">
                <SelectValue placeholder="Select table or room" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border max-h-64">
                {tables.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="font-display text-xs tracking-wider text-muted-foreground">TABLES</SelectLabel>
                    {tables.map((t: any) => (
                      <SelectItem key={t.id} value={`DineIn::${t.table_name}`} className="text-foreground font-body">
                        🪑 {t.table_name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {occupiedUnits.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="font-display text-xs tracking-wider text-muted-foreground">OCCUPIED ROOMS</SelectLabel>
                    {occupiedUnits.map((u: any) => (
                      <SelectItem key={u.id} value={`Room::${u.unit_name}`} className="text-foreground font-body">
                        🏠 {u.unit_name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Guest name */}
          <div className="space-y-1.5">
            <label className="font-display text-xs tracking-wider text-muted-foreground">GUEST NAME</label>
            <Input
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="Enter guest name"
              className="bg-secondary border-border text-foreground font-body"
              onKeyDown={e => { if (e.key === 'Enter') handleOpenTab(); }}
            />
          </div>

          {/* Date/time — display only */}
          <div className="space-y-1.5">
            <label className="font-display text-xs tracking-wider text-muted-foreground">OPENED AT</label>
            <div className="bg-secondary border border-border rounded-md px-3 py-2 font-body text-sm text-muted-foreground">
              {format(now, 'MMM d, yyyy · h:mm a')}
            </div>
          </div>
        </div>

        <Button
          onClick={handleOpenTab}
          disabled={busy || !locationValue || !guestName.trim()}
          className="w-full font-display tracking-wider bg-gold text-background hover:bg-gold/90 min-h-[48px]"
        >
          {busy ? 'Opening…' : 'Open Tab'}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default OpenTabModal;
