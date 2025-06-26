
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface MacWebDAVConnectionGuideProps {
  webdavUrl: string;
  hasToken: boolean;
}

export function MacWebDAVConnectionGuide({ webdavUrl, hasToken }: MacWebDAVConnectionGuideProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Info className="h-5 w-5" />
          Mac Finder WebDAV Connection Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasToken && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              You need to create a WebDAV token first before connecting with Mac Finder.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <h4 className="font-semibold text-blue-900">Step-by-Step Connection:</h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">1</Badge>
              <div>
                <p className="font-medium">Open Mac Finder</p>
                <p className="text-gray-600">Press <kbd className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">⌘ + K</kbd> to open "Connect to Server"</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">2</Badge>
              <div className="flex-1">
                <p className="font-medium">Enter Server Address</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-blue-100 px-2 py-1 rounded text-xs flex-1">{webdavUrl}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(webdavUrl)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">3</Badge>
              <div>
                <p className="font-medium">Authentication</p>
                <p className="text-gray-600">When prompted, choose "Registered User"</p>
                <div className="mt-1 space-y-1">
                  <p className="text-sm">Username: <code className="bg-blue-100 px-1 rounded">webdav</code></p>
                  <p className="text-sm">Password: <span className="text-blue-700 font-medium">Your WebDAV token</span></p>
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">4</Badge>
              <div>
                <p className="font-medium">Access Files</p>
                <p className="text-gray-600">The server will appear in Finder's sidebar under "Locations"</p>
              </div>
            </div>
          </div>
        </div>

        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Pro Tip:</strong> If Mac Finder fails to connect, try these alternatives:
            <ul className="mt-2 space-y-1 text-sm">
              <li>• Use the debug panel above to test your token first</li>
              <li>• Try a third-party WebDAV client like Transmit or ForkLift</li>
              <li>• Ensure your token is exactly 64 characters long</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open("https://cyberduck.io/", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Try Cyberduck
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open("https://panic.com/transmit/", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Try Transmit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
