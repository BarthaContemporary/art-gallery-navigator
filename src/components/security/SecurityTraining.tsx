import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  BookOpen, 
  Shield, 
  Code, 
  Users, 
  AlertTriangle, 
  CheckCircle,
  FileText,
  Video,
  Lightbulb
} from "lucide-react";

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  category: 'secure_coding' | 'security_awareness' | 'compliance' | 'incident_response';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // minutes
  content: TrainingContent[];
  quiz?: QuizQuestion[];
  completed?: boolean;
}

interface TrainingContent {
  type: 'text' | 'code' | 'checklist' | 'video';
  title: string;
  content: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export function SecurityTraining() {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());
  const [currentQuizAnswers, setCurrentQuizAnswers] = useState<Record<string, number>>({});

  const trainingModules: TrainingModule[] = [
    {
      id: 'secure-coding-101',
      title: 'Secure Coding Fundamentals',
      description: 'Essential secure coding practices to prevent common vulnerabilities',
      category: 'secure_coding',
      difficulty: 'beginner',
      duration: 45,
      content: [
        {
          type: 'text',
          title: 'Introduction to Secure Coding',
          content: `Secure coding is the practice of developing software in a way that protects against security vulnerabilities. It involves:

• Input validation and sanitization
• Proper authentication and authorization
• Secure data handling and storage
• Error handling that doesn't leak information
• Protection against common attack vectors`
        },
        {
          type: 'code',
          title: 'Input Validation Example',
          content: `// ❌ WRONG - Vulnerable to injection attacks
const query = "SELECT * FROM users WHERE id = " + userId;

// ✅ CORRECT - Use parameterized queries
const query = "SELECT * FROM users WHERE id = ?";
const result = await db.query(query, [userId]);

// ❌ WRONG - No input validation
function updateUser(userData) {
  return database.users.update(userData);
}

// ✅ CORRECT - Validate and sanitize input
function updateUser(userData) {
  const validation = SecurityValidation.validateTextContent(userData.name);
  if (!validation.isValid) {
    throw new Error('Invalid input data');
  }
  return database.users.update({
    ...userData,
    name: validation.sanitized
  });
}`
        },
        {
          type: 'checklist',
          title: 'Secure Coding Checklist',
          content: `□ Validate all user inputs
□ Sanitize data before output
□ Use parameterized queries for database access
□ Implement proper authentication
□ Use HTTPS for all communications
□ Handle errors securely without information leakage
□ Implement proper logging and monitoring
□ Keep dependencies updated
□ Use security headers
□ Implement rate limiting`
        }
      ],
      quiz: [
        {
          id: 'q1',
          question: 'Which of the following is the best way to prevent SQL injection?',
          options: [
            'Input filtering',
            'Parameterized queries',
            'String concatenation',
            'User input validation only'
          ],
          correctAnswer: 1,
          explanation: 'Parameterized queries separate SQL code from data, preventing injection attacks.'
        },
        {
          id: 'q2',
          question: 'What should you do with user input before displaying it in HTML?',
          options: [
            'Display it directly',
            'Sanitize and escape it',
            'Only validate it',
            'Convert to uppercase'
          ],
          correctAnswer: 1,
          explanation: 'User input should be sanitized and escaped to prevent XSS attacks.'
        }
      ]
    },
    {
      id: 'security-awareness',
      title: 'Security Awareness Training',
      description: 'Understanding security threats and best practices for all team members',
      category: 'security_awareness',
      difficulty: 'beginner',
      duration: 30,
      content: [
        {
          type: 'text',
          title: 'Common Security Threats',
          content: `Understanding common security threats helps everyone contribute to application security:

**Phishing Attacks**
Fraudulent attempts to obtain sensitive information through deceptive emails or websites.

**Social Engineering**
Manipulating people to divulge confidential information or perform actions that compromise security.

**Malware**
Malicious software designed to damage, disrupt, or gain unauthorized access to systems.

**Data Breaches**
Unauthorized access to sensitive data, often resulting from inadequate security controls.

**Insider Threats**
Security risks posed by employees, contractors, or business associates who have authorized access.`
        },
        {
          type: 'checklist',
          title: 'Security Best Practices',
          content: `□ Use strong, unique passwords for all accounts
□ Enable multi-factor authentication where available
□ Be cautious with email attachments and links
□ Keep software and systems updated
□ Report suspicious activities immediately
□ Follow company security policies
□ Secure physical workspaces
□ Use approved software and services only
□ Backup important data regularly
□ Think before you click or share`
        },
        {
          type: 'text',
          title: 'Incident Reporting',
          content: `If you suspect a security incident:

1. **Don't Panic** - Take a moment to assess the situation
2. **Document** - Note what happened, when, and any error messages
3. **Isolate** - If possible, disconnect affected systems
4. **Report** - Contact the security team immediately
5. **Preserve** - Don't delete anything that might be evidence
6. **Cooperate** - Work with the incident response team

Remember: It's better to report a false alarm than to miss a real incident.`
        }
      ],
      quiz: [
        {
          id: 'q1',
          question: 'What should you do if you receive a suspicious email asking for your password?',
          options: [
            'Reply with your password',
            'Click the link to verify',
            'Report it to IT security',
            'Forward it to colleagues'
          ],
          correctAnswer: 2,
          explanation: 'Suspicious emails should be reported to IT security without interacting with them.'
        },
        {
          id: 'q2',
          question: 'How often should you update your passwords?',
          options: [
            'Never',
            'Every few years',
            'Regularly, and when compromised',
            'Only when forced'
          ],
          correctAnswer: 2,
          explanation: 'Passwords should be updated regularly and immediately if potentially compromised.'
        }
      ]
    },
    {
      id: 'iso-27034-compliance',
      title: 'ISO/IEC 27034 Application Security',
      description: 'Understanding and implementing ISO/IEC 27034 application security standards',
      category: 'compliance',
      difficulty: 'intermediate',
      duration: 60,
      content: [
        {
          type: 'text',
          title: 'ISO/IEC 27034 Overview',
          content: `ISO/IEC 27034 provides guidance for application security. It consists of several parts:

**Part 1: Overview and Concepts**
Introduces application security concepts and the Application Security Management Framework.

**Part 2: Organization Normative Framework**
Provides guidance for organizations to define their application security framework.

**Part 3: Application Security Management Process**
Describes the process for managing application security throughout the lifecycle.

**Part 4: Application Security Validation**
Provides guidance for validating application security controls.

**Part 5: Protocols and Application Security Control Data Structure**
Defines data structures for security controls and protocols.

**Part 6: Security Guidance for Specific Applications**
Provides guidance for specific types of applications.`
        },
        {
          type: 'text',
          title: 'Key Principles',
          content: `The standard is built on several key principles:

**Risk-Based Approach**
Security controls should be based on risk assessment and business requirements.

**Defense in Depth**
Multiple layers of security controls to protect against various threats.

**Continuous Improvement**
Regular review and improvement of security controls and processes.

**Integration with SDLC**
Security should be integrated throughout the software development lifecycle.

**Documentation and Evidence**
All security controls and processes should be documented with evidence of implementation.`
        },
        {
          type: 'checklist',
          title: 'Compliance Implementation Checklist',
          content: `□ Establish Application Security Management Framework
□ Define security policies and procedures
□ Implement risk assessment process
□ Integrate security into SDLC
□ Implement security controls catalog
□ Establish incident response procedures
□ Implement security testing and validation
□ Maintain security documentation
□ Provide security training
□ Regular security reviews and audits
□ Continuous monitoring and improvement
□ Evidence collection and management`
        }
      ],
      quiz: [
        {
          id: 'q1',
          question: 'What is the main focus of ISO/IEC 27034?',
          options: [
            'Network security',
            'Application security',
            'Physical security',
            'Database security'
          ],
          correctAnswer: 1,
          explanation: 'ISO/IEC 27034 specifically focuses on application security management.'
        },
        {
          id: 'q2',
          question: 'When should security be integrated into the development process?',
          options: [
            'Only at the end',
            'Only during testing',
            'Throughout the entire SDLC',
            'Only during design'
          ],
          correctAnswer: 2,
          explanation: 'Security should be integrated throughout the entire Software Development Lifecycle.'
        }
      ]
    },
    {
      id: 'incident-response',
      title: 'Incident Response Procedures',
      description: 'Learn how to respond effectively to security incidents',
      category: 'incident_response',
      difficulty: 'intermediate',
      duration: 40,
      content: [
        {
          type: 'text',
          title: 'Incident Response Lifecycle',
          content: `Security incident response follows a structured lifecycle:

**1. Preparation**
- Establish incident response team
- Develop response procedures
- Set up communication channels
- Prepare tools and resources

**2. Detection and Analysis**
- Monitor for security events
- Analyze and classify incidents
- Determine scope and impact
- Collect initial evidence

**3. Containment, Eradication, and Recovery**
- Contain the incident to prevent spread
- Remove the threat from systems
- Restore systems to normal operation
- Implement additional safeguards

**4. Post-Incident Activities**
- Document lessons learned
- Update procedures and controls
- Conduct post-incident review
- Share information with stakeholders`
        },
        {
          type: 'text',
          title: 'Incident Classification',
          content: `Incidents should be classified by severity:

**Critical**
- Complete system compromise
- Confirmed data breach with sensitive data
- Ransomware infection
- Active attack in progress

**High**
- Unauthorized access to sensitive systems
- Suspected data breach
- Malware detection on critical systems
- Significant service disruption

**Medium**
- Failed intrusion attempts
- Policy violations
- Suspicious network activity
- Minor service disruptions

**Low**
- Routine security events
- False alarms
- Minor policy violations
- Information gathering attempts`
        },
        {
          type: 'checklist',
          title: 'Incident Response Checklist',
          content: `□ Identify and assess the incident
□ Activate incident response team
□ Contain the threat
□ Preserve evidence
□ Notify stakeholders
□ Document all actions
□ Eradicate the threat
□ Recover affected systems
□ Monitor for reoccurrence
□ Conduct post-incident review
□ Update security controls
□ Share lessons learned`
        }
      ],
      quiz: [
        {
          id: 'q1',
          question: 'What is the first step when a security incident is detected?',
          options: [
            'Eradicate the threat',
            'Notify the media',
            'Assess and classify the incident',
            'Restore systems'
          ],
          correctAnswer: 2,
          explanation: 'The first step is to assess and classify the incident to determine the appropriate response.'
        },
        {
          id: 'q2',
          question: 'Why is evidence preservation important during incident response?',
          options: [
            'For legal proceedings',
            'For post-incident analysis',
            'For compliance requirements',
            'All of the above'
          ],
          correctAnswer: 3,
          explanation: 'Evidence preservation is important for legal, analytical, and compliance purposes.'
        }
      ]
    }
  ];

