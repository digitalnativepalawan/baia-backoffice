import WaitstaffBoard from '@/components/service/WaitstaffBoard';
import ServiceHeader from '@/components/service/ServiceHeader';

const ServiceWaitstaffPage = () => (
  <div className="h-screen flex flex-col bg-navy-texture overflow-hidden">
    <ServiceHeader department="waitstaff" />
    <WaitstaffBoard />
  </div>
);

export default ServiceWaitstaffPage;
