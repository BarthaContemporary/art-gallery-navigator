// Incident Response System for ISO/IEC 27034-4 Compliance

import { SecurityMonitor } from './security-monitoring';
import { securityComplianceManager, SecurityIncident } from './security-compliance';

export interface IncidentResponsePlan {
  id: string;
  name: string;
  description: string;
  triggerConditions: string[];
  responseSteps: ResponseStep[];
  escalationMatrix: EscalationLevel[];
  requiredRoles: string[];
}

export interface ResponseStep {
  id: string;
  order: number;
  title: string;
  description: string;
  responsible: string;
  timeframe: number; // minutes
  mandatory: boolean;
  completed?: boolean;
  completedAt?: Date;
  notes?: string;
}

export interface EscalationLevel {
  level: number;
  title: string;
  triggerCondition: string;
  notifyRoles: string[];
  timeframe: number; // minutes
  actions: string[];
}

export interface SecurityAlert {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  detectedAt: Date;
  status: 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  incidentId?: string;
  autoResolved?: boolean;
}

export class IncidentResponseManager {
  private static instance: IncidentResponseManager;
  private securityMonitor: SecurityMonitor;
  private activePlans: Map<string, IncidentResponsePlan>;
  private activeAlerts: Map<string, SecurityAlert>;
  private responseHistory: SecurityIncident[];

  constructor() {
    this.securityMonitor = SecurityMonitor.getInstance();
    this.activePlans = new Map();
    this.activeAlerts = new Map();
    this.responseHistory = [];
    this.initializeResponsePlans();
    this.startAlertMonitoring();
  }

  static getInstance(): IncidentResponseManager {
    if (!IncidentResponseManager.instance) {
      IncidentResponseManager.instance = new IncidentResponseManager();
    }
    return IncidentResponseManager.instance;
  }

  private initializeResponsePlans(): void {
    const plans: IncidentResponsePlan[] = [
      {
        id: 'plan-data-breach',
        name: 'Data Breach Response',
        description: 'Response plan for suspected or confirmed data breaches',
        triggerConditions: [
          'Unauthorized data access detected',
          'Data exfiltration attempt',
          'Database security violation',
          'Privilege escalation detected'
        ],
        responseSteps: [
          {
            id: 'step-1',
            order: 1,
            title: 'Immediate Containment',
            description: 'Isolate affected systems and prevent further access',
            responsible: 'Security Team',
            timeframe: 15,
            mandatory: true
          },
          {
            id: 'step-2',
            order: 2,
            title: 'Impact Assessment',
            description: 'Determine scope and nature of compromised data',
            responsible: 'Security Team',
            timeframe: 60,
            mandatory: true
          },
          {
            id: 'step-3',
            order: 3,
            title: 'Evidence Preservation',
            description: 'Collect and preserve forensic evidence',
            responsible: 'Security Team',
            timeframe: 120,
            mandatory: true
          },
          {
            id: 'step-4',
            order: 4,
            title: 'Stakeholder Notification',
            description: 'Notify management, legal, and compliance teams',
            responsible: 'Incident Commander',
            timeframe: 30,
            mandatory: true
          },
          {
            id: 'step-5',
            order: 5,
            title: 'Recovery Planning',
            description: 'Develop and execute recovery procedures',
            responsible: 'Technical Team',
            timeframe: 240,
            mandatory: true
          }
        ],
        escalationMatrix: [
          {
            level: 1,
            title: 'Team Lead Notification',
            triggerCondition: 'Incident created',
            notifyRoles: ['Security Team Lead', 'IT Manager'],
            timeframe: 5,
            actions: ['Assign incident handler', 'Activate response team']
          },
          {
            level: 2,
            title: 'Management Escalation',
            triggerCondition: 'High or Critical severity, or 2 hours elapsed',
            notifyRoles: ['CISO', 'CTO', 'Legal Counsel'],
            timeframe: 15,
            actions: ['Executive briefing', 'Legal assessment', 'PR coordination']
          },
          {
            level: 3,
            title: 'External Notification',
            triggerCondition: 'Confirmed data breach with PII involved',
            notifyRoles: ['Compliance Officer', 'External Legal'],
            timeframe: 30,
            actions: ['Regulatory notification', 'Customer communication', 'Public disclosure']
          }
        ],
        requiredRoles: ['Security Team', 'IT Manager', 'Legal Counsel', 'Compliance Officer']
      },
      {
        id: 'plan-malware',
        name: 'Malware Incident Response',
        description: 'Response plan for malware detection and containment',
        triggerConditions: [
          'Malware detected',
          'Suspicious file upload',
          'Unusual system behavior',
          'Antivirus alert'
        ],
        responseSteps: [
          {
            id: 'step-1',
            order: 1,
            title: 'System Isolation',
            description: 'Disconnect affected systems from network',
            responsible: 'Security Team',
            timeframe: 10,
            mandatory: true
          },
          {
            id: 'step-2',
            order: 2,
            title: 'Malware Analysis',
            description: 'Analyze malware sample and determine impact',
            responsible: 'Security Team',
            timeframe: 90,
            mandatory: true
          },
          {
            id: 'step-3',
            order: 3,
            title: 'System Cleaning',
            description: 'Remove malware and verify system integrity',
            responsible: 'Technical Team',
            timeframe: 180,
            mandatory: true
          },
          {
            id: 'step-4',
            order: 4,
            title: 'Recovery Verification',
            description: 'Verify systems are clean and operational',
            responsible: 'Security Team',
            timeframe: 60,
            mandatory: true
          }
        ],
        escalationMatrix: [
          {
            level: 1,
            title: 'Team Notification',
            triggerCondition: 'Malware detected',
            notifyRoles: ['Security Team', 'IT Support'],
            timeframe: 5,
            actions: ['Isolate system', 'Begin analysis']
          },
          {
            level: 2,
            title: 'Management Notification',
            triggerCondition: 'Widespread infection or critical system affected',
            notifyRoles: ['IT Manager', 'Security Manager'],
            timeframe: 30,
            actions: ['Coordinate response', 'Business impact assessment']
          }
        ],
        requiredRoles: ['Security Team', 'IT Support', 'IT Manager']
      }
    ];

    plans.forEach(plan => this.activePlans.set(plan.id, plan));
  }

