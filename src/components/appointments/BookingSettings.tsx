
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Bell, Calendar, Globe } from "lucide-react";
import { ReminderSettings } from "./ReminderSettings";

export function BookingSettings() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="availability" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Availability
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="text-center py-8 text-muted-foreground">
            General booking settings will be implemented here.
          </div>
        </TabsContent>

        <TabsContent value="reminders">
          <ReminderSettings />
        </TabsContent>

        <TabsContent value="availability">
          <div className="text-center py-8 text-muted-foreground">
            Default availability settings will be implemented here.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
