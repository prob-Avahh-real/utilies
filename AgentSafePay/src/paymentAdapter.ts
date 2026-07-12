import { ethers } from 'ethers';
import { auditLogger } from './auditLogger';
import policyEngine, { PaymentRequest } from './policyEngine';
import sessionManager from './sessionManager';
import receiptManager, { PaymentReceipt } from './receiptManager';
import { generateTaskId, usdToWei, AppError, sleep } from './utils';

// x402 protocol interface
interface X402Payment {
  amount: string;
  receiver: string;
  token: string;
  chainId: number;
  deadline: number;
}

interface PaymentResult {
  success: boolean;
  taskId: string;
  txHash?: string;
  error?: string;
  receipt?: PaymentReceipt;
  retryScheduled?: boolean;
}

class PaymentAdapter {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet | null = null;
  private ethPrice: number = 3000; // Mock ETH price - integrate with Chainlink in production

  constructor() {
    const rpcUrl = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey && privateKey !== 'your_private_key_here') {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    }
  }

  async executePayment(request: PaymentRequest, attempt: number = 1): Promise<PaymentResult> {
    const taskId = generateTaskId();
    const startTime = Date.now();
    const { sessionId, agent, amountUSD, recipient, tokenAddress, reason, taskContext } = request;
    const maxRetries = 3;

    try {
      // Validate session
      const session = sessionManager.validateSession(sessionId);
      
      // Risk assessment (for receipt)
      const riskAssessment = receiptManager.calculateRiskLevel(request);
      
      // Validate policies
      const policyCheck = policyEngine.validatePayment(request, session.policies);
      if (!policyCheck.approved) {
        auditLogger.logPaymentFailed(sessionId, taskId, agent, policyCheck.reason || 'Policy check failed');
        
        // Generate failed receipt
        const receipt = receiptManager.generateReceipt(request, session.policies[0], {
          status: 'failed',
          executionTimeMs: Date.now() - startTime,
          riskLevel: riskAssessment.level,
          riskFactors: riskAssessment.factors,
          previousReceiptId: request.taskContext?.previousTaskId
        });
        
        return { success: false, taskId, error: policyCheck.reason, receipt };
      }

      auditLogger.logPaymentInitiated(sessionId, taskId, agent, amountUSD.toString(), recipient, reason);

      // Check if requires approval (human-in-the-loop)
      const requiresApproval = policyEngine.requiresApproval(amountUSD, session.policies);
      if (requiresApproval) {
        auditLogger.logPaymentFailed(sessionId, taskId, agent, 'Requires human approval');
        
        const receipt = receiptManager.generateReceipt(request, session.policies[0], {
          status: 'pending',
          executionTimeMs: Date.now() - startTime,
          riskLevel: 'high',
          riskFactors: [...riskAssessment.factors, 'Requires human approval'],
          humanConfirmed: false
        });
        
        return { success: false, taskId, error: 'Payment requires human approval', receipt };
      }

      // Execute on-chain
      const txHash = await this.executeOnChainPayment(amountUSD, recipient, tokenAddress);

      // Record successful payment
      policyEngine.recordPayment(sessionId, amountUSD);
      sessionManager.recordPayment(sessionId, amountUSD);
      
      auditLogger.logPaymentCompleted(sessionId, taskId, agent, txHash, reason);

      // Generate success receipt
      const receipt = receiptManager.generateReceipt(request, session.policies[0], {
        txHash,
        status: 'completed',
        executionTimeMs: Date.now() - startTime,
        riskLevel: riskAssessment.level,
        riskFactors: riskAssessment.factors,
        humanConfirmed: !requiresApproval,
        previousReceiptId: request.taskContext?.previousTaskId
      });

      return { success: true, taskId, txHash, receipt };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      auditLogger.logPaymentFailed(sessionId, taskId, agent, errorMsg);

      // Retry mechanism (Requirement 3: failure retry)
      if (attempt < maxRetries && this.shouldRetry(errorMsg)) {
        const retryDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await sleep(retryDelay);
        
        const retryRequest: PaymentRequest = {
          ...request,
          retryCount: (request.retryCount || 0) + 1,
          taskContext: {
            ...request.taskContext,
            previousTaskId: taskId
          }
        };
        
        return this.executePayment(retryRequest, attempt + 1);
      }

      // Generate failed receipt
      const receipt = receiptManager.generateReceipt(request, 'failed', {
        status: 'failed',
        executionTimeMs: Date.now() - startTime,
        riskLevel: 'high',
        riskFactors: [`Execution failed: ${errorMsg}`],
        previousReceiptId: request.taskContext?.previousTaskId
      });

      return { success: false, taskId, error: errorMsg, receipt, retryScheduled: attempt < maxRetries };
    }
  }

  private shouldRetry(errorMsg: string): boolean {
    const retryableErrors = [
      'network error',
      'timeout',
      'rate limit',
      'nonce too low',
      'replacement transaction underpriced'
    ];
    return retryableErrors.some(e => errorMsg.toLowerCase().includes(e));
  }

  async executeBatchPayment(requests: PaymentRequest[]): Promise<PaymentResult[]> {
    return Promise.all(requests.map(r => this.executePayment(r)));
  }

  async getBalance(address: string): Promise<bigint> {
    return this.provider.getBalance(address);
  }

  async estimateGas(to: string, value: bigint): Promise<bigint> {
    const estimate = await this.provider.estimateGas({
      to,
      value
    });
    return estimate;
  }

  // Streaming payment support (Bonus D: Native machine payments)
  async createStreamPayment(
    totalAmountUSD: number,
    receiver: string,
    durationSeconds: number,
    intervals: number
  ): Promise<{ streamId: string; perIntervalAmount: bigint; intervalSeconds: number }> {
    const streamId = generateTaskId();
    const perIntervalUSD = totalAmountUSD / intervals;
    const intervalSeconds = Math.floor(durationSeconds / intervals);
    const perIntervalAmount = usdToWei(perIntervalUSD, this.ethPrice);

    return {
      streamId,
      perIntervalAmount,
      intervalSeconds
    };
  }

  async executeStreamPayment(
    streamId: string,
    receiver: string,
    amount: bigint
  ): Promise<string> {
    if (!this.wallet) {
      throw new AppError('WALLET_NOT_CONFIGURED', 'Payment wallet not configured', 500);
    }

    const tx = await this.wallet.sendTransaction({
      to: receiver,
      value: amount
    });
    await tx.wait();
    return tx.hash;
  }

  // Micropayment aggregation (Bonus D)
  private micropaymentBuffer: Map<string, { amount: bigint; count: number; lastPayment: number }> = new Map();
  private micropaymentThreshold: bigint = usdToWei(1, 3000); // $1 threshold

  async queueMicropayment(
    sessionId: string,
    receiver: string,
    amountUSD: number
  ): Promise<{ queued: boolean; txHash?: string }> {
    const amount = usdToWei(amountUSD, this.ethPrice);
    const key = `${sessionId}_${receiver}`;
    
    const current = this.micropaymentBuffer.get(key) || { 
      amount: 0n, 
      count: 0, 
      lastPayment: Date.now() 
    };
    
    current.amount += amount;
    current.count += 1;
    
    // Check if threshold reached or time-based flush (5 min)
    const shouldFlush = current.amount >= this.micropaymentThreshold || 
                       (Date.now() - current.lastPayment) > 300000;
    
    if (shouldFlush && this.wallet) {
      const tx = await this.wallet.sendTransaction({
        to: receiver,
        value: current.amount
      });
      await tx.wait();
      this.micropaymentBuffer.delete(key);
      return { queued: false, txHash: tx.hash };
    }
    
    this.micropaymentBuffer.set(key, current);
    return { queued: true };
  }

  // x402 protocol support
  async createX402Payment(amountUSD: number, receiver: string): Promise<X402Payment> {
    const chainId = parseInt(process.env.MONAD_CHAIN_ID || '10143');
    const token = '0x0000000000000000000000000000000000000000'; // Native token
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 min deadline

    return {
      amount: usdToWei(amountUSD, this.ethPrice).toString(),
      receiver,
      token,
      chainId,
      deadline
    };
  }

  async verifyX402Payment(payment: X402Payment, signature: string): Promise<boolean> {
    // Verify x402 payment authorization
    const message = ethers.keccak256(
      ethers.solidityPacked(
        ['uint256', 'address', 'address', 'uint256', 'uint256'],
        [payment.amount, payment.receiver, payment.token, payment.chainId, payment.deadline]
      )
    );

    try {
      const recovered = ethers.verifyMessage(message, signature);
      // Check if recovered matches authorized session key
      return true; // Simplified - add proper session key validation
    } catch {
      return false;
    }
  }

  private async executeOnChainPayment(
    amountUSD: number, 
    recipient: string, 
    tokenAddress?: string
  ): Promise<string> {
    if (!this.wallet) {
      throw new AppError('WALLET_NOT_CONFIGURED', 'Payment wallet not configured', 500);
    }

    const amountWei = usdToWei(amountUSD, this.ethPrice);

    if (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') {
      // ERC20 transfer
      const erc20Abi = ['function transfer(address to, uint256 amount) returns (bool)'];
      const token = new ethers.Contract(tokenAddress, erc20Abi, this.wallet);
      const tx = await token.transfer(recipient, amountWei);
      await tx.wait();
      return tx.hash;
    } else {
      // Native token transfer
      const tx = await this.wallet.sendTransaction({
        to: recipient,
        value: amountWei
      });
      await tx.wait();
      return tx.hash;
    }
  }

  async updateEthPrice(): Promise<void> {
    // In production: fetch from Chainlink or CoinGecko
    // For demo: use mock price
    this.ethPrice = 3000;
  }

  getEthPrice(): number {
    return this.ethPrice;
  }
}

export const paymentAdapter = new PaymentAdapter();
export default paymentAdapter;
