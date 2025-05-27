
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export const UpdatePasswordSuccessView: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen bg-background dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md p-6 shadow-lg text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Password Successfully Reset!</h1>
        <p className="text-muted-foreground mb-6">
          You can now log in with your new password. Redirecting to login...
        </p>
        <Button onClick={() => navigate("/auth")} className="w-full">
          Go to Login Now
        </Button>
      </Card>
    </div>
  );
};
