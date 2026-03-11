import ServiceBoard from '@/components/service/ServiceBoard';
import ServiceHeader from '@/components/service/ServiceHeader';
import ReceptionPage from '@/pages/ReceptionPage';
import { Separator } from '@/components/ui/separator';

const ServiceReceptionPage = () => (
  <div className="h-screen flex flex-col bg-navy-texture">
    <ServiceHeader department="reception" />
    <div className="flex-1 overflow-y-auto">
      <ServiceBoard department="reception" />
      <Separator className="my-6 mx-4" />
      <div className="pb-20">
        <ReceptionPage embedded />
      </div>
    </div>
  </div>
);

export default ServiceReceptionPage;
