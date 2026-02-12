

# Remove Title Text from Landing Page + Add Logo Size Setting

## What Changes

### 1. Landing Page (Index.tsx) -- Remove resort name text, show only logo
- Remove the `<h1>` element displaying `firstPart` (e.g., "BAIA")
- Remove the `<p>` element displaying `restParts` (e.g., "PALAWAN")
- Keep the logo image and tagline
- If no logo is uploaded yet, show a placeholder prompt like "Upload logo in Admin Settings"

### 2. Database -- Add `logo_size` column to `resort_profile`
- Add a new column `logo_size` (integer, default 128, nullable) to store the logo display size in pixels
- This controls how large the logo appears on the landing page

### 3. ResortProfileForm.tsx -- Add logo size slider
- Add a slider control below the logo upload area
- Range: 64px to 256px, step 8px
- Shows a live preview of the size value (e.g., "Logo size: 128px")
- Saved alongside all other profile fields

### 4. Index.tsx -- Use dynamic logo size
- Read `logo_size` from the resort profile (default 128px / ~7rem)
- Apply it to the logo `<img>` width and height

## Technical Details

**Migration SQL:**
```sql
ALTER TABLE resort_profile ADD COLUMN logo_size integer DEFAULT 128;
```

**Index.tsx changes:**
- Remove lines rendering `firstPart` and `restParts`
- Update logo `<img>` to use `style={{ width: profile.logo_size, height: profile.logo_size }}`

**ResortProfileForm.tsx changes:**
- Add `logo_size` to the form state (default 128)
- Add a Slider component from the UI library between the logo upload and the "Resort Name" input
- Include `logo_size` in the save payload

**Files changed:**
| File | Change |
|------|--------|
| Migration SQL | Add `logo_size` column to `resort_profile` |
| `src/pages/Index.tsx` | Remove resort name `<h1>` and `<p>`, use dynamic logo size |
| `src/components/admin/ResortProfileForm.tsx` | Add logo size slider to form |
| `src/hooks/useResortProfile.ts` | Add `logo_size` to interface |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

