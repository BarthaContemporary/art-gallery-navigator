
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Download, Database, FileText, Image, ChevronDown } from "lucide-react";
import { exportData } from "@/lib/backup";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function BackupExportSection() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const { toast } = useToast();

  const handleExport = async (type: 'full' | 'data-only' | 'media-only') => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      await exportData(type, (progress) => {
        setExportProgress(progress);
      });

      toast({
        title: "Export completed",
        description: `Your ${type} backup has been downloaded successfully.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "There was an error creating your backup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup & Export
          </CardTitle>
          <CardDescription>
            Export your data and media files for backup purposes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isExporting} className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    {isExporting ? "Exporting..." : "Create Backup"}
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Backup Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleExport('full')}
                  disabled={isExporting}
                  className="cursor-pointer"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Full Backup
                  <span className="ml-auto text-xs text-muted-foreground">Data + Media</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleExport('data-only')}
                  disabled={isExporting}
                  className="cursor-pointer"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Data Only
                  <span className="ml-auto text-xs text-muted-foreground">CSV + JSON</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleExport('media-only')}
                  disabled={isExporting}
                  className="cursor-pointer"
                >
                  <Image className="h-4 w-4 mr-2" />
                  Media Only
                  <span className="ml-auto text-xs text-muted-foreground">Images + Files</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {isExporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Export Progress</span>
                  <span>{Math.round(exportProgress)}%</span>
                </div>
                <Progress value={exportProgress} className="w-full" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
