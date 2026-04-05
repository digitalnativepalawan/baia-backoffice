// src/components/staff/DailyBriefing.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';

export function DailyBriefing() {
  const [isOpen, setIsOpen] = useState(false);
  const [briefing, setBriefing] = useState({
    breakfastOrders: [],
    toursToday: [],
    notes: ''
  });

  useEffect(() => {
    fetchBriefing();
  }, []);

  const fetchBriefing = async () => {
    // Get breakfast orders for tomorrow
    const breakfast = await supabase
      .from('orders')
      .select('room_id, time, items')
      .eq('type', 'breakfast')
      .eq('date', getTomorrowDate());

    // Get tours today
    const tours = await supabase
      .from('tour_bookings')
      .select('room_id, tour_name, time, pax, captain_confirmed, guide_confirmed')
      .eq('date', getTodayDate());

    setBriefing({
      breakfastOrders: breakfast.data || [],
      toursToday: tours.data || [],
      notes: ''
    });
  };

  const updateTourStatus = async (bookingId: string, field: string, value: boolean) => {
    await supabase
      .from('tour_bookings')
      .update({ [field]: value })
      .eq('id', bookingId);
    fetchBriefing();
  };

  const saveNotes = async () => {
    await supabase
      .from('daily_briefing')
      .upsert({ date: getTodayDate(), notes: briefing.notes });
  };

  return (
    <div className="border rounded-lg mb-4 bg-white shadow">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left font-semibold bg-gray-50 hover:bg-gray-100 rounded-lg flex justify-between"
      >
        <span>📋 Daily Briefing - {getTodayDate()}</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="p-4 space-y-4">
          {/* Breakfast Orders */}
          <div>
            <h4 className="font-semibold mb-2">🍳 Breakfast Orders</h4>
            {briefing.breakfastOrders.length === 0 ? (
              <p className="text-gray-500 text-sm">No breakfast orders yet</p>
            ) : (
              briefing.breakfastOrders.map((order: any) => (
                <div key={order.id} className="text-sm mb-1">
                  • Room {order.room_id} - {order.time} - {order.items}
                </div>
              ))
            )}
          </div>

          {/* Tours */}
          <div>
            <h4 className="font-semibold mb-2">🏝️ Tours Today</h4>
            {briefing.toursToday.length === 0 ? (
              <p className="text-gray-500 text-sm">No tours scheduled</p>
            ) : (
              briefing.toursToday.map((tour: any) => (
                <div key={tour.id} className="text-sm mb-2 border-b pb-2">
                  <div>• Room {tour.room_id} - {tour.tour_name} - {tour.time} - {tour.pax} pax</div>
                  <div className="flex gap-4 mt-1">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={tour.captain_confirmed}
                        onChange={(e) => updateTourStatus(tour.id, 'captain_confirmed', e.target.checked)}
                      />
                      Captain confirmed
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={tour.guide_confirmed}
                        onChange={(e) => updateTourStatus(tour.id, 'guide_confirmed', e.target.checked)}
                      />
                      Guide confirmed
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Notes */}
          <div>
            <h4 className="font-semibold mb-2">📝 Notes</h4>
            <textarea
              className="w-full border rounded p-2 text-sm"
              rows={2}
              value={briefing.notes}
              onChange={(e) => setBriefing({ ...briefing, notes: e.target.value })}
              onBlur={saveNotes}
              placeholder="Add daily notes here..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}
