
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";

export default function Documents() {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-redirect after 3 seconds
    const timer = setTimeout(() => {
      navigate("/file-sharing", { replace: true });
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <Card className="text-center py-12">
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <ArrowRight className="h-8 w-8 text-primary absolute -top-2 -right-2 animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Documents Moved</h1>
            <p className="text-muted-foreground">
              Document management has been integrated into the File Sharing section for a better experience.
            </p>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You'll be redirected automatically in a few seconds...
            </p>
            <Button onClick={() => navigate("/file-sharing", { replace: true })}>
              Go to File Management
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
