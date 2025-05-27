
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface UpdatePasswordResult {
  success: boolean;
  error?: { message: string; details?: any };
}

export const updateUserPassword = async (newPassword: string): Promise<UpdatePasswordResult> => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      logger.error("updateUserPassword service error:", error.message, { errorDetails: error });
      return { success: false, error: { message: error.message, details: error } };
    }
    logger.log("updateUserPassword service: Password updated successfully via Supabase.");
    return { success: true };
  } catch (error: any) {
    logger.error("updateUserPassword service: Unexpected error during password update:", error.message);
    return { 
      success: false, 
      error: { 
        message: "An unexpected error occurred while trying to update the password.", 
        details: error 
      } 
    };
  }
};
