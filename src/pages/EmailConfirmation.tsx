
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function EmailConfirmation() {
  const navigate = useNavigate();

  useEffect(() => {
    // Automatically redirect to the dashboard after 5 seconds
    const timer = setTimeout(() => {
      navigate("/");
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <h1 className="text-2xl font-semibold">Email Confirmed!</h1>
        <p className="text-muted-foreground">
          Your email has been successfully confirmed. You will be redirected to the dashboard in a few seconds.
        </p>
        <Button onClick={() => navigate("/")} variant="outline">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
