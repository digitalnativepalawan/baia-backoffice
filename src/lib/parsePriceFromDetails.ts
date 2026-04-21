/**
 * Parses a Philippine Peso price embedded in a free-text details string.
 * Example: "Palawan → El Nido — ₱1,500 — 2026-04-21 08:00" → 1500
 */
export const parsePriceFromDetails = (details: string): number => {
  const match = (details || '').match(/₱([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, '')) : 0;
};
