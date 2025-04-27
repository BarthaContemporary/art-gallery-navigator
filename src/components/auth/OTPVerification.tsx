
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const otpSchema = z.object({
  otp: z.string().length(6, "Please enter the complete verification code")
});

type OTPFormValues = z.infer<typeof otpSchema>;

interface OTPVerificationProps {
  onSubmit: (values: OTPFormValues) => void;
  onBack: () => void;
  isLoading: boolean;
}

export function OTPVerification({ onSubmit, onBack, isLoading }: OTPVerificationProps) {
  const form = useForm<OTPFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: ""
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="otp"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={field.value} onChange={field.onChange} disabled={isLoading}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </FormControl>
              <FormMessage className="text-center mt-2" />
            </FormItem>
          )}
        />
        
        <Button 
          type="submit" 
          className="w-full h-12 sm:h-10 text-lg sm:text-base"
          disabled={isLoading || form.watch("otp").length !== 6}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : "Verify Code"}
        </Button>

        <div className="flex justify-center">
          <Button 
            variant="ghost" 
            onClick={onBack}
            disabled={isLoading}
          >
            Back to Login
          </Button>
        </div>
      </form>
    </Form>
  );
}