  private startAlertMonitoring(): void {
    // Monitor security events and automatically create alerts
    setInterval(() => {
      this.checkForSecurityAlerts();
    }, 60000); // Check every minute
  }

  private checkForSecurityAlerts(): void {
    const recentEvents = this.securityMonitor.getRecentEvents(300000); // Last 5 minutes
    
    // Check for suspicious patterns
    this.detectBruteForcePattern(recentEvents);
    this.detectDataAccessAnomalies(recentEvents);
    this.detectUnauthorizedAccess(recentEvents);
  }

  private detectBruteForcePattern(events: any[]): void {
    const failedLogins = events.filter(e => 
      e.type === 'authentication' && 
      e.details?.success === false
    );

    if (failedLogins.length >= 5) {
      this.createSecurityAlert({
        title: 'Potential Brute Force Attack',
        description: `${failedLogins.length} failed login attempts detected in the last 5 minutes`,
        severity: 'high',
        source: 'Automated Monitoring',
        detectedAt: new Date()
      });
    }
  }

  private detectDataAccessAnomalies(events: any[]): void {
    const dataAccess = events.filter(e => e.type === 'data_access');
    
    if (dataAccess.length >= 50) {
      this.createSecurityAlert({
        title: 'Unusual Data Access Pattern',
        description: `${dataAccess.length} data access events detected in short timeframe`,
        severity: 'medium',
        source: 'Automated Monitoring',
        detectedAt: new Date()
      });
    }
  }

  private detectUnauthorizedAccess(events: any[]): void {
    const unauthorizedAttempts = events.filter(e => 
      e.type === 'authorization' && 
      e.details?.success === false
    );

    if (unauthorizedAttempts.length >= 10) {
      this.createSecurityAlert({
        title: 'Multiple Authorization Failures',
        description: `${unauthorizedAttempts.length} unauthorized access attempts detected`,
        severity: 'high',
        source: 'Automated Monitoring',
        detectedAt: new Date()
      });
    }
  }

  // Alert Management
  createSecurityAlert(alertData: Omit<SecurityAlert, 'id' | 'status'>): SecurityAlert {
    const alert: SecurityAlert = {
      ...alertData,
      id: `alert-${Date.now()}`,
      status: 'new'
    };

    this.activeAlerts.set(alert.id, alert);

    // Auto-escalate critical alerts
    if (alert.severity === 'critical') {
      this.escalateAlert(alert.id);
    }

    // Log the alert creation
      this.securityMonitor.logSecurityEvent({
        type: 'monitoring',
        severity: alert.severity,
        details: {
          alertId: alert.id,
          title: alert.title,
          source: alert.source,
          autoGenerated: true
        }
      });

    return alert;
  }

