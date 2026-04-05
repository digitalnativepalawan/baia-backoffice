import { useNavigate } from 'react-router-dom';
import ReceptionPage from '@/pages/ReceptionPage';
import { DailyBriefing } from './DailyBriefing';

const ReceptionHome = () => {
  return (
    <>
      <DailyBriefing />
      <ReceptionPage embedded />
    </>
  );
};

export default ReceptionHome;
