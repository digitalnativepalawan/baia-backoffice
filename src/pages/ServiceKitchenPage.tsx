import { useState } from 'react';
import ServiceBoard from '@/components/service/ServiceBoard';
import ServiceHeader from '@/components/service/ServiceHeader';
import OpenTabModal from '@/components/service/OpenTabModal';

const ServiceKitchenPage = () => {
  const [openTabModalOpen, setOpenTabModalOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-navy-texture overflow-hidden">
      <ServiceHeader department="kitchen" onOpenTab={() => setOpenTabModalOpen(true)} />
      <ServiceBoard department="kitchen" />
      <OpenTabModal open={openTabModalOpen} onOpenChange={setOpenTabModalOpen} />
    </div>
  );
};

export default ServiceKitchenPage;
