

## Plan: Fix Logo Background to Match Page

The logo container has `backgroundColor: 'hsl(220, 35%, 8%)'` but the page uses `bg-navy-texture` which adds radial gradients on top. The logo's solid background creates a visible rectangle against the textured background.

### Fix

**`src/pages/Index.tsx`**: Remove the explicit `backgroundColor` from the logo container div and make it transparent so the page background shows through seamlessly.

Change:
```tsx
<div className="mb-6 rounded-lg overflow-hidden" style={{ width: logoSize, height: logoSize, backgroundColor: 'hsl(220, 35%, 8%)' }}>
```
To:
```tsx
<div className="mb-6" style={{ width: logoSize, height: logoSize }}>
```

The logo PNG already has a transparent background matching the dark navy theme, so removing the container's background color and border-radius clipping will let it blend naturally.

