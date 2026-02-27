import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { action, employee_id, name, pin } = await req.json();

    if (action === 'set-password') {
      if (!employee_id || !pin) {
        return new Response(JSON.stringify({ error: 'employee_id and pin required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const hash = await bcrypt.hash(pin);
      const { error } = await supabase.from('employees').update({ password_hash: hash }).eq('id', employee_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'verify') {
      if (!name || !pin) {
        return new Response(JSON.stringify({ error: 'name and pin required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: emp, error } = await supabase.from('employees').select('*').eq('name', name).eq('active', true).single();
      if (error || !emp) {
        return new Response(JSON.stringify({ error: 'Employee not found' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!emp.password_hash) {
        return new Response(JSON.stringify({ error: 'No PIN set. Ask admin to set your PIN.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const valid = await bcrypt.compare(pin, emp.password_hash);
      if (!valid) {
        return new Response(JSON.stringify({ error: 'Invalid PIN' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Don't return password_hash
      const { password_hash, ...safeEmp } = emp;
      return new Response(JSON.stringify({ employee: safeEmp }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
