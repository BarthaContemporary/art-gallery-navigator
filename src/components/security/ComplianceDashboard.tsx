import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  Target, 
  TrendingUp,
  Clock,
  Users,
  Settings
} from "lucide-react";
import { securityComplianceManager } from "@/utils/security-compliance";
import { automatedSecurityTesting } from "@/utils/security-testing";
import { incidentResponseManager } from "@/utils/incident-response";
import { useAuth } from "@/hooks/use-auth";

export function ComplianceDashboard() {
  const { isAdmin } = useAuth();
  const [complianceReport, setComplianceReport] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [incidentMetrics, setIncidentMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;

    const loadComplianceData = async () => {
      try {
        // Load compliance report
        const compliance = securityComplianceManager.generateComplianceReport();
        setComplianceReport(compliance);

        // Run security tests
        await automatedSecurityTesting.runAllTests();
        const testReport = automatedSecurityTesting.generateSecurityTestReport();
        setTestResults(testReport);

        // Get incident metrics
        const incidents = incidentResponseManager.getIncidentMetrics();
        setIncidentMetrics(incidents);

      } catch (error) {
        console.error('Failed to load compliance data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadComplianceData();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to view the compliance dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading compliance data...</div>
      </div>
    );
  }

  const getComplianceColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-yellow-600";
    if (score >= 60) return "text-orange-600";
    return "text-red-600";
  };

  const getComplianceStatus = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Good";
    if (score >= 60) return "Needs Improvement";
    return "Critical";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ISO/IEC 27034 Compliance Dashboard</h1>
          <p className="text-muted-foreground">Application Security Standard Compliance</p>
        </div>
        <Button onClick={() => window.location.reload()} variant="outline">
          <TrendingUp className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {/* Compliance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Compliance</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getComplianceColor(complianceReport?.overallCompliance || 0)}`}>
              {Math.round(complianceReport?.overallCompliance || 0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {getComplianceStatus(complianceReport?.overallCompliance || 0)}
            </p>
            <Progress 
              value={complianceReport?.overallCompliance || 0} 
              className="mt-2" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Tests</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {testResults?.summary?.passedTests || 0}/{testResults?.summary?.totalTests || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(testResults?.summary?.successRate || 0)}% Success Rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {incidentMetrics?.openIncidents || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {incidentMetrics?.totalIncidents || 0} Total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(incidentMetrics?.averageResolutionTime || 0)}h
            </div>
            <p className="text-xs text-muted-foreground">
              Resolution Time
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="policies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="policies">Security Policies</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="testing">Security Testing</TabsTrigger>
          <TabsTrigger value="incidents">Incident Response</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Security Policies Compliance
              </CardTitle>
              <CardDescription>
                ISO/IEC 27034-1 Application Security Management Framework
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Policies Implementation</span>
                  <div className="flex items-center gap-2">
                    <span className={getComplianceColor(complianceReport?.policiesCompliance || 0)}>
                      {Math.round(complianceReport?.policiesCompliance || 0)}%
                    </span>
                    <Progress value={complianceReport?.policiesCompliance || 0} className="w-20" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {securityComplianceManager.getSecurityPolicies().map((policy) => (
                    <div key={policy.id} className="border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{policy.title}</h4>
                        <Badge variant={policy.implemented ? "default" : "destructive"}>
                          {policy.implemented ? "Implemented" : "Pending"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{policy.description}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline">{policy.category}</Badge>
                        <Badge variant="outline">{policy.severity}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requirements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Security Requirements Verification
              </CardTitle>
              <CardDescription>
                ISO/IEC 27034-6 Application Security Verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Requirements Implementation</span>
                  <div className="flex items-center gap-2">
                    <span className={getComplianceColor(complianceReport?.requirementsCompliance || 0)}>
                      {Math.round(complianceReport?.requirementsCompliance || 0)}%
                    </span>
                    <Progress value={complianceReport?.requirementsCompliance || 0} className="w-20" />
                  </div>
                </div>

                <div className="space-y-3">
                  {securityComplianceManager.getSecurityRequirements().map((requirement) => (
                    <div key={requirement.id} className="border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{requirement.title}</h4>
                        <Badge 
                          variant={
                            requirement.status === 'implemented' || requirement.status === 'verified' 
                              ? "default" 
                              : requirement.status === 'failed' 
                                ? "destructive" 
                                : "secondary"
                          }
                        >
                          {requirement.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{requirement.description}</p>
                      {requirement.evidence && (
                        <p className="text-xs text-green-600">✓ {requirement.evidence}</p>
                      )}
                      <Badge variant="outline" className="mt-2">{requirement.category}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Automated Security Testing
              </CardTitle>
              <CardDescription>
                ISO/IEC 27034-3 Security in SDLC Implementation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {testResults?.summary?.passedTests || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Passed Tests</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {testResults?.summary?.failedTests || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Failed Tests</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {Math.round(testResults?.summary?.successRate || 0)}%
                    </div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Test Categories</h4>
                  {Object.entries(testResults?.categoryBreakdown || {}).map(([category, stats]: [string, any]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="capitalize">{category.replace('_', ' ')}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {stats.passed}/{stats.total}
                        </span>
                        <Progress 
                          value={(stats.passed / stats.total) * 100} 
                          className="w-20" 
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {testResults?.failedTests?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-red-600">Failed Tests</h4>
                    {testResults.failedTests.map((failure: any, index: number) => (
                      <Alert key={index} className="border-red-200">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>{failure.test.name}</strong>: {failure.result.message}
                          {failure.result.recommendation && (
                            <div className="mt-1 text-sm">
                              <strong>Recommendation:</strong> {failure.result.recommendation}
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Incident Response Management
              </CardTitle>
              <CardDescription>
                ISO/IEC 27034-4 Incident Response Procedures
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Incident Statistics</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Incidents</span>
                      <span className="font-medium">{incidentMetrics?.totalIncidents || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Open Incidents</span>
                      <span className="font-medium text-orange-600">{incidentMetrics?.openIncidents || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Resolution Time</span>
                      <span className="font-medium">{Math.round(incidentMetrics?.averageResolutionTime || 0)}h</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Incidents by Severity</h4>
                  <div className="space-y-2">
                    {Object.entries(incidentMetrics?.incidentsBySeverity || {}).map(([severity, count]) => (
                      <div key={severity} className="flex justify-between">
                        <span className="capitalize">{severity}</span>
                        <Badge variant={
                          severity === 'critical' ? "destructive" :
                          severity === 'high' ? "destructive" :
                          severity === 'medium' ? "secondary" : "outline"
                        }>
                          {count as number}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Recommendations</CardTitle>
              <CardDescription>Actions to improve ISO/IEC 27034 compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {complianceReport?.recommendations?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">General Recommendations</h4>
                    <ul className="space-y-2">
                      {complianceReport.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {testResults?.recommendations?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Security Testing Recommendations</h4>
                    <ul className="space-y-2">
                      {testResults.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <Settings className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your application demonstrates strong security foundations and is well-positioned for ISO/IEC 27034 compliance. 
                    Continue monitoring and addressing the recommendations above to maintain and improve your security posture.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}