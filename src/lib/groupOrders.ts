/**
 * groupOrders.ts
 * Groups a flat list of orders into per-unit/location buckets for
 * display on the Waitstaff and Cashier boards.
 */

export interface OrderItem {
  name: string;
  price: number;
  qty: number;
  department?: string;
}

export interface OrderGroup {
  /** Unique key — normalised unit/location identifier */
  key: string;
  /** Human-readable label shown on the card */
  label: string;
  /** Guest name if available */
  guestName: string;
  /** All orders in this group */
  orders: any[];
  /** Flattened, deduplicated item list with quantities summed */
  items: OrderItem[];
  /** Subtotal (excluding service charge) */
  total: number;
  /** Combined service charge across all orders */
  serviceCharge: number;
  /** Worst (earliest-pipeline) status across all orders */
  worstStatus: string;
  /** Timestamp of the oldest order in the group */
  oldestCreatedAt: string;
  /** True if any order in the group has a tab_id */
  hasTab: boolean;
  /** True if any order in the group has payment_type = 'Charge to Room' */
  hasRoomCharge: boolean;
}

const STATUS_RANK: Record<string, number> = {
  New: 0,
  Preparing: 1,
  Ready: 2,
  Served: 3,
  Paid: 4,
  Closed: 5,
};

/**
 * Derive a stable grouping key from an order.
 * Priority: tab_id → room location_detail → order_type+location_detail
 */
const groupKeyFor = (order: any): string => {
  if (order.tab_id) return `tab::${order.tab_id}`;
  const loc = (order.location_detail || '').trim();
  const type = (order.order_type || '').trim();
  return loc ? loc : type || 'unknown';
};

/** Human-readable label for a group key */
const labelFor = (order: any, key: string): string => {
  if (key.startsWith('tab::')) return order.location_detail || order.order_type || 'Tab';
  return order.location_detail || order.order_type || key;
};

export function groupOrdersByUnit(orders: any[]): OrderGroup[] {
  const map = new Map<string, OrderGroup>();

  for (const order of orders) {
    const key = groupKeyFor(order);
    const items: any[] = Array.isArray(order.items) ? order.items : [];
    const subtotal = Number(order.total ?? 0);
    const sc = Number(order.service_charge ?? 0);

    if (!map.has(key)) {
      map.set(key, {
        key,
        label: labelFor(order, key),
        guestName: order.guest_name || '',
        orders: [],
        items: [],
        total: 0,
        serviceCharge: 0,
        worstStatus: order.status,
        oldestCreatedAt: order.created_at,
        hasTab: false,
        hasRoomCharge: false,
      });
    }

    const group = map.get(key)!;
    group.orders.push(order);
    group.total += subtotal;
    group.serviceCharge += sc;

    // Track worst (earliest pipeline) status
    if ((STATUS_RANK[order.status] ?? 99) < (STATUS_RANK[group.worstStatus] ?? 99)) {
      group.worstStatus = order.status;
    }

    // Track oldest order
    if (order.created_at < group.oldestCreatedAt) {
      group.oldestCreatedAt = order.created_at;
    }

    // Guest name — prefer non-empty
    if (!group.guestName && order.guest_name) {
      group.guestName = order.guest_name;
    }

    // Label — prefer location_detail over tab key
    if (group.label.startsWith('tab::') && order.location_detail) {
      group.label = order.location_detail;
    }

    if (order.tab_id) group.hasTab = true;
    if (order.payment_type === 'Charge to Room') group.hasRoomCharge = true;

    // Merge items — sum qty for identical name+price+department
    for (const raw of items) {
      const name = raw.name || '';
      const price = Number(raw.price ?? 0);
      const qty = Number(raw.qty ?? raw.quantity ?? 1);
      const department = raw.department || 'kitchen';

      const existing = group.items.find(
        i => i.name === name && i.price === price && i.department === department,
      );
      if (existing) {
        existing.qty += qty;
      } else {
        group.items.push({ name, price, qty, department });
      }
    }
  }

  // Sort groups: worst status first, then oldest first within same status
  return Array.from(map.values()).sort((a, b) => {
    const statusDiff = (STATUS_RANK[a.worstStatus] ?? 99) - (STATUS_RANK[b.worstStatus] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return a.oldestCreatedAt.localeCompare(b.oldestCreatedAt);
  });
}
