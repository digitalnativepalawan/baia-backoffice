-- Add opened_by column to tabs table to track which staff member opened the tab
ALTER TABLE public.tabs ADD COLUMN IF NOT EXISTS opened_by TEXT NOT NULL DEFAULT '';
