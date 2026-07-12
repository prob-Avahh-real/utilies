import winston from 'winston';
import { getTimestamp, formatTimestamp } from './utils';

export interface AuditEvent {
  eventType: 'SESSION_CREATED' | 'PAYMENT_INITIATED' | 'PAYMENT_COMPLETED' | 'PAYMENT_FAILED' | 'POLICY_VIOLATION' | 'KEY_REVOKED';
  sessionId?: string;
  taskId?: string;
  actor: string;
  amount?: string;
  recipient?: string;
  policyId?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

class AuditLogger {
  private logger: winston.Logger;

  constructor() {
    const logPath = process.env.AUDIT_LOG_PATH || './audit.log';
    
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: logPath }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  log(event: AuditEvent): void {
    const entry = {
      timestamp: getTimestamp(),
      isoTime: formatTimestamp(getTimestamp()),
      ...event
    };
    
    this.logger.info('AUDIT_EVENT', entry);
  }

  logSessionCreated(sessionId: string, agent: string, expiry: number, policies: string[]): void {
    this.log({
      eventType: 'SESSION_CREATED',
      sessionId,
      actor: agent,
      metadata: { expiry, policies }
    });
  }

  logPaymentInitiated(sessionId: string, taskId: string, agent: string, amount: string, recipient: string, reason?: string): void {
    this.log({
      eventType: 'PAYMENT_INITIATED',
      sessionId,
      taskId,
      actor: agent,
      amount,
      recipient,
      reason,
      metadata: { paymentReason: reason }
    });
  }

  logPaymentCompleted(sessionId: string, taskId: string, agent: string, txHash: string, reason?: string): void {
    this.log({
      eventType: 'PAYMENT_COMPLETED',
      sessionId,
      taskId,
      actor: agent,
      reason,
      metadata: { txHash, paymentReason: reason }
    });
  }

  logPaymentFailed(sessionId: string, taskId: string, agent: string, reason: string): void {
    this.log({
      eventType: 'PAYMENT_FAILED',
      sessionId,
      taskId,
      actor: agent,
      reason
    });
  }

  logPolicyViolation(sessionId: string, policyId: string, agent: string, reason: string): void {
    this.log({
      eventType: 'POLICY_VIOLATION',
      sessionId,
      policyId,
      actor: agent,
      reason
    });
  }

  logKeyRevoked(sessionId: string, agent: string, reason: string): void {
    this.log({
      eventType: 'KEY_REVOKED',
      sessionId,
      actor: agent,
      reason
    });
  }
}

export const auditLogger = new AuditLogger();
export default auditLogger;