  acknowledgeAlert(alertId: string, assignedTo: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = 'acknowledged';
      alert.assignedTo = assignedTo;
      return true;
    }
    return false;
  }

  escalateAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return;

    // Create incident from alert
    const incident = securityComplianceManager.createIncident({
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      category: 'security_breach',
      status: 'reported',
      reportedBy: 'Automated System',
      impact: this.calculateImpact(alert.severity),
      actions: []
    });

    alert.incidentId = incident.id;
    alert.status = 'investigating';

    // Select appropriate response plan
    const plan = this.selectResponsePlan(alert);
    if (plan) {
      this.activateResponsePlan(plan.id, incident.id);
    }
  }

  private calculateImpact(severity: SecurityAlert['severity']): string {
    switch (severity) {
      case 'critical':
        return 'High - Potential system compromise or data breach';
      case 'high':
        return 'Medium-High - Security control bypass or privilege escalation';
      case 'medium':
        return 'Medium - Security policy violation or suspicious activity';
      case 'low':
        return 'Low - Minor security event or informational alert';
      default:
        return 'Unknown impact';
    }
  }

  private selectResponsePlan(alert: SecurityAlert): IncidentResponsePlan | null {
    // Simple plan selection logic
    if (alert.description.toLowerCase().includes('data') || 
        alert.description.toLowerCase().includes('breach') ||
        alert.description.toLowerCase().includes('access')) {
      return this.activePlans.get('plan-data-breach') || null;
    }
    
    if (alert.description.toLowerCase().includes('malware') ||
        alert.description.toLowerCase().includes('virus') ||
        alert.description.toLowerCase().includes('suspicious file')) {
      return this.activePlans.get('plan-malware') || null;
    }

    return this.activePlans.get('plan-data-breach') || null; // Default plan
  }

  // Response Plan Execution
  activateResponsePlan(planId: string, incidentId: string): boolean {
    const plan = this.activePlans.get(planId);
    if (!plan) return false;

    // Log plan activation
    this.securityMonitor.logSecurityEvent({
      type: 'monitoring',
      severity: 'high',
      details: {
        action: 'plan_activated',
        planId,
        incidentId,
        planName: plan.name
      }
    });

    // Trigger first escalation level
    const firstEscalation = plan.escalationMatrix[0];
    if (firstEscalation) {
      this.executeEscalation(firstEscalation, incidentId);
    }

    return true;
  }

  private executeEscalation(escalation: EscalationLevel, incidentId: string): void {
    // Log escalation
    this.securityMonitor.logSecurityEvent({
      type: 'monitoring',
      severity: 'medium',
      details: {
        action: 'escalation_triggered',
        escalationLevel: escalation.level,
        escalationTitle: escalation.title,
        incidentId,
        notifiedRoles: escalation.notifyRoles
      }
    });

    // In a real implementation, this would send notifications
    console.log(`Escalation ${escalation.level}: ${escalation.title}`, {
      incidentId,
      notifyRoles: escalation.notifyRoles,
      actions: escalation.actions
    });
  }

  // Reporting and Analytics
  getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.activeAlerts.values())
      .filter(alert => alert.status !== 'resolved' && alert.status !== 'false_positive');
  }

  getAlertsByStatus(status: SecurityAlert['status']): SecurityAlert[] {
    return Array.from(this.activeAlerts.values())
      .filter(alert => alert.status === status);
  }

  generateIncidentReport(incidentId: string): {
    incident: SecurityIncident;
    timeline: Array<{ timestamp: Date; event: string; details: any }>;
    responseActions: ResponseStep[];
    lessonsLearned: string[];
  } | null {
    const incidents = securityComplianceManager.getIncidents();
    const incident = incidents.find(i => i.id === incidentId);
    
    if (!incident) return null;

    // Get related events
    const relatedEvents = this.securityMonitor.getRecentEvents(24 * 60 * 60 * 1000)
      .filter(event => 
        event.details?.incidentId === incidentId ||
        event.timestamp >= incident.reportedAt.getTime()
      );

    const timeline = relatedEvents.map(event => ({
      timestamp: new Date(event.timestamp),
      event: event.type,
      details: event.details
    }));

    return {
      incident,
      timeline,
      responseActions: [], // Would be populated from plan execution
      lessonsLearned: incident.lessonsLearned ? [incident.lessonsLearned] : []
    };
  }

  getIncidentMetrics(): {
    totalIncidents: number;
    openIncidents: number;
    averageResolutionTime: number;
    incidentsByCategory: Record<string, number>;
    incidentsBySeverity: Record<string, number>;
  } {
    const incidents = securityComplianceManager.getIncidents();
    const openIncidents = incidents.filter(i => 
      i.status !== 'resolved' && i.status !== 'closed'
    ).length;

    const resolvedIncidents = incidents.filter(i => 
      i.status === 'resolved' && i.resolvedAt
    );

    const avgResolutionTime = resolvedIncidents.length > 0
      ? resolvedIncidents.reduce((sum, incident) => {
          if (incident.resolvedAt) {
            return sum + (incident.resolvedAt.getTime() - incident.reportedAt.getTime());
          }
          return sum;
        }, 0) / resolvedIncidents.length
      : 0;

    const byCategory = incidents.reduce((acc, incident) => {
      acc[incident.category] = (acc[incident.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bySeverity = incidents.reduce((acc, incident) => {
      acc[incident.severity] = (acc[incident.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalIncidents: incidents.length,
      openIncidents,
      averageResolutionTime: avgResolutionTime / (1000 * 60 * 60), // Convert to hours
      incidentsByCategory: byCategory,
      incidentsBySeverity: bySeverity
    };
  }
}

// Export singleton instance
export const incidentResponseManager = IncidentResponseManager.getInstance();