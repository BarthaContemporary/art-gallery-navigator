
import React, { useState } from 'react';
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Download, FileSpreadsheet as ExcelIcon } from "lucide-react"; // Using FileSpreadsheet as Excel icon
import { exportDatabaseAsJson, exportAllMediaAsZip, exportDataAsCsvZip } from '@/lib/backupUtils';

const BackupExportPage = () => {
  const [isJsonExporting, setIsJsonExporting] = useState(false);
  const [isMediaExporting, setIsMediaExporting] = useState(false);
  const [isCsvZipExporting, setIsCsvZipExporting] = useState(false);

  const handleJsonExport = async () => {
    setIsJsonExporting(true);
    await exportDatabaseAsJson();
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
              Useful for complete backups or migrating to another system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleJsonExport} disabled={isJsonExporting}>
              <Download className="mr-2 h-4 w-4" />
              {isJsonExporting ? 'Exporting JSON...' : 'Export Database as JSON'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Download className="mr-2 h-5 w-5" /> {/* Using generic Download icon as "archive" is not on the list */}
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
