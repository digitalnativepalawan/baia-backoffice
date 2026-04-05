import { useNavigate } from 'react-router-dom';
import ReceptionPage from '@/pages/ReceptionPage';
import { DailyBriefing } from './DailyBriefing';

/**
 * Reception home — wraps existing ReceptionPage inside the Staff Shell.
 * The ReceptionPage already has full check-in/out, timeline, housekeeping tracker, etc.
 * We render it inline (without its own nav header since StaffShell provides that).
 */
const ReceptionHome = () => {
  return (
    <>
      <DailyBriefing />
      <ReceptionPage embedded />
    </>
  );
};

export default ReceptionHome;
