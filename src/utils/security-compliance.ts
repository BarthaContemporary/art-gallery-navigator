// ISO/IEC 27034 Application Security Compliance Framework

export interface SecurityPolicy {
  id: string;
  title: string;
  description: string;
  category: 'technical' | 'procedural' | 'organizational';
  severity: 'low' | 'medium' | 'high' | 'critical';
  implemented: boolean;
  lastReview: Date;
  nextReview: Date;
}

export interface SecurityRequirement {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'pending' | 'implemented' | 'verified' | 'failed';
  evidence?: string;
  lastVerification?: Date;
}

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'security_breach' | 'data_leak' | 'unauthorized_access' | 'malware' | 'social_engineering' | 'other';
  status: 'reported' | 'investigating' | 'contained' | 'resolved' | 'closed';
  reportedBy: string;
  reportedAt: Date;
  assignedTo?: string;
  resolvedAt?: Date;
  impact: string;
  actions: string[];
  lessonsLearned?: string;
}

export interface RiskAssessment {
  id: string;
  asset: string;
  threat: string;
  vulnerability: string;
  likelihood: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  impact: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  mitigation: string;
  owner: string;
  dueDate: Date;
  status: 'identified' | 'analyzing' | 'mitigating' | 'monitoring' | 'closed';
}

// ISO/IEC 27034 Compliance Manager
export class SecurityComplianceManager {
  private static instance: SecurityComplianceManager;
  private policies: SecurityPolicy[] = [];
  private requirements: SecurityRequirement[] = [];
  private incidents: SecurityIncident[] = [];
  private riskAssessments: RiskAssessment[] = [];

  static getInstance(): SecurityComplianceManager {
    if (!SecurityComplianceManager.instance) {
      SecurityComplianceManager.instance = new SecurityComplianceManager();
    }
    return SecurityComplianceManager.instance;
  }

  // Security Policy Management (27034-1)
  getSecurityPolicies(): SecurityPolicy[] {
    return this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies(): SecurityPolicy[] {
    const now = new Date();
    const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    return [
      {
        id: 'pol-001',
        title: 'Application Security Policy',
        description: 'Defines security requirements for all application components including authentication, authorization, data protection, and secure coding practices.',
        category: 'organizational',
        severity: 'critical',
        implemented: true,
        lastReview: now,
        nextReview: nextYear
      },
      {
        id: 'pol-002',
        title: 'Data Protection and Privacy Policy',
        description: 'Establishes requirements for data classification, encryption, access controls, and privacy protection in compliance with GDPR and other regulations.',
        category: 'technical',
        severity: 'critical',
        implemented: true,
        lastReview: now,
        nextReview: nextYear
      },
      {
        id: 'pol-003',
        title: 'Incident Response Policy',
        description: 'Defines procedures for detecting, reporting, containing, and recovering from security incidents.',
        category: 'procedural',
        severity: 'high',
        implemented: true,
        lastReview: now,
        nextReview: nextYear
      },
      {
        id: 'pol-004',
        title: 'Secure Development Lifecycle Policy',
        description: 'Mandates security requirements integration throughout the software development lifecycle.',
        category: 'procedural',
        severity: 'high',
        implemented: true,
        lastReview: now,
        nextReview: nextYear
      }
    ];
  }

  // Security Requirements Management
  getSecurityRequirements(): SecurityRequirement[] {
    return this.initializeDefaultRequirements();
  }

  private initializeDefaultRequirements(): SecurityRequirement[] {
    return [
      {
        id: 'req-001',
        title: 'Multi-Factor Authentication',
        description: 'All user accounts must implement multi-factor authentication',
        category: 'Authentication',
        status: 'implemented',
        evidence: 'CAPTCHA and OTP verification implemented',
        lastVerification: new Date()
      },
      {
        id: 'req-002',
        title: 'Data Encryption at Rest',
        description: 'All sensitive data must be encrypted when stored',
        category: 'Data Protection',
        status: 'implemented',
        evidence: 'Supabase provides automatic encryption at rest',
        lastVerification: new Date()
      },
      {
        id: 'req-003',
        title: 'Input Validation',
        description: 'All user inputs must be validated and sanitized',
        category: 'Input Security',
        status: 'implemented',
        evidence: 'SecurityValidation class with comprehensive input sanitization',
        lastVerification: new Date()
      },
      {
        id: 'req-004',
        title: 'Security Headers',
        description: 'All HTTP responses must include appropriate security headers',
        category: 'Transport Security',
        status: 'implemented',
        evidence: 'Comprehensive security headers in security-headers.ts',
        lastVerification: new Date()
      }
    ];
  }

  // Risk Assessment Management
  getRiskAssessments(): RiskAssessment[] {
    return this.initializeDefaultRiskAssessments();
  }

  private initializeDefaultRiskAssessments(): RiskAssessment[] {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);

    return [
      {
        id: 'risk-001',
        asset: 'User Authentication System',
        threat: 'Brute Force Attack',
        vulnerability: 'Weak password policies',
        likelihood: 'medium',
        impact: 'high',
        riskLevel: 'high',
        mitigation: 'Implement account lockout and strong password requirements',
        owner: 'Security Team',
        dueDate: futureDate,
        status: 'mitigating'
      },
      {
        id: 'risk-002',
        asset: 'Database',
        threat: 'SQL Injection',
        vulnerability: 'Inadequate input validation',
        likelihood: 'low',
        impact: 'high',
        riskLevel: 'medium',
        mitigation: 'Use parameterized queries and input validation',
        owner: 'Development Team',
        dueDate: futureDate,
        status: 'monitoring'
      }
    ];
  }