  const handleModuleComplete = (moduleId: string) => {
    setCompletedModules(prev => new Set([...prev, moduleId]));
  };

  const handleQuizAnswer = (questionId: string, answer: number) => {
    setCurrentQuizAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const getModulesByCategory = (category: TrainingModule['category']) => {
    return trainingModules.filter(module => module.category === category);
  };

  const getOverallProgress = () => {
    return (completedModules.size / trainingModules.length) * 100;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600';
      case 'intermediate': return 'text-yellow-600';
      case 'advanced': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const renderContent = (content: TrainingContent) => {
    switch (content.type) {
      case 'text':
        return (
          <div className="prose prose-sm max-w-none">
            <h4 className="font-medium mb-2">{content.title}</h4>
            <div className="whitespace-pre-line text-sm">{content.content}</div>
          </div>
        );
      case 'code':
        return (
          <div>
            <h4 className="font-medium mb-2">{content.title}</h4>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
              <code>{content.content}</code>
            </pre>
          </div>
        );
      case 'checklist':
        return (
          <div>
            <h4 className="font-medium mb-2">{content.title}</h4>
            <div className="bg-blue-50 p-4 rounded">
              <pre className="text-sm whitespace-pre-line">{content.content}</pre>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const selectedModuleData = selectedModule ? trainingModules.find(m => m.id === selectedModule) : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Training & Awareness</h1>
          <p className="text-muted-foreground">ISO/IEC 27034-2 Training and Awareness Program</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{Math.round(getOverallProgress())}%</div>
          <p className="text-sm text-muted-foreground">Overall Progress</p>
          <Progress value={getOverallProgress()} className="w-32 mt-2" />
        </div>
      </div>

      {selectedModule ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {selectedModuleData?.title}
                </CardTitle>
                <CardDescription>{selectedModuleData?.description}</CardDescription>
              </div>
              <Button variant="outline" onClick={() => setSelectedModule(null)}>
                Back to Modules
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {selectedModuleData && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Badge variant="outline">{selectedModuleData.category.replace('_', ' ')}</Badge>
                  <Badge 
                    variant="outline" 
                    className={getDifficultyColor(selectedModuleData.difficulty)}
                  >
                    {selectedModuleData.difficulty}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {selectedModuleData.duration} minutes
                  </span>
                </div>

                <div className="space-y-8">
                  {selectedModuleData.content.map((content, index) => (
                    <div key={index}>
                      {renderContent(content)}
                    </div>
                  ))}
                </div>

                {selectedModuleData.quiz && (
                  <div className="border-t pt-6">
                    <h3 className="font-medium mb-4">Knowledge Check</h3>
                    <div className="space-y-4">
                      {selectedModuleData.quiz.map((question, index) => (
                        <div key={question.id} className="border rounded p-4">
                          <h4 className="font-medium mb-3">{question.question}</h4>
                          <div className="space-y-2">
                            {question.options.map((option, optionIndex) => (
                              <label key={optionIndex} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={question.id}
                                  value={optionIndex}
                                  onChange={() => handleQuizAnswer(question.id, optionIndex)}
                                  className="radio"
                                />
                                <span className="text-sm">{option}</span>
                              </label>
                            ))}
                          </div>
                          {currentQuizAnswers[question.id] !== undefined && (
                            <div className="mt-3 p-3 rounded bg-gray-50">
                              <div className="flex items-center gap-2 mb-2">
                                {currentQuizAnswers[question.id] === question.correctAnswer ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-red-600" />
                                )}
                                <span className="font-medium">
                                  {currentQuizAnswers[question.id] === question.correctAnswer ? 'Correct!' : 'Incorrect'}
                                </span>
                              </div>
                              <p className="text-sm">{question.explanation}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-6 border-t">
                  <Button 
                    onClick={() => handleModuleComplete(selectedModule)}
                    disabled={completedModules.has(selectedModule)}
                  >
                    {completedModules.has(selectedModule) ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Completed
                      </>
                    ) : (
                      'Mark as Complete'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="secure_coding" className="space-y-4">
          <TabsList>
            <TabsTrigger value="secure_coding">
              <Code className="h-4 w-4 mr-2" />
              Secure Coding
            </TabsTrigger>
            <TabsTrigger value="security_awareness">
              <Shield className="h-4 w-4 mr-2" />
              Security Awareness
            </TabsTrigger>
            <TabsTrigger value="compliance">
              <FileText className="h-4 w-4 mr-2" />
              Compliance
            </TabsTrigger>
            <TabsTrigger value="incident_response">
              <Users className="h-4 w-4 mr-2" />
              Incident Response
            </TabsTrigger>
          </TabsList>

          {(['secure_coding', 'security_awareness', 'compliance', 'incident_response'] as const).map(category => (
            <TabsContent key={category} value={category} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getModulesByCategory(category).map(module => (
                  <Card key={module.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{module.title}</CardTitle>
                        {completedModules.has(module.id) && (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                      <CardDescription>{module.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={getDifficultyColor(module.difficulty)}
                          >
                            {module.difficulty}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {module.duration} min
                          </span>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setSelectedModule(module.id)}
                        className="w-full"
                        variant={completedModules.has(module.id) ? "outline" : "default"}
                      >
                        {completedModules.has(module.id) ? 'Review' : 'Start Training'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <Alert>
        <Lightbulb className="h-4 w-4" />
        <AlertDescription>
          Regular security training is essential for maintaining ISO/IEC 27034 compliance. 
          Complete all modules and stay updated with the latest security practices and threats.
        </AlertDescription>
      </Alert>
    </div>
  );
}