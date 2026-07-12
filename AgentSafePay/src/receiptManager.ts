import { getTimestamp, formatTimestamp, generateTaskId } from './utils';
import { PaymentRequest } from './policyEngine';

export interface PaymentReceipt {
  receiptId: string;
  taskId: string;
  version: string;
  timestamp: number;
  isoTimestamp: string;
  
  // Payment details
  sessionId: string;
  agent: string;
  amountUSD: number;
  amountToken: string;
  tokenAddress: string;
  recipient: string;
  
  // Reasoning (Agent-native requirement)
  paymentReason: string;
  taskContext?: {
    taskType?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
  };
  
  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  
  // Policy compliance
  policyId: string;
  policyHits: string[];
  requiredApproval: boolean;
  humanConfirmed: boolean;
  
  // Execution
  txHash?: string;
  chainId: number;
  status: 'pending' | 'completed' | 'failed' | 'retried';
  retryCount: number;
  
  // Audit trail
  previousReceiptId?: string;
  triggeredBy: string;
  executionTimeMs: number;
}

class ReceiptManager {
  private receipts: Map<string, PaymentReceipt> = new Map();
  private taskReceipts: Map<string, string> = new Map(); // taskId -> receiptId

  generateReceipt(
    request: PaymentRequest,
    policyId: string,
    options: {
      txHash?: string;
      status: PaymentReceipt['status'];
      executionTimeMs: number;
      riskLevel: PaymentReceipt['riskLevel'];
      riskFactors: string[];
      previousReceiptId?: string;
      humanConfirmed?: boolean;
    }
  ): PaymentReceipt {
    const receiptId = `rcpt_${generateTaskId().slice(5)}`;
    const chainId = parseInt(process.env.MONAD_CHAIN_ID || '10143');
    
    const receipt: PaymentReceipt = {
      receiptId,
      taskId: generateTaskId(),
      version: '1.0.0',
      timestamp: getTimestamp(),
      isoTimestamp: formatTimestamp(getTimestamp()),
      sessionId: request.sessionId,
      agent: request.agent,
      amountUSD: request.amountUSD,
      amountToken: '0', // Calculated at execution time
      tokenAddress: request.tokenAddress || '0x0000000000000000000000000000000000000000',
      recipient: request.recipient,
      paymentReason: request.reason || 'No reason provided',
      taskContext: request.taskContext,
      riskLevel: options.riskLevel,
      riskFactors: options.riskFactors,
      policyId,
      policyHits: [],
      requiredApproval: options.riskLevel === 'high' || options.riskLevel === 'critical',
      humanConfirmed: options.humanConfirmed || false,
      txHash: options.txHash,
      chainId,
      status: options.status,
      retryCount: request.retryCount || 0,
      previousReceiptId: options.previousReceiptId,
      triggeredBy: request.agent,
      executionTimeMs: options.executionTimeMs
    };

    this.receipts.set(receiptId, receipt);
    this.taskReceipts.set(receipt.taskId, receiptId);
    
    return receipt;
  }

  getReceipt(receiptId: string): PaymentReceipt | undefined {
    return this.receipts.get(receiptId);
  }

  getReceiptByTaskId(taskId: string): PaymentReceipt | undefined {
    const receiptId = this.taskReceipts.get(taskId);
    return receiptId ? this.receipts.get(receiptId) : undefined;
  }

  getSessionReceipts(sessionId: string): PaymentReceipt[] {
    return Array.from(this.receipts.values())
      .filter(r => r.sessionId === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  calculateRiskLevel(request: PaymentRequest): { level: PaymentReceipt['riskLevel']; factors: string[] } {
    const factors: string[] = [];
    let score = 0;

    // Amount-based risk
    if (request.amountUSD > 1000) {
      score += 40;
      factors.push('High amount (> $1000)');
    } else if (request.amountUSD > 100) {
      score += 20;
      factors.push('Medium amount (> $100)');
    }

    // Retry-based risk
    if ((request.retryCount || 0) > 2) {
      score += 30;
      factors.push('Multiple retry attempts');
    }

    // Missing reason risk (Agent-native)
    if (!request.reason) {
      score += 15;
      factors.push('Missing payment explanation');
    }

    // High priority task
    if (request.taskContext?.priority === 'high') {
      score += 10;
      factors.push('High priority task');
    }

    // Determine level
    let level: PaymentReceipt['riskLevel'];
    if (score >= 60) level = 'critical';
    else if (score >= 40) level = 'high';
    else if (score >= 20) level = 'medium';
    else level = 'low';

    return { level, factors };
  }

  // Structured receipt format for competition requirement F
  formatStructuredReceipt(receipt: PaymentReceipt): object {
    return {
      receipt_id: receipt.receiptId,
      task_id: receipt.taskId,
      agent_id: receipt.agent,
      timestamp: receipt.isoTimestamp,
      amount: {
        usd: receipt.amountUSD,
        token: receipt.amountToken,
        currency: receipt.tokenAddress === '0x0000000000000000000000000000000000000000' ? 'MON' : 'ERC20'
      },
      recipient: receipt.recipient,
      reason: receipt.paymentReason,
      risk: {
        level: receipt.riskLevel,
        factors: receipt.riskFactors,
        required_approval: receipt.requiredApproval,
        human_confirmed: receipt.humanConfirmed
      },
      policy: {
        id: receipt.policyId,
        hits: receipt.policyHits
      },
      execution: {
        status: receipt.status,
        tx_hash: receipt.txHash,
        chain_id: receipt.chainId,
        retry_count: receipt.retryCount,
        execution_time_ms: receipt.executionTimeMs
      },
      audit: {
        triggered_by: receipt.triggeredBy,
        previous_receipt: receipt.previousReceiptId
      }
    };
  }
}

export const receiptManager = new ReceiptManager();
export default receiptManager;
