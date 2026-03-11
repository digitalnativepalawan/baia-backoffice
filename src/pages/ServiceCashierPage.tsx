import ServiceHeader from '@/components/service/ServiceHeader';
import CashierBoard from '@/components/service/CashierBoard';

const ServiceCashierPage = () => (
  <div className="min-h-screen flex flex-col bg-navy-texture md:h-screen md:overflow-hidden">
    <ServiceHeader department="cashier" />
    <CashierBoard />
  </div>
);

export default ServiceCashierPage;
