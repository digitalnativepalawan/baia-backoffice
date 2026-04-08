import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { ChevronRight } from 'lucide-react';

interface EmployeeTask {
  id: string;
  status: string;
  archived_at: string | null;
}

interface ActionRequiredPanelProps {
  tasks: EmployeeTask[];
  setTasks: React.Dispatch<React.SetStateAction<EmployeeTask[]>>;
  perms: string[];
}

function ActionRequiredPanel({ tasks, setTasks, perms }: ActionRequiredPanelProps) {
  const navigate = useNavigate();
  const [currentEmpId, setCurrentEmpId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);


  useEffect(() => {
    const fetchEmployeeId = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user data:', error);
        return;
      }
      if (data?.user?.id) {
        const { data: employeeData, error: employeeError } = await supabase
          .from('employees')
          .select('id, permissions')
          .eq('auth_id', data.user.id)
          .single();

        if (employeeError) {
          console.error('Error fetching employee data:', employeeError);
          return;
        }

        if (employeeData) {
          setCurrentEmpId(employeeData.id);
          setIsAdmin(employeeData.permissions.includes('admin'));
        }
      }
    };

    fetchEmployeeId();
  }, []);


  return (
    <div className="p-4 border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-xs\ tracking-widest text-muted-foreground uppercase">Action Required</h2>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={async () => {
                await supabase.from('employee_tasks').update({ archived_at: new Date().toISOString() }).neq('status', 'completed').is('archived_at', null);
                setTasks([]);
              }}
              className="font-body text-xs text-destructive flex items-center gap-0.5 hover:underline"
            >
              Clear All 
            </button>
          )}
          <button
            onClick={() => navigate('/employee-portal')}
            className="font-body text-xs text-primary flex items-center gap-0.5 hover:underline"
          >
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500">No action required at this time.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.slice(0, 3).map((task) => (
            <li key={task.id} className="flex items-center justify-between py-1 border-b last:border-b-0">
              <span className="text-sm">{task.status}</span>
              <button
                 onClick={async () => {
                   const updatedTasks = tasks.map(t => t.id === task.id ? {...t, archived_at: new Date().toISOString()} : t);
                   setTasks(updatedTasks);
                   await supabase.from('employee_tasks').update({ archived_at: new Date().toISOString() }).eq('id', task.id);
                 }}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Done
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ActionRequiredPanel;
