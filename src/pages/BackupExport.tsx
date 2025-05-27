import React, { useState } from 'react';
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Download, FileSpreadsheet as ExcelIcon, CalendarDays } from "lucide-react";
import { exportDatabaseAsJson, exportAllMediaAsZip, exportDataAsCsvZip } from '@/lib/backup';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format } from 'date-fns';

const BackupExportPage = () => {
  const [isJsonExporting, setIsJsonExporting] = useState(false);
  const [isMediaExporting, setIsMediaExporting] = useState(false);
  const [isCsvZipExporting, setIsCsvZipExporting] = useState(false);

  // State for JSON date filtering
  const [enableJsonDateFilter, setEnableJsonDateFilter] = useState(false);
  const [jsonStartDate, setJsonStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [jsonEndDate, setJsonEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleJsonExport = async () => {
    setIsJsonExporting(true);
    if (enableJsonDateFilter) {
      if (!jsonStartDate || !jsonEndDate) {
        toast.error("Please select both start and end dates for incremental backup.");
        setIsJsonExporting(false);
        return;
      }
      if (new Date(jsonStartDate) > new Date(jsonEndDate)) {
        toast.error("Start date cannot be after end date.");
        setIsJsonExporting(false);
        return;
      }
      await exportDatabaseAsJson(jsonStartDate, jsonEndDate);
    } else {
      await exportDatabaseAsJson();
    }
    setIsJsonExporting(false);
  };

  const handleMediaExport = async () => {
    setIsMediaExporting(true);
    await exportAllMediaAsZip();
    setIsMediaExporting(false);
  };

  const handleCsvZipExport = async () => {
    setIsCsvZipExporting(true);
    await exportDataAsCsvZip();
    setIsCsvZipExporting(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <PageHeader title="Backup & Export Data" />
      <div className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5" />
              Full Database Export (JSON)
            </CardTitle>
            <CardDescription>
              Export all your application data as a single JSON file. This includes all tables and their content.
              Optionally, filter by date range for an incremental backup (based on record update/creation time).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="jsonDateFilter"
                checked={enableJsonDateFilter}
                onCheckedChange={(checked) => setEnableJsonDateFilter(Boolean(checked))}
              />
              <Label htmlFor="jsonDateFilter" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Enable Date Filter (Incremental Backup)
              </Label>
            </div>

            {enableJsonDateFilter && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-md">
                <div>
                  <Label htmlFor="jsonStartDate">Start Date</Label>
                  <Input
                    type="date"
                    id="jsonStartDate"
                    value={jsonStartDate}
                    onChange={(e) => setJsonStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="jsonEndDate">End Date</Label>
                  <Input
                    type="date"
                    id="jsonEndDate"
                    value={jsonEndDate}
                    onChange={(e) => setJsonEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            <Button onClick={handleJsonExport} disabled={isJsonExporting}>
              <Download className="mr-2 h-4 w-4" />
              {isJsonExporting 
                ? (enableJsonDateFilter ? 'Exporting Filtered JSON...' : 'Exporting Full JSON...') 
                : (enableJsonDateFilter ? 'Export Filtered JSON' : 'Export Database as JSON')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Download className="mr-2 h-5 w-5" />
              Media Files Export (ZIP)
            </CardTitle>
            <CardDescription>
              Download all uploaded media files (images, documents, etc.) as a single ZIP archive.
              This includes original files stored in your application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleMediaExport} disabled={isMediaExporting}>
              <Download className="mr-2 h-4 w-4" />
              {isMediaExporting ? 'Exporting Media...' : 'Export All Media as ZIP'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ExcelIcon className="mr-2 h-5 w-5" />
              Data Tables Export (CSV in ZIP)
            </CardTitle>
            <CardDescription>
              Export key data tables as individual CSV files, bundled into a single ZIP archive.
              These CSV files can be easily opened with Excel or other spreadsheet software.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleCsvZipExport} disabled={isCsvZipExporting}>
              <Download className="mr-2 h-4 w-4" />
              {isCsvZipExporting ? 'Exporting CSVs...' : 'Export Data as CSVs'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BackupExportPage;
