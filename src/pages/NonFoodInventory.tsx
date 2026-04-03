import React from 'react';

export default function NonFoodInventory() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Non-Food Inventory</h1>
      <p className="mt-2">Glasses, plates, tools for Bar/Kitchen/Rooms</p>
      <p className="mt-4 text-green-600">✅ Deployed successfully on {new Date().toLocaleString()}</p>
    </div>
  );
}
