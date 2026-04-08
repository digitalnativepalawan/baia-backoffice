import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Sun, Users, LogIn, LogOut, Utensils, 
  Bike, MapPin, Car, Coffee, Info,
  Sparkles, Clock
} from "lucide-react";

/**
 * Helper to get Manila Date/Time
 */
const getManilaDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const getManilaTimeStr = () => new Date().toLocaleTimeString('en-PH', { 
  timeZone: 'Asia/Manila', 
  hour: '2-digit', 
  minute: '2-digit', 
  hour12: true 
});

const from = (table: string) => supabase.from(table as any);

export const LoginBriefingPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const today = getManilaDate();

  // Check session storage to show only once per session
  useEffect(() => {
    const hasSeenBriefing = sessionStorage.getItem('hasSeenBriefing');
    if (!hasSeenBriefing) {
      setIsOpen(true);
    }
  }, []);

  const { data: user } = useQuery({
    queryKey: ['current-user-briefing'],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;
      const { data: emp } = await from('employees').select('display_name, name').eq('id', authUser.id).single();
      return emp || { display_name: 'Admin' };
    }
  });

  const { data: briefing, isLoading } = useQuery({
    queryKey: ['login-briefing-data', today],
    queryFn: async () => {
      const [bookings, units, orders, tours, requests] = await Promise.all([
        from('resort_ops_bookings').select('id, check_in, check_out, resort_ops_guests(full_name), resort_ops_units:unit_id(name)'),
        from('units').select('id, status'),
        from('orders').select('id, category, status').gte('created_at', today),
        from('guest_tours').select('tour_name, unit_name, pax').eq('tour_date', today).in('status', ['booked', 'confirmed']),
        from('guest_requests').select('request_type, details').eq('status', 'pending')
      ]);

      const bData = (bookings.data as any[]) || [];
      const oData = (orders.data as any[]) || [];
      const rData = (requests.data as any[]) || [];
      
      return {
        checkIns: bData.filter(b => b.check_in === today).map(b => ({
          guest: b.resort_ops_guests?.full_name || 'Guest',
          unit: b.resort_ops_units?.name || 'Room'
        })),
        checkOuts: bData.filter(b => b.check_out === today).length,
        occupiedCount: (units.data as any[])?.filter(u => u.status === 'occupied').length || 0,
        breakfastOrders: oData.filter(o => o.category === 'Breakfast').length,
        pendingOrders: oData.filter(o => ['New', 'Preparing'].includes(o.status)).length,
        tours: (tours.data as any[]) || [],
        motorbikes: rData.filter(r => r.request_type?.toLowerCase().includes('bike')),
        tuktuks: rData.filter(r => r.request_type?.toLowerCase().includes('tuktuk'))
      };
    },
    enabled: isOpen
  });

  const handleDismiss = () => {
    sessionStorage.setItem('hasSeenBriefing', 'true');
    setIsOpen(false);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md bg-zinc-950 border-zinc-900 text-zinc-100 p-0 overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/10 p-6 border-b border-white/5 pb-8 relative">
          <div className="absolute top-4 right-4 animate-pulse">
             <Sparkles className="h-4 w-4 text-indigo-400 opacity-50" />
          </div>
          <DialogHeader>
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/20">
                <Sun className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-display italic tracking-tight text-white mb-1">
                  {greeting}, {user?.display_name || user?.name || 'Manager'}
                </DialogTitle>
                <div className="flex items-center gap-2 text-zinc-500 text-[10px] ui-label tracking-[0.15em]">
                  <Clock className="h-3 w-3" />
                  {getManilaTimeStr()} • BAIA OPS
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-hide">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-400" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="h-1 w-1 bg-white rounded-full" />
                </div>
              </div>
              <p className="text-[10px] ui-label text-zinc-500 animate-pulse tracking-widest">PULLING LIVE OPS FEED...</p>
            </div>
          ) : (
            <>
              {/* TODAY AT A GLANCE */}
              <section className="space-y-4">
                <header className="flex items-center gap-2">
                  <h3 className="text-[10px] font-bold ui-label tracking-[0.2em] text-zinc-500">TODAY AT A GLANCE</h3>
                  <div className="h-[1px] flex-grow bg-zinc-800" />
                </header>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5 group hover:border-indigo-500/20 transition-all">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[8px] ui-label text-zinc-500 tracking-wider">OCCUPIED</span>
                       <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                    </div>
                    <div className="flex items-baseline gap-1">
                       <span className="text-3xl font-display italic text-white">{briefing?.occupiedCount}</span>
                       <span className="text-[10px] text-zinc-600 font-mono">UNITS</span>
                    </div>
                  </div>
                  <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5 group hover:border-purple-500/20 transition-all">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[8px] ui-label text-zinc-500 tracking-wider">CHECK-OUTS</span>
                       <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                    </div>
                    <div className="flex items-baseline gap-1">
                       <span className="text-3xl font-display italic text-white">{briefing?.checkOuts}</span>
                       <span className="text-[10px] text-zinc-600 font-mono">GUESTS</span>
                    </div>
                  </div>
                </div>

                {briefing?.checkIns.length > 0 && (
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] ui-label text-emerald-500 font-bold tracking-[0.1em]">EXPECTED ARRIVALS</span>
                      <Users className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div className="space-y-2">
                      {briefing.checkIns.map((bin, i) => (
                        <div key={i} className="flex justify-between items-center text-[11px] py-2 border-t border-emerald-500/5 first:border-0 border-dashed">
                          <span className="text-zinc-300 font-medium">{bin.guest}</span>
                          <span className="text-emerald-400 font-display italic tracking-wider p-1 bg-emerald-500/10 rounded uppercase text-[9px]">{bin.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* FOOD & BEVERAGE */}
              <section className="space-y-4">
                <header className="flex items-center gap-2">
                  <h3 className="text-[10px] font-bold ui-label tracking-[0.2em] text-zinc-500">FOOD & BEVERAGE</h3>
                  <div className="h-[1px] flex-grow bg-zinc-800" />
                </header>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] ui-label text-amber-500 font-bold tracking-[0.1em]">BREAKFAST PRE-ORDERS</span>
                      <Coffee className="h-4 w-4 text-amber-500 opacity-50" />
                    </div>
                    <span className="text-3xl font-display italic text-white">{briefing?.breakfastOrders}</span>
                  </div>
                  <div className="p-4 bg-zinc-900/40 border border-white/5 rounded-2xl flex flex-col justify-center">
                    <span className="text-[8px] ui-label text-zinc-500 mb-1">PENDING ORDERS IN KITCHEN</span>
                    <span className="text-xl font-display italic text-amber-200">{briefing?.pendingOrders}</span>
                  </div>
                </div>
              </section>

              {/* ACTIVITIES */}
              <section className="space-y-4">
                <header className="flex items-center gap-2">
                  <h3 className="text-[10px] font-bold ui-label tracking-[0.2em] text-zinc-500">ACTIVITIES TODAY</h3>
                  <div className="h-[1px] flex-grow bg-zinc-800" />
                </header>
                <div className="space-y-2">
                  {briefing?.tours.length > 0 ? (
                    briefing.tours.map((t, i) => (
                      <div key={i} className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-between group hover:bg-blue-500/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/10 rounded-lg group-hover:scale-110 transition-transform">
                             <MapPin className="h-3.5 w-3.5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-[11px] text-zinc-200 font-medium">{t.tour_name}</p>
                            <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{t.pax} PASSENGERS</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-display italic text-blue-300 bg-blue-500/10 px-2 py-1 rounded">{t.unit_name}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-2 opacity-30 italic text-[10px] text-zinc-500">No tours confirmed for today</div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="p-3 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bike className="h-3.5 w-3.5 text-zinc-500" />
                        <span className="text-[10px] ui-label text-zinc-400 tracking-tighter">MOTORBIKE</span>
                      </div>
                      <span className="text-sm font-display italic text-white">{briefing?.motorbikes.length || 0}</span>
                    </div>
                    <div className="p-3 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="h-3.5 w-3.5 text-zinc-500" />
                        <span className="text-[10px] ui-label text-zinc-400 tracking-tighter">TUK-TUK</span>
                      </div>
                      <span className="text-sm font-display italic text-white">{briefing?.tuktuks.length || 0}</span>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        <div className="p-6 bg-zinc-950/80 backdrop-blur-sm border-t border-white/5 pt-4">
          <Button 
            className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold ui-label text-[10px] tracking-[0.3em] h-14 rounded-2xl"
            onClick={handleDismiss}
          >
            DISMISS BRIEFING
          </Button>
          <p className="text-center text-[8px] text-zinc-600 mt-4 uppercase tracking-[0.2em] font-mono">End of briefing · Baia Boutique Resort</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
