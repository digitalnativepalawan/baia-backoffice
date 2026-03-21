import { useState } from 'react';
import WaitstaffBoard from '@/components/service/WaitstaffBoard';
import ServiceHeader from '@/components/service/ServiceHeader';
import OpenTabModal from '@/components/service/OpenTabModal';

const ServiceWaitstaffPage = () => {
  const [openTabModalOpen, setOpenTabModalOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-navy-texture overflow-hidden">
      <ServiceHeader department="waitstaff" onOpenTab={() => setOpenTabModalOpen(true)} />
      <WaitstaffBoard />
      <OpenTabModal open={openTabModalOpen} onOpenChange={setOpenTabModalOpen} />
    </div>
  );
};

export default ServiceWaitstaffPage;
