import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload, Trash2, Plus, Users, FileText, UtensilsCrossed, MapPin, StickyNote, Sparkles, LogIn, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import VibeCheckInForm from './vibe/VibeCheckInForm';
import VibeDetailView from './vibe/VibeDetailView';

const from = (table: string) => supabase.from(table as any);

type DetailTab = 'info' | 'orders' | 'documents' | 'notes' | 'tours' | 'vibe';

const RoomsDashboard = () => {
  const qc = useQueryClient();
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('info');
  const [vibeMode, setVibeMode] = useState<'list' | 'form' | 'detail'>('list');
  const [editingVibeRecord, setEditingVibeRecord] = useState<any>(null);
  const [viewingVibeRecord, setViewingVibeRecord] = useState<any>(null);

  // Check-in form state
  const [checkInForm, setCheckInForm] = useState({
    guestName: '', phone: '', email: '',
    checkIn: new Date().toISOString().split('T')[0],
    checkOut: '', adults: '1', platform: 'Direct', roomRate: '0', notes: '',
  });
  const [checkingIn, setCheckingIn] = useState(false);
  const [showCheckInForm, setShowCheckInForm] = useState(false);

  // Units
  const { data: units = [] } = useQuery({
    queryKey: ['rooms-units'],
    queryFn: async () => {
      const { data } = await supabase.from('units').select('*').eq('active', true).order('unit_name');
      return (data || []).map((u: any) => ({ ...u, name: u.unit_name, type: '', capacity: 0 }));
    },
  });

  // Resort ops units (for booking linkage)
  const { data: resortUnits = [] } = useQuery({
    queryKey: ['resort-ops-units'],
    queryFn: async () => {
      const { data } = await from('resort_ops_units').select('*');
      return (data || []) as any[];
    },
  });

  // Bookings (current)
  const { data: bookings = [] } = useQuery({
    queryKey: ['rooms-bookings'],
    queryFn: async () => {
      const { data } = await supabase.from('resort_ops_bookings').select('*, resort_ops_guests(*)').order('check_in', { ascending: false });
      return data || [];
    },
  });

  // All vibe records (for grid view badges)
  const { data: vibeRecords = [] } = useQuery({
    queryKey: ['vibe-records'],
    queryFn: async () => {
      const { data } = await from('guest_vibe_records')
        .select('*').eq('checked_out', false).order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  // Orders for selected unit
  const { data: unitOrders = [] } = useQuery({
    queryKey: ['rooms-orders', selectedUnit?.name],
    enabled: !!selectedUnit,
    queryFn: async () => {
      const { data } = await supabase.from('orders').select('*')
        .eq('order_type', 'Room')
        .eq('location_detail', selectedUnit!.name)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Resolve resort_ops_unit for a room name
  const resolveResortUnit = (roomName: string) => {
    return resortUnits.find((ru: any) => ru.name.toLowerCase().trim() === roomName.toLowerCase().trim());
  };

  // Guest documents - match booking by resort_ops_unit mapped from room name
  const getActiveBooking = (unit: any) => {
    if (!unit) return null;
    const today = new Date().toISOString().split('T')[0];
    const resortUnit = resolveResortUnit(unit.name);
    if (!resortUnit) return null;
    return bookings.find((b: any) => b.unit_id === resortUnit.id && b.check_in <= today && b.check_out >= today) || null;
  };

  const currentBooking = getActiveBooking(selectedUnit);
  const guestId = (currentBooking as any)?.guest_id;

  const { data: documents = [] } = useQuery({
    queryKey: ['guest-documents', guestId],
    enabled: !!guestId,
    queryFn: async () => {
      const { data } = await from('guest_documents').select('*').eq('guest_id', guestId).order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  // Guest notes
  const { data: notes = [] } = useQuery({
    queryKey: ['guest-notes', selectedUnit?.name],
    enabled: !!selectedUnit,
    queryFn: async () => {
      const { data } = await from('guest_notes').select('*').eq('unit_name', selectedUnit!.name).order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  // Guest tours
  const { data: tours = [] } = useQuery({
    queryKey: ['guest-tours', currentBooking?.id],
    enabled: !!currentBooking,
    queryFn: async () => {
      const { data } = await from('guest_tours').select('*').eq('booking_id', currentBooking!.id).order('tour_date');
      return (data || []) as any[];
    },
  });

  // Vibe records for selected unit
  const unitVibeRecords = vibeRecords.filter((v: any) => v.unit_name === selectedUnit?.name);

  // Note form
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('general');

  const addNote = async () => {
    if (!noteContent.trim() || !selectedUnit) return;
    await from('guest_notes').insert({
      booking_id: currentBooking?.id || null,
      unit_name: selectedUnit.name,
      note_type: noteType,
      content: noteContent.trim(),
      created_by: 'admin',
    });
    setNoteContent('');
    qc.invalidateQueries({ queryKey: ['guest-notes', selectedUnit.name] });
    toast.success('Note added');
  };

  const deleteNote = async (id: string) => {
    await from('guest_notes').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['guest-notes', selectedUnit?.name] });
    toast.success('Note deleted');
  };

  // Tour form
  const [tourName, setTourName] = useState('');
  const [tourDate, setTourDate] = useState('');
  const [tourPax, setTourPax] = useState('1');
  const [tourPrice, setTourPrice] = useState('');

  const addTour = async () => {
    if (!tourName.trim() || !tourDate || !currentBooking) return;
    await from('guest_tours').insert({
      booking_id: currentBooking.id,
      tour_name: tourName.trim(),
      tour_date: tourDate,
      pax: parseInt(tourPax) || 1,
      price: parseFloat(tourPrice) || 0,
    });
    setTourName(''); setTourDate(''); setTourPax('1'); setTourPrice('');
    qc.invalidateQueries({ queryKey: ['guest-tours', currentBooking.id] });
    toast.success('Tour added');
  };

  const updateTourStatus = async (id: string, status: string) => {
    await from('guest_tours').update({ status }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['guest-tours', currentBooking?.id] });
    toast.success('Tour updated');
  };

  // Document upload
  const uploadDocument = async (file: File) => {
    if (!guestId) { toast.error('No guest checked in'); return; }
    const ext = file.name.split('.').pop();
    const path = `${guestId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('guest-documents').upload(path, file);
    if (error) { toast.error('Upload failed'); return; }
    const { data: urlData } = supabase.storage.from('guest-documents').getPublicUrl(path);
    await from('guest_documents').insert({
      guest_id: guestId,
      document_type: 'passport',
      image_url: urlData.publicUrl,
    });
    qc.invalidateQueries({ queryKey: ['guest-documents', guestId] });
    toast.success('Document uploaded');
  };

  const deleteDocument = async (doc: any) => {
    const path = doc.image_url.split('/guest-documents/')[1];
    if (path) await supabase.storage.from('guest-documents').remove([path]);
    await from('guest_documents').delete().eq('id', doc.id);
    qc.invalidateQueries({ queryKey: ['guest-documents', guestId] });
    toast.success('Document deleted');
  };

  // Get current guest for a unit (grid view)
  const getUnitGuest = (unitName: string) => {
    const today = new Date().toISOString().split('T')[0];
    const resortUnit = resolveResortUnit(unitName);
    if (!resortUnit) return null;
    return bookings.find((b: any) => b.unit_id === resortUnit.id && b.check_in <= today && b.check_out >= today) || null;
  };

  // Check if unit has high-risk vibe record
  const getUnitVibeRisk = (unitName: string) => {
    const records = vibeRecords.filter((v: any) => v.unit_name === unitName && !v.checked_out);
    return records.some((v: any) => (v.review_risk_level || []).includes('High'));
  };

  // --- CHECK-IN ---
  const handleCheckIn = async () => {
    if (!selectedUnit || !checkInForm.guestName.trim() || !checkInForm.checkOut) {
      toast.error('Guest name and check-out date are required');
      return;
    }
    if (checkInForm.checkOut <= checkInForm.checkIn) {
      toast.error('Check-out must be after check-in');
      return;
    }
    setCheckingIn(true);
    try {
      // 1. Create or find guest
      const { data: existingGuest } = await from('resort_ops_guests')
        .select('id').ilike('full_name', checkInForm.guestName.trim()).maybeSingle() as any;

      let gId: string;
      if (existingGuest) {
        gId = existingGuest.id;
        await from('resort_ops_guests').update({
          phone: checkInForm.phone || null,
          email: checkInForm.email || null,
        }).eq('id', gId);
      } else {
        const { data: newGuest, error: gErr } = await from('resort_ops_guests').insert({
          full_name: checkInForm.guestName.trim(),
          phone: checkInForm.phone || null,
          email: checkInForm.email || null,
        }).select('id').single() as any;
        if (gErr || !newGuest) throw new Error('Failed to create guest');
        gId = newGuest.id;
      }

      // 2. Resolve or create resort_ops_unit
      let resortUnit = resolveResortUnit(selectedUnit.name);
      if (!resortUnit) {
        const { data: newUnit, error: uErr } = await from('resort_ops_units').insert({
          name: selectedUnit.name, type: 'room', capacity: 2,
        }).select('id').single() as any;
        if (uErr || !newUnit) throw new Error('Failed to create unit mapping');
        resortUnit = { id: newUnit.id };
        qc.invalidateQueries({ queryKey: ['resort-ops-units'] });
      }

      // 3. Insert booking
      const { error: bErr } = await from('resort_ops_bookings').insert({
        guest_id: gId,
        unit_id: resortUnit.id,
        platform: checkInForm.platform,
        check_in: checkInForm.checkIn,
        check_out: checkInForm.checkOut,
        adults: parseInt(checkInForm.adults) || 1,
        room_rate: parseFloat(checkInForm.roomRate) || 0,
        notes: checkInForm.notes || '',
      });
      if (bErr) throw new Error(bErr.message);

      // 4. Refresh
      qc.invalidateQueries({ queryKey: ['rooms-bookings'] });
      setShowCheckInForm(false);
      setCheckInForm({
        guestName: '', phone: '', email: '',
        checkIn: new Date().toISOString().split('T')[0],
        checkOut: '', adults: '1', platform: 'Direct', roomRate: '0', notes: '',
      });
      toast.success(`${checkInForm.guestName.trim()} checked in to ${selectedUnit.name}`);
    } catch (err: any) {
      toast.error(err.message || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  // --- CHECK-OUT ---
  const handleCheckOut = async () => {
    if (!currentBooking) return;
    const today = new Date().toISOString().split('T')[0];
    const { error } = await from('resort_ops_bookings').update({ check_out: today }).eq('id', currentBooking.id);
    if (error) { toast.error('Checkout failed'); return; }
    qc.invalidateQueries({ queryKey: ['rooms-bookings'] });
    toast.success('Guest checked out');
  };

  // DETAIL VIEW
  if (selectedUnit) {
    const booking = getActiveBooking(selectedUnit);
    const guest = (booking as any)?.resort_ops_guests;

    // Vibe sub-views
    if (detailTab === 'vibe' && vibeMode === 'form') {
      return (
        <VibeCheckInForm
          unitName={selectedUnit.name}
          existingRecord={editingVibeRecord}
          onClose={() => { setVibeMode('list'); setEditingVibeRecord(null); }}
        />
      );
    }

    if (detailTab === 'vibe' && vibeMode === 'detail' && viewingVibeRecord) {
      return (
        <VibeDetailView
          record={viewingVibeRecord}
          onBack={() => { setVibeMode('list'); setViewingVibeRecord(null); }}
          onEdit={() => { setEditingVibeRecord(viewingVibeRecord); setVibeMode('form'); }}
        />
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={() => { setSelectedUnit(null); setShowCheckInForm(false); }}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h3 className="font-display text-lg tracking-wider text-foreground">{selectedUnit.name}</h3>
          <Badge variant={booking ? 'default' : 'secondary'} className="font-body text-xs">
            {booking ? 'Occupied' : 'Vacant'}
          </Badge>
        </div>

        {/* Detail tabs */}
        <div className="flex gap-1 flex-wrap">
          {([
            { key: 'info' as DetailTab, label: 'Guest', icon: Users },
            { key: 'orders' as DetailTab, label: 'Orders', icon: UtensilsCrossed },
            { key: 'documents' as DetailTab, label: 'Docs', icon: FileText },
            { key: 'notes' as DetailTab, label: 'Notes', icon: StickyNote },
            { key: 'tours' as DetailTab, label: 'Tours', icon: MapPin },
            { key: 'vibe' as DetailTab, label: 'Vibe', icon: Sparkles },
          ]).map(({ key, label, icon: Icon }) => (
            <Button key={key} size="sm" variant={detailTab === key ? 'default' : 'outline'}
              onClick={() => { setDetailTab(key); if (key === 'vibe') setVibeMode('list'); }}
              className="font-display text-xs tracking-wider gap-1">
              <Icon className="w-3.5 h-3.5" /> {label}
            </Button>
          ))}
        </div>

        {/* GUEST INFO */}
        {detailTab === 'info' && (
          <div className="space-y-3">
            {booking ? (
              <>
                <div className="border border-border rounded-lg p-4 space-y-2">
                  <p className="font-display text-sm text-foreground">{guest?.full_name || 'Unknown Guest'}</p>
                  {guest?.email && <p className="font-body text-xs text-muted-foreground">Email: {guest.email}</p>}
                  {guest?.phone && <p className="font-body text-xs text-muted-foreground">Phone: {guest.phone}</p>}
                  <div className="flex gap-4 mt-2">
                    <div>
                      <p className="font-body text-xs text-muted-foreground">Check-in</p>
                      <p className="font-body text-sm text-foreground">{format(new Date(booking.check_in + 'T00:00:00'), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="font-body text-xs text-muted-foreground">Check-out</p>
                      <p className="font-body text-sm text-foreground">{format(new Date(booking.check_out + 'T00:00:00'), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <p className="font-body text-xs text-muted-foreground">Platform</p>
                      <p className="font-body text-sm text-foreground">{booking.platform || '—'}</p>
                    </div>
                    <div>
                      <p className="font-body text-xs text-muted-foreground">Adults</p>
                      <p className="font-body text-sm text-foreground">{booking.adults}</p>
                    </div>
                    <div>
                      <p className="font-body text-xs text-muted-foreground">Rate</p>
                      <p className="font-body text-sm text-foreground">₱{Number(booking.room_rate).toLocaleString()}</p>
                    </div>
                  </div>
                  {booking.notes && (
                    <div>
                      <p className="font-body text-xs text-muted-foreground">Booking Notes</p>
                      <p className="font-body text-sm text-foreground">{booking.notes}</p>
                    </div>
                  )}
                </div>
                <Button size="sm" variant="destructive" onClick={handleCheckOut}
                  className="w-full font-display text-xs tracking-wider min-h-[44px]">
                  <LogOut className="w-4 h-4 mr-2" /> Check Out Guest
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                {!showCheckInForm ? (
                  <div className="border border-dashed border-border rounded-lg p-6 text-center space-y-3">
                    <p className="font-body text-sm text-muted-foreground">No guest currently checked in</p>
                    <p className="font-body text-xs text-muted-foreground">Check in a guest to enable Docs, Tours, and more.</p>
                    <Button size="sm" onClick={() => setShowCheckInForm(true)}
                      className="font-display text-xs tracking-wider min-h-[44px]">
                      <LogIn className="w-4 h-4 mr-2" /> Check In Guest
                    </Button>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg p-4 space-y-3">
                    <p className="font-display text-xs tracking-wider text-foreground uppercase">Check In Guest</p>
                    <Input value={checkInForm.guestName}
                      onChange={e => setCheckInForm(p => ({ ...p, guestName: e.target.value }))}
                      placeholder="Guest full name *" className="bg-secondary border-border text-foreground font-body text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={checkInForm.phone}
                        onChange={e => setCheckInForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder="Phone" className="bg-secondary border-border text-foreground font-body text-xs" />
                      <Input value={checkInForm.email}
                        onChange={e => setCheckInForm(p => ({ ...p, email: e.target.value }))}
                        placeholder="Email" className="bg-secondary border-border text-foreground font-body text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-body text-xs text-muted-foreground">Check-in</label>
                        <Input type="date" value={checkInForm.checkIn}
                          onChange={e => setCheckInForm(p => ({ ...p, checkIn: e.target.value }))}
                          className="bg-secondary border-border text-foreground font-body text-xs" />
                      </div>
                      <div>
                        <label className="font-body text-xs text-muted-foreground">Check-out *</label>
                        <Input type="date" value={checkInForm.checkOut}
                          onChange={e => setCheckInForm(p => ({ ...p, checkOut: e.target.value }))}
                          className="bg-secondary border-border text-foreground font-body text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="font-body text-xs text-muted-foreground">Adults</label>
                        <Input type="number" value={checkInForm.adults}
                          onChange={e => setCheckInForm(p => ({ ...p, adults: e.target.value }))}
                          className="bg-secondary border-border text-foreground font-body text-xs" />
                      </div>
                      <div>
                        <label className="font-body text-xs text-muted-foreground">Platform</label>
                        <Select value={checkInForm.platform}
                          onValueChange={v => setCheckInForm(p => ({ ...p, platform: v }))}>
                          <SelectTrigger className="bg-secondary border-border text-foreground font-body text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Direct">Direct</SelectItem>
                            <SelectItem value="Airbnb">Airbnb</SelectItem>
                            <SelectItem value="Booking.com">Booking.com</SelectItem>
                            <SelectItem value="Agoda">Agoda</SelectItem>
                            <SelectItem value="Website">Website</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="font-body text-xs text-muted-foreground">Room rate</label>
                        <Input type="number" value={checkInForm.roomRate}
                          onChange={e => setCheckInForm(p => ({ ...p, roomRate: e.target.value }))}
                          className="bg-secondary border-border text-foreground font-body text-xs" />
                      </div>
                    </div>
                    <Textarea value={checkInForm.notes}
                      onChange={e => setCheckInForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Notes (optional)"
                      className="bg-secondary border-border text-foreground font-body text-sm min-h-[50px]" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setShowCheckInForm(false)}
                        className="flex-1 font-display text-xs tracking-wider min-h-[44px]">Cancel</Button>
                      <Button size="sm" onClick={handleCheckIn} disabled={checkingIn}
                        className="flex-1 font-display text-xs tracking-wider min-h-[44px]">
                        {checkingIn ? 'Checking in...' : 'Check In'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ORDERS */}
        {detailTab === 'orders' && (
          <div className="space-y-2">
            {unitOrders.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground text-center py-4">No orders for this room</p>
            ) : unitOrders.map((order: any) => (
              <div key={order.id} className="border border-border rounded-lg p-3 space-y-1">
                <div className="flex justify-between items-center">
                  <Badge variant={order.status === 'Closed' ? 'secondary' : 'default'} className="font-body text-xs">{order.status}</Badge>
                  <span className="font-body text-xs text-muted-foreground">{format(new Date(order.created_at), 'MMM d · h:mm a')}</span>
                </div>
                <div className="space-y-0.5">
                  {(order.items as any[]).map((item: any, i: number) => (
                    <p key={i} className="font-body text-xs text-foreground">
                      {item.qty || item.quantity}× {item.name} — ₱{(item.price * (item.qty || item.quantity)).toFixed(0)}
                    </p>
                  ))}
                </div>
                <p className="font-display text-xs text-foreground">Total: ₱{Number(order.total).toFixed(0)}</p>
              </div>
            ))}
          </div>
        )}

        {/* DOCUMENTS */}
        {detailTab === 'documents' && (
          <div className="space-y-3">
            {!guestId ? (
              <div className="border border-dashed border-border rounded-lg p-6 text-center space-y-2">
                <p className="font-body text-sm text-muted-foreground">No guest checked in</p>
                <p className="font-body text-xs text-muted-foreground">Check in a guest first to upload documents.</p>
                <Button size="sm" variant="outline" onClick={() => { setDetailTab('info'); setShowCheckInForm(true); }}
                  className="font-display text-xs tracking-wider">
                  <LogIn className="w-3.5 h-3.5 mr-1" /> Go to Check-In
                </Button>
              </div>
            ) : (
              <>
                <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-lg p-4 justify-center hover:bg-secondary/50">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="font-body text-sm text-muted-foreground">Upload Passport / ID</span>
                  <input type="file" accept="image/*" className="hidden" capture="environment"
                    onChange={e => { if (e.target.files?.[0]) uploadDocument(e.target.files[0]); }} />
                </label>
                {documents.map((doc: any) => (
                  <div key={doc.id} className="border border-border rounded-lg overflow-hidden">
                    <img src={doc.image_url} alt="Document" className="w-full max-h-64 object-contain bg-secondary" />
                    <div className="flex justify-between items-center p-2">
                      <span className="font-body text-xs text-muted-foreground">
                        {doc.document_type} · {format(new Date(doc.created_at), 'MMM d, yyyy')}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => deleteDocument(doc)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* NOTES */}
        {detailTab === 'notes' && (
          <div className="space-y-3">
            <div className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="w-32 bg-secondary border-border text-foreground font-body text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="request">Request</SelectItem>
                    <SelectItem value="allergy">Allergy</SelectItem>
                    <SelectItem value="preference">Preference</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea value={noteContent} onChange={e => setNoteContent(e.target.value)}
                placeholder="Add a note..." className="bg-secondary border-border text-foreground font-body text-sm min-h-[60px]" />
              <Button size="sm" onClick={addNote} disabled={!noteContent.trim()} className="font-display text-xs tracking-wider w-full">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Note
              </Button>
            </div>
            {notes.map((note: any) => (
              <div key={note.id} className="border border-border rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="outline" className="font-body text-xs mb-1">{note.note_type}</Badge>
                    <p className="font-body text-sm text-foreground">{note.content}</p>
                    <p className="font-body text-xs text-muted-foreground mt-1">
                      {note.created_by} · {format(new Date(note.created_at), 'MMM d · h:mm a')}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteNote(note.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {notes.length === 0 && <p className="font-body text-sm text-muted-foreground text-center py-2">No notes yet</p>}
          </div>
        )}

        {/* TOURS */}
        {detailTab === 'tours' && (
          <div className="space-y-3">
            {currentBooking ? (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <Input value={tourName} onChange={e => setTourName(e.target.value)} placeholder="Tour name"
                  className="bg-secondary border-border text-foreground font-body text-sm" />
                <div className="grid grid-cols-3 gap-2">
                  <Input type="date" value={tourDate} onChange={e => setTourDate(e.target.value)}
                    className="bg-secondary border-border text-foreground font-body text-xs" />
                  <Input value={tourPax} onChange={e => setTourPax(e.target.value)} placeholder="Pax"
                    className="bg-secondary border-border text-foreground font-body text-xs" type="number" />
                  <Input value={tourPrice} onChange={e => setTourPrice(e.target.value)} placeholder="₱ Price"
                    className="bg-secondary border-border text-foreground font-body text-xs" type="number" />
                </div>
                <Button size="sm" onClick={addTour} disabled={!tourName.trim() || !tourDate}
                  className="font-display text-xs tracking-wider w-full">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Tour
                </Button>
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-lg p-6 text-center space-y-2">
                <p className="font-body text-sm text-muted-foreground">No guest checked in</p>
                <p className="font-body text-xs text-muted-foreground">Check in a guest first to add tours.</p>
                <Button size="sm" variant="outline" onClick={() => { setDetailTab('info'); setShowCheckInForm(true); }}
                  className="font-display text-xs tracking-wider">
                  <LogIn className="w-3.5 h-3.5 mr-1" /> Go to Check-In
                </Button>
              </div>
            )}
            {tours.map((tour: any) => (
              <div key={tour.id} className="border border-border rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-display text-sm text-foreground">{tour.tour_name}</p>
                    <p className="font-body text-xs text-muted-foreground">
                      {format(new Date(tour.tour_date + 'T00:00:00'), 'MMM d, yyyy')} · {tour.pax} pax · ₱{Number(tour.price).toLocaleString()}
                    </p>
                  </div>
                  <Select value={tour.status} onValueChange={v => updateTourStatus(tour.id, v)}>
                    <SelectTrigger className="w-28 bg-secondary border-border text-foreground font-body text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="booked">Booked</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {tour.notes && <p className="font-body text-xs text-muted-foreground mt-1">{tour.notes}</p>}
              </div>
            ))}
            {tours.length === 0 && <p className="font-body text-sm text-muted-foreground text-center py-2">No tours booked</p>}
          </div>
        )}

        {/* VIBE */}
        {detailTab === 'vibe' && vibeMode === 'list' && (
          <div className="space-y-3">
            <Button onClick={() => { setEditingVibeRecord(null); setVibeMode('form'); }}
              className="w-full font-display text-xs tracking-wider min-h-[44px]">
              <Plus className="w-4 h-4 mr-2" /> New Vibe Check-In
            </Button>
            {unitVibeRecords.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground text-center py-4">No vibe records for this room</p>
            ) : unitVibeRecords.map((rec: any) => {
              const isHigh = (rec.review_risk_level || []).includes('High');
              return (
                <button key={rec.id} onClick={() => { setViewingVibeRecord(rec); setVibeMode('detail'); }}
                  className={`w-full text-left border rounded-lg p-3 hover:bg-secondary/50 transition-colors ${isHigh ? 'border-2 border-destructive' : 'border-border'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-display text-sm text-foreground">{rec.guest_name}</p>
                      <p className="font-body text-xs text-muted-foreground">
                        {rec.nationality || 'N/A'} · {(rec.travel_composition || []).join(', ')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {(rec.review_risk_level || []).map((r: string) => (
                        <Badge key={r} variant={r === 'High' ? 'destructive' : r === 'Medium' ? 'default' : 'secondary'}
                          className="font-body text-xs">{r}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(rec.personality_type || []).map((p: string) => (
                      <Badge key={p} variant="outline" className="font-body text-xs">{p}</Badge>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // GRID VIEW
  return (
    <div className="space-y-4">
      <h3 className="font-display text-sm tracking-wider text-foreground">Rooms & Units</h3>
      <div className="grid grid-cols-2 gap-3">
        {units.map((unit: any) => {
          const booking = getUnitGuest(unit.name);
          const guest = (booking as any)?.resort_ops_guests;
          const isHighRisk = getUnitVibeRisk(unit.name);
          return (
            <button key={unit.id} onClick={() => { setSelectedUnit(unit); setDetailTab('info'); setVibeMode('list'); setShowCheckInForm(false); }}
              className={`border rounded-lg p-3 text-left hover:bg-secondary/50 transition-colors ${isHighRisk ? 'border-2 border-destructive' : 'border-border'}`}>
              <p className="font-display text-sm text-foreground tracking-wider">{unit.name}</p>
              {booking ? (
                <div className="mt-2">
                  <Badge variant="default" className="font-body text-xs">Occupied</Badge>
                  <p className="font-body text-xs text-foreground mt-1">{guest?.full_name || 'Guest'}</p>
                  <p className="font-body text-xs text-muted-foreground">
                    {format(new Date(booking.check_in + 'T00:00:00'), 'MMM d')} – {format(new Date(booking.check_out + 'T00:00:00'), 'MMM d')}
                  </p>
                </div>
              ) : (
                <Badge variant="secondary" className="font-body text-xs mt-2">Vacant</Badge>
              )}
              {isHighRisk && (
                <Badge variant="destructive" className="font-body text-xs mt-1">⚠ High Risk</Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RoomsDashboard;
