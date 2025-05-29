
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the request body
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Verify that the requester is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    // Check if the user is an admin
    const { data: roleData, error: roleError } = await supabase
      .rpc('has_role', {
        _user_id: userData.user.id,
        _role: 'gallery_admin'
      });

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Only admins can delete users" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      );
    }

    console.log(`Admin ${userData.user.email} (${userData.user.id}) attempting to delete user ${userId}`);

    // Step 1: Handle project tasks assigned to this user
    console.log(`Checking for project tasks assigned to user ${userId}`);
    const { data: assignedTasks, error: tasksError } = await supabase
      .from('project_tasks')
      .select('id, name, project_id')
      .eq('assigned_to', userId);

    if (tasksError) {
      console.error("Error checking assigned tasks:", tasksError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to check user dependencies",
          details: tasksError.message 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    if (assignedTasks && assignedTasks.length > 0) {
      console.log(`Found ${assignedTasks.length} tasks assigned to user. Unassigning them...`);
      
      // Unassign all tasks from this user
      const { error: unassignError } = await supabase
        .from('project_tasks')
        .update({ assigned_to: null })
        .eq('assigned_to', userId);

      if (unassignError) {
        console.error("Error unassigning tasks:", unassignError);
        return new Response(
          JSON.stringify({ 
            error: "Failed to unassign user tasks before deletion",
            details: unassignError.message 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }

      console.log(`Successfully unassigned ${assignedTasks.length} tasks`);
    }

    // Step 2: Handle project memberships
    console.log(`Removing user from project memberships`);
    const { error: projectMemberError } = await supabase
      .from('project_users')
      .delete()
      .eq('user_id', userId);

    if (projectMemberError) {
      console.error("Error removing project memberships:", projectMemberError);
      // Continue anyway as this shouldn't block user deletion
    }

    // Step 3: Handle user roles
    console.log(`Removing user roles`);
    const { error: userRolesError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (userRolesError) {
      console.error("Error removing user roles:", userRolesError);
      // Continue anyway as this shouldn't block user deletion
    }

    // Step 4: Handle user presence
    console.log(`Removing user presence records`);
    const { error: presenceError } = await supabase
      .from('user_presence')
      .delete()
      .eq('user_id', userId);

    if (presenceError) {
      console.error("Error removing user presence:", presenceError);
      // Continue anyway as this shouldn't block user deletion
    }

    // Step 5: Handle profiles
    console.log(`Removing user profile`);
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error("Error removing user profile:", profileError);
      // Continue anyway as this shouldn't block user deletion
    }

    // Step 6: Delete the user from auth
    console.log(`Deleting user from auth system`);
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting user from auth:", deleteError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to delete user from authentication system",
          details: deleteError.message 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    console.log(`Successfully deleted user ${userId}`);

    // Return success response with details
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "User successfully deleted",
        details: {
          unassignedTasks: assignedTasks?.length || 0,
          removedProjectMemberships: true,
          removedUserRoles: true,
          removedProfile: true
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "An unexpected error occurred during user deletion",
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
