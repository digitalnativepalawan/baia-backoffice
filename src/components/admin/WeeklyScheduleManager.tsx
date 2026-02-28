import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, isToday } from 'date-fns';
import { Plus, Pencil, Trash2, Calendar as CalIcon, Clock, Users } from 'lucide-react';

type Employee = { id: string; name: string };
type Schedule = {
  id: string; employee_id: string; schedule_date: string;
  time_in: string; time_out: string; created_at: string; updated_at: string;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const fmtTime = (t: string) => {
  try {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch { return t; }
};

const PRESETS = [
  { label: 'Morning', time_in: '07:00', time_out: '16:00' },
  { label: 'Evening', time_in: '12:00', time_out: '21:00' },
  { label: 'Maintenance', time_in: '08:00', time_out: '17:00' },
];

const WeeklyScheduleManager = () => {
  const isMobile = useIsMobile();
  const qc = useQueryClient();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const [shiftModal, setShiftModal] = useState<{ mode: 'add' | 'edit'; schedule?: Schedule; date?: string; empId?: string } | null>(null);
  const [shiftForm, setShiftForm] = useState({ employee_id: '', schedule_date: '', time_in: '07:00', time_out: '16:00' });
  const [empWeekModal, setEmpWeekModal] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees-schedule'],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('id, name').eq('active', true).order('name');
      return (data || []) as Employee[];
    },
  });

  const startStr = format(weekStart, 'yyyy-MM-dd');
  const endStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ['weekly-schedules', startStr],
    queryFn: async () => {
      const { data } = await supabase.from('weekly_schedules').select('*')
        .gte('schedule_date', startStr).lte('schedule_date', endStr);
      return (data || []) as Schedule[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel('schedules-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_schedules' }, () => {
        qc.invalidateQueries({ queryKey: ['weekly-schedules'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        qc.invalidateQueries({ queryKey: ['employees-schedule'] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const scheduleMap = useMemo(() => {
    const m: Record<string, Schedule[]> = {};
    schedules.forEach(s => {
      const key = `${s.employee_id}_${s.schedule_date}`;
      if (!m[key]) m[key] = [];
      m[key].push(s);
    });
    return m;
  }, [schedules]);

  const empMap = useMemo(() => {
    const m: Record<string, Employee> = {};
    employees.forEach(e => { m[e.id] = e; });
    return m;
  }, [employees]);

  const openAdd = (date?: string, empId?: string) => {
    setShiftForm({ employee_id: empId || employees[0]?.id || '', schedule_date: date || format(new Date(), 'yyyy-MM-dd'), time_in: '07:00', time_out: '16:00' });
    setShiftModal({ mode: 'add', date, empId });
  };

  const openEdit = (s: Schedule) => {
    setShiftForm({ employee_id: s.employee_id, schedule_date: s.schedule_date, time_in: s.time_in.slice(0, 5), time_out: s.time_out.slice(0, 5) });
    setShiftModal({ mode: 'edit', schedule: s });
  };

  const saveShift = async () => {
    if (!shiftForm.employee_id || !shiftForm.schedule_date) return;
    if (shiftModal?.mode === 'edit' && shiftModal.schedule) {
      await supabase.from('weekly_schedules').update({
        employee_id: shiftForm.employee_id, schedule_date: shiftForm.schedule_date,
        time_in: shiftForm.time_in, time_out: shiftForm.time_out,
      }).eq('id', shiftModal.schedule.id);
      toast.success('Shift updated');
    } else {
      await supabase.from('weekly_schedules').insert({
        employee_id: shiftForm.employee_id, schedule_date: shiftForm.schedule_date,
        time_in: shiftForm.time_in, time_out: shiftForm.time_out,
      });
      toast.success('Shift added');
    }
    setShiftModal(null);
    qc.invalidateQueries({ queryKey: ['weekly-schedules'] });
  };

  const addBrokenShift = async () => {
    if (!shiftForm.employee_id || !shiftForm.schedule_date) return;
    await supabase.from('weekly_schedules').insert([
      { employee_id: shiftForm.employee_id, schedule_date: shiftForm.schedule_date, time_in: '07:00', time_out: '11:00' },
      { employee_id: shiftForm.employee_id, schedule_date: shiftForm.schedule_date, time_in: '17:00', time_out: '21:00' },
    ]);
    toast.success('Broken shift added');
    setShiftModal(null);
    qc.invalidateQueries({ queryKey: ['weekly-schedules'] });
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('weekly_schedules').delete().eq('id', deleteId);
    setDeleteId(null);
    qc.invalidateQueries({ queryKey: ['weekly-schedules'] });
    toast.success('Shift deleted');
  };

  const goCurrentWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaySchedules = schedules.filter(s => s.schedule_date === todayStr);

  // MOBILE VIEW — stacked cards
  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg tracking-wider text-foreground">Today's Schedule</h2>
          <Button size="sm" variant="outline" className="font-display text-xs h-10 min-w-[44px]" onClick={() => openAdd(todayStr)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>

        {todaySchedules.length === 0 && (
          <p className="font-body text-sm text-muted-foreground text-center py-8">No shifts scheduled today</p>
        )}

        {todaySchedules.map(s => (
          <Card key={s.id} className="bg-card border-border" onClick={() => setEmpWeekModal(s.employee_id)}>
            <CardContent className="p-3">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-body text-sm font-semibold text-foreground">{empMap[s.employee_id]?.name || 'Unknown'}</div>
                  <div className="flex items-center gap-1 font-body text-xs text-muted-foreground mt-0.5">
                    <Clock className="h-3 w-3" />
                    {fmtTime(s.time_in)} – {fmtTime(s.time_out)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-10 w-10 p-0" onClick={e => { e.stopPropagation(); openEdit(s); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-10 w-10 p-0 text-destructive" onClick={e => { e.stopPropagation(); setDeleteId(s.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Employee Week Modal */}
        <Dialog open={!!empWeekModal} onOpenChange={() => setEmpWeekModal(null)}>
          <DialogContent className="bg-card border-border max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">{empWeekModal ? empMap[empWeekModal]?.name : ''} — Week Schedule</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {weekDates.map(d => {
                const dateStr = format(d, 'yyyy-MM-dd');
                const dayScheds = scheduleMap[`${empWeekModal}_${dateStr}`] || [];
                return (
                  <Card key={dateStr} className="bg-secondary border-border">
                    <CardContent className="p-3">
                      <div className="font-body text-xs font-semibold text-foreground mb-1">{format(d, 'EEE, MMM d')}</div>
                      {dayScheds.length === 0 && <div className="font-body text-xs text-muted-foreground">Off</div>}
                      {dayScheds.map(s => (
                        <div key={s.id} className="flex items-center gap-1 font-body text-xs text-foreground">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {fmtTime(s.time_in)} – {fmtTime(s.time_out)}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* Shift Modal */}
        <ShiftModal shiftModal={shiftModal} shiftForm={shiftForm} setShiftForm={setShiftForm}
          employees={employees} saveShift={saveShift} addBrokenShift={addBrokenShift}
          onClose={() => setShiftModal(null)} />

        {/* Delete confirmation */}
        <DeleteConfirm deleteId={deleteId} setDeleteId={setDeleteId} onConfirm={confirmDelete} />
      </div>
    );
  }

  // DESKTOP VIEW — calendar grid matching screenshot
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-grow">
          <CalIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-lg tracking-wider text-foreground">Weekly Schedule Manager</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-body text-xs text-muted-foreground">Start Week:</span>
          <Input type="date" value={format(weekStart, 'yyyy-MM-dd')}
            onChange={e => { if (e.target.value) setWeekStart(startOfWeek(new Date(e.target.value + 'T00:00:00'), { weekStartsOn: 0 })); }}
            className="bg-secondary border-border text-foreground font-body text-xs h-9 w-40" />
        </div>
        <Button size="sm" variant="outline" className="font-display text-xs h-9" onClick={goCurrentWeek}>
          Current Week
        </Button>
        <span className="font-body text-xs text-accent">
          Week of {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
        </span>
      </div>

      {/* Calendar Grid */}
      <Card className="bg-card border-border overflow-x-auto">
        <CardContent className="p-0">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-center p-3 font-display text-muted-foreground min-w-[100px] border-r border-border">
                  <div className="flex flex-col items-center gap-0.5">
                    <Users className="h-4 w-4" />
                    <span>Employee</span>
                  </div>
                </th>
                {weekDates.map((d, i) => (
                  <th key={i} className={`text-center p-3 font-display min-w-[110px] border-r border-border last:border-r-0 ${isToday(d) ? 'text-accent bg-accent/5' : 'text-foreground'}`}>
                    <div>{DAYS[i]}</div>
                    <div className="text-[10px] text-muted-foreground font-body">{format(d, 'd')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} className="border-b border-border last:border-b-0">
                  <td className="p-3 font-body text-foreground font-semibold text-sm border-r border-border align-top">
                    {emp.name}
                  </td>
                  {weekDates.map((d, i) => {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const dayScheds = scheduleMap[`${emp.id}_${dateStr}`] || [];
                    return (
                      <td key={i} className={`p-2 text-center align-top border-r border-border last:border-r-0 group ${isToday(d) ? 'bg-accent/5' : ''}`}>
                        <div className="space-y-1.5 min-h-[48px] flex flex-col items-center justify-start">
                          {dayScheds.map(s => (
                            <div key={s.id} className="relative bg-secondary rounded-md px-2 py-2 text-left w-full group/shift">
                              <div className="flex items-start gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                <div className="font-body text-[11px] text-foreground leading-tight">
                                  <div className="font-semibold">{fmtTime(s.time_in)}</div>
                                  <div className="text-muted-foreground">-</div>
                                  <div className="font-semibold">{fmtTime(s.time_out)}</div>
                                </div>
                              </div>
                              <div className="absolute top-1 right-1 hidden group-hover/shift:flex gap-0.5">
                                <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-background/50 text-muted-foreground hover:text-accent transition-colors">
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button onClick={() => setDeleteId(s.id)} className="p-1 rounded hover:bg-background/50 text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => openAdd(dateStr, emp.id)}
                            className="text-muted-foreground hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity p-1">
                            <Plus className="h-4 w-4 mx-auto" />
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Shift Modal */}
      <ShiftModal shiftModal={shiftModal} shiftForm={shiftForm} setShiftForm={setShiftForm}
        employees={employees} saveShift={saveShift} addBrokenShift={addBrokenShift}
        onClose={() => setShiftModal(null)} />

      {/* Delete confirmation */}
      <DeleteConfirm deleteId={deleteId} setDeleteId={setDeleteId} onConfirm={confirmDelete} />
    </div>
  );
};

// Shift Add/Edit Modal
const ShiftModal = ({ shiftModal, shiftForm, setShiftForm, employees, saveShift, addBrokenShift, onClose }: {
  shiftModal: any; shiftForm: any; setShiftForm: any; employees: Employee[];
  saveShift: () => void; addBrokenShift: () => void; onClose: () => void;
}) => (
  <Dialog open={!!shiftModal} onOpenChange={() => onClose()}>
    <DialogContent className="bg-card border-border max-w-sm">
      <DialogHeader>
        <DialogTitle className="font-display text-foreground">{shiftModal?.mode === 'edit' ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label className="font-body text-xs text-muted-foreground">Employee</Label>
          <Select value={shiftForm.employee_id} onValueChange={v => setShiftForm((p: any) => ({ ...p, employee_id: v }))}>
            <SelectTrigger className="bg-secondary border-border text-foreground font-body"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              {employees.map(e => <SelectItem key={e.id} value={e.id} className="font-body text-foreground">{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="font-body text-xs text-muted-foreground">Date</Label>
          <Input type="date" value={shiftForm.schedule_date} onChange={e => setShiftForm((p: any) => ({ ...p, schedule_date: e.target.value }))}
            className="bg-secondary border-border text-foreground font-body text-xs h-9" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="font-body text-xs text-muted-foreground">Time In</Label>
            <Input type="time" value={shiftForm.time_in} onChange={e => setShiftForm((p: any) => ({ ...p, time_in: e.target.value }))}
              className="bg-secondary border-border text-foreground font-body text-xs h-9" />
          </div>
          <div>
            <Label className="font-body text-xs text-muted-foreground">Time Out</Label>
            <Input type="time" value={shiftForm.time_out} onChange={e => setShiftForm((p: any) => ({ ...p, time_out: e.target.value }))}
              className="bg-secondary border-border text-foreground font-body text-xs h-9" />
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {PRESETS.map(p => (
            <Button key={p.label} size="sm" variant="outline" className="font-display text-[10px] h-8"
              onClick={() => setShiftForm((f: any) => ({ ...f, time_in: p.time_in, time_out: p.time_out }))}>
              {p.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="font-display text-[10px] h-8" onClick={addBrokenShift}>
            Broken Shift
          </Button>
        </div>

        <Button onClick={saveShift} className="w-full font-display tracking-wider">
          {shiftModal?.mode === 'edit' ? 'Update Shift' : 'Add Shift'}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

// Delete Confirmation Dialog
const DeleteConfirm = ({ deleteId, setDeleteId, onConfirm }: {
  deleteId: string | null; setDeleteId: (id: string | null) => void; onConfirm: () => void;
}) => (
  <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
    <AlertDialogContent className="bg-card border-border">
      <AlertDialogHeader>
        <AlertDialogTitle className="font-display text-foreground">Delete Shift?</AlertDialogTitle>
        <AlertDialogDescription className="font-body text-muted-foreground">This action cannot be undone.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="font-display">Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground font-display">Delete</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default WeeklyScheduleManager;