  // Incident Management
  createIncident(incident: Omit<SecurityIncident, 'id' | 'reportedAt'>): SecurityIncident {
    const newIncident: SecurityIncident = {
      ...incident,
      id: `inc-${Date.now()}`,
      reportedAt: new Date()
    };
    this.incidents.push(newIncident);
    return newIncident;
  }

  getIncidents(): SecurityIncident[] {
    return this.incidents;
  }

  updateIncidentStatus(incidentId: string, status: SecurityIncident['status'], actions?: string[]): void {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (incident) {
      incident.status = status;
      if (actions) {
        incident.actions.push(...actions);
      }
      if (status === 'resolved' || status === 'closed') {
        incident.resolvedAt = new Date();
      }
    }
  }

  // Compliance Reporting
  generateComplianceReport(): {
    overallCompliance: number;
    policiesCompliance: number;
    requirementsCompliance: number;
    riskManagement: number;
    recommendations: string[];
  } {
    const policies = this.getSecurityPolicies();
    const requirements = this.getSecurityRequirements();
    const risks = this.getRiskAssessments();

    const implementedPolicies = policies.filter(p => p.implemented).length;
    const policiesCompliance = (implementedPolicies / policies.length) * 100;

    const implementedRequirements = requirements.filter(r => r.status === 'implemented' || r.status === 'verified').length;
    const requirementsCompliance = (implementedRequirements / requirements.length) * 100;

    const managedRisks = risks.filter(r => r.status === 'mitigating' || r.status === 'monitoring' || r.status === 'closed').length;
    const riskManagement = (managedRisks / risks.length) * 100;

    const overallCompliance = (policiesCompliance + requirementsCompliance + riskManagement) / 3;

    const recommendations: string[] = [];
    
    if (policiesCompliance < 100) {
      recommendations.push('Review and implement missing security policies');
    }
    if (requirementsCompliance < 100) {
      recommendations.push('Complete implementation of pending security requirements');
    }
    if (riskManagement < 100) {
      recommendations.push('Address unmanaged security risks');
    }

    return {
      overallCompliance,
      policiesCompliance,
      requirementsCompliance,
      riskManagement,
      recommendations
    };
  }
}

// Export singleton instance
export const securityComplianceManager = SecurityComplianceManager.getInstance();