import { auditLogger } from './auditLogger';
import { getTimestamp, AppError } from './utils';

export interface Policy {
  id: string;
  name: string;
  maxSinglePaymentUSD: number;
  maxDailyPaymentUSD: number;
  allowedRecipients: string[];
  allowedTokenAddresses: string[];
  requireApprovalAboveUSD: number;
  expiresAt: number;
}

export interface PaymentRequest {
  amountUSD: number;
  recipient: string;
  tokenAddress?: string;
  sessionId: string;
  agent: string;
  reason?: string;          // Payment explanation (Agent-native requirement)
  taskContext?: {
    taskType?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    previousTaskId?: string;
  };
  retryCount?: number;      // For failure retry mechanism
}

interface DailySpend {
  date: string;
  totalUSD: number;
  payments: number;
}

class PolicyEngine {
  private policies: Map<string, Policy> = new Map();
  private dailySpends: Map<string, DailySpend> = new Map();

  registerPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
  }

  getPolicy(id: string): Policy | undefined {
    return this.policies.get(id);
  }

  validatePayment(request: PaymentRequest, policyIds: string[]): { approved: boolean; reason?: string } {
    for (const policyId of policyIds) {
      const policy = this.policies.get(policyId);
      if (!policy) {
        return { approved: false, reason: `Policy ${policyId} not found` };
      }

      if (getTimestamp() > policy.expiresAt) {
        auditLogger.logPolicyViolation(request.sessionId, policyId, request.agent, 'Policy expired');
        return { approved: false, reason: `Policy ${policyId} has expired` };
      }

      if (request.amountUSD > policy.maxSinglePaymentUSD) {
        auditLogger.logPolicyViolation(request.sessionId, policyId, request.agent, 
          `Amount ${request.amountUSD} exceeds max single payment ${policy.maxSinglePaymentUSD}`);
        return { approved: false, reason: `Amount exceeds policy limit of ${policy.maxSinglePaymentUSD} USD` };
      }

      const dailySpend = this.getDailySpend(request.sessionId);
      if (dailySpend.totalUSD + request.amountUSD > policy.maxDailyPaymentUSD) {
        auditLogger.logPolicyViolation(request.sessionId, policyId, request.agent,
          `Daily limit would be exceeded: ${dailySpend.totalUSD} + ${request.amountUSD} > ${policy.maxDailyPaymentUSD}`);
        return { approved: false, reason: `Daily payment limit of ${policy.maxDailyPaymentUSD} USD would be exceeded` };
      }

      if (policy.allowedRecipients.length > 0 && !policy.allowedRecipients.includes(request.recipient)) {
        auditLogger.logPolicyViolation(request.sessionId, policyId, request.agent,
          `Recipient ${request.recipient} not in allowed list`);
        return { approved: false, reason: `Recipient not in policy allowed list` };
      }

      if (request.tokenAddress && policy.allowedTokenAddresses.length > 0 && 
          !policy.allowedTokenAddresses.includes(request.tokenAddress)) {
        auditLogger.logPolicyViolation(request.sessionId, policyId, request.agent,
          `Token ${request.tokenAddress} not allowed`);
        return { approved: false, reason: `Token not in policy allowed list` };
      }
    }

    return { approved: true };
  }

  recordPayment(sessionId: string, amountUSD: number): void {
    const today = new Date().toISOString().split('T')[0];
    const key = `${sessionId}_${today}`;
    
    const current = this.dailySpends.get(key);
    if (current) {
      current.totalUSD += amountUSD;
      current.payments += 1;
    } else {
      this.dailySpends.set(key, {
        date: today,
        totalUSD: amountUSD,
        payments: 1
      });
    }
  }

  getDailySpend(sessionId: string): DailySpend {
    const today = new Date().toISOString().split('T')[0];
    const key = `${sessionId}_${today}`;
    return this.dailySpends.get(key) || { date: today, totalUSD: 0, payments: 0 };
  }

  requiresApproval(amountUSD: number, policyIds: string[]): boolean {
    for (const policyId of policyIds) {
      const policy = this.policies.get(policyId);
      if (policy && amountUSD >= policy.requireApprovalAboveUSD) {
        return true;
      }
    }
    return false;
  }

  createDefaultPolicy(agent: string, expiryHours: number = 24): Policy {
    const expiry = getTimestamp() + expiryHours * 3600;
    return {
      id: `policy_${agent}_${getTimestamp()}`,
      name: 'Default Policy',
      maxSinglePaymentUSD: parseFloat(process.env.MAX_SINGLE_PAYMENT_USD || '100'),
      maxDailyPaymentUSD: parseFloat(process.env.MAX_DAILY_PAYMENT_USD || '1000'),
      allowedRecipients: [],
      allowedTokenAddresses: [],
      requireApprovalAboveUSD: 50,
      expiresAt: expiry
    };
  }
}

export const policyEngine = new PolicyEngine();
export default policyEngine;
