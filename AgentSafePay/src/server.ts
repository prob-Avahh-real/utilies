import express from 'express';
import dotenv from 'dotenv';
import sessionManager from './sessionManager';
import paymentAdapter from './paymentAdapter';
import policyEngine, { Policy } from './policyEngine';
import { auditLogger } from './auditLogger';
import receiptManager from './receiptManager';
import passkeyManager from './passkeyManager';
import { AppError, generateTaskId, isValidAddress } from './utils';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create session
app.post('/api/sessions', async (req, res, next) => {
  try {
    const { agent, owner, expiryHours = 24, policies } = req.body;

    if (!agent || !owner) {
      throw new AppError('MISSING_PARAMS', 'agent and owner are required', 400);
    }

    const session = await sessionManager.createSession({
      agent,
      owner,
      expiryHours,
      policies
    });

    res.status(201).json({
      success: true,
      session: {
        id: session.id,
        agent: session.agent,
        delegatedKey: session.delegatedKey,
        expiresAt: session.expiresAt,
        policies: session.policies
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get session
app.get('/api/sessions/:sessionId', (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      throw new AppError('SESSION_NOT_FOUND', 'Session not found', 404);
    }

    res.json({ success: true, session });
  } catch (error) {
    next(error);
  }
});

// Revoke session
app.post('/api/sessions/:sessionId/revoke', (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { reason = 'Manual revocation' } = req.body;

    sessionManager.revokeSession(sessionId, reason);
    res.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    next(error);
  }
});

// Create policy
app.post('/api/policies', (req, res, next) => {
  try {
    const policy: Policy = {
      id: `policy_${generateTaskId()}`,
      ...req.body,
      expiresAt: req.body.expiresAt || Math.floor(Date.now() / 1000) + 86400
    };

    policyEngine.registerPolicy(policy);
    res.status(201).json({ success: true, policy });
  } catch (error) {
    next(error);
  }
});

// Execute payment
app.post('/api/payments', async (req, res, next) => {
  try {
    const { sessionId, amountUSD, recipient, tokenAddress, reason, taskContext } = req.body;

    if (!sessionId || !amountUSD || !recipient) {
      throw new AppError('MISSING_PARAMS', 'sessionId, amountUSD, and recipient are required', 400);
    }

    if (!isValidAddress(recipient)) {
      throw new AppError('INVALID_ADDRESS', 'Invalid recipient address', 400);
    }

    const result = await paymentAdapter.executePayment({
      sessionId,
      amountUSD,
      recipient,
      tokenAddress,
      reason,
      taskContext,
      agent: 'api' // Will be resolved from session
    });

    if (result.success) {
      res.json({
        success: true,
        taskId: result.taskId,
        txHash: result.txHash
      });
    } else {
      res.status(400).json({
        success: false,
        taskId: result.taskId,
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
});

// Batch payments
app.post('/api/payments/batch', async (req, res, next) => {
  try {
    const { payments } = req.body;

    if (!Array.isArray(payments) || payments.length === 0) {
      throw new AppError('INVALID_BATCH', 'payments array required', 400);
    }

    const results = await paymentAdapter.executeBatchPayment(payments);
    res.json({ success: true, results });
  } catch (error) {
    next(error);
  }
});

// Get agent sessions
app.get('/api/agents/:agent/sessions', (req, res, next) => {
  try {
    const { agent } = req.params;
    const sessions = sessionManager.getAgentSessions(agent);
    res.json({ success: true, sessions });
  } catch (error) {
    next(error);
  }
});

// Get session daily spend
app.get('/api/sessions/:sessionId/spend', (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const spend = policyEngine.getDailySpend(sessionId);
    res.json({ success: true, spend });
  } catch (error) {
    next(error);
  }
});

// x402 payment endpoint
app.post('/api/x402/payment', async (req, res, next) => {
  try {
    const { amountUSD, receiver } = req.body;
    
    const x402Payment = await paymentAdapter.createX402Payment(amountUSD, receiver);
    res.json({ success: true, x402: x402Payment });
  } catch (error) {
    next(error);
  }
});

// Key rotation (Requirement 5)
app.post('/api/sessions/:sessionId/rotate', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { reason = 'Security rotation' } = req.body;

    const session = await sessionManager.rotateSessionKey(sessionId, reason);
    res.json({ 
      success: true, 
      message: 'Session key rotated',
      session: {
        id: session.id,
        delegatedKey: session.delegatedKey,
        expiresAt: session.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// Extend session
app.post('/api/sessions/:sessionId/extend', (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { additionalHours = 24 } = req.body;

    const session = sessionManager.extendSession(sessionId, additionalHours);
    res.json({ 
      success: true, 
      message: 'Session extended',
      session: {
        id: session.id,
        expiresAt: session.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// Streaming payments (Bonus D)
app.post('/api/payments/stream', async (req, res, next) => {
  try {
    const { totalAmountUSD, receiver, durationSeconds, intervals } = req.body;

    const stream = await paymentAdapter.createStreamPayment(
      totalAmountUSD,
      receiver,
      durationSeconds,
      intervals
    );

    res.json({ 
      success: true, 
      stream: {
        streamId: stream.streamId,
        perIntervalAmount: stream.perIntervalAmount.toString(),
        intervalSeconds: stream.intervalSeconds,
        totalIntervals: intervals,
        totalAmountUSD
      }
    });
  } catch (error) {
    next(error);
  }
});

// Micropayment queue (Bonus D)
app.post('/api/payments/micropay', async (req, res, next) => {
  try {
    const { sessionId, receiver, amountUSD } = req.body;

    const result = await paymentAdapter.queueMicropayment(sessionId, receiver, amountUSD);

    res.json({ 
      success: true, 
      queued: result.queued,
      txHash: result.txHash,
      message: result.queued ? 'Payment queued for aggregation' : 'Payment executed immediately'
    });
  } catch (error) {
    next(error);
  }
});

// Get receipt (Requirement F) - supports both receiptId and taskId
app.get('/api/receipts/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Try receiptId first, then taskId
    let receipt = receiptManager.getReceipt(id);
    if (!receipt) {
      receipt = receiptManager.getReceiptByTaskId(id);
    }

    if (!receipt) {
      throw new AppError('RECEIPT_NOT_FOUND', 'Receipt not found', 404);
    }

    res.json({ 
      success: true, 
      receipt: receiptManager.formatStructuredReceipt(receipt)
    });
  } catch (error) {
    next(error);
  }
});

// Get session receipts
app.get('/api/sessions/:sessionId/receipts', (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const receipts = receiptManager.getSessionReceipts(sessionId);

    res.json({ 
      success: true, 
      receipts: receipts.map(r => receiptManager.formatStructuredReceipt(r))
    });
  } catch (error) {
    next(error);
  }
});

// Passkey endpoints (Bonus C)
// Register new passkey
app.post('/api/passkeys/register/challenge', async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      throw new AppError('MISSING_PARAMS', 'userId required', 400);
    }

    const { challengeId, challenge } = await passkeyManager.generateRegistrationChallenge(userId);
    res.json({ success: true, challengeId, challenge });
  } catch (error) {
    next(error);
  }
});

app.post('/api/passkeys/register', async (req, res, next) => {
  try {
    const { challengeId, credentialId, publicKey, transports } = req.body;
    
    const result = await passkeyManager.registerPasskey(
      challengeId,
      credentialId,
      publicKey,
      transports
    );

    if (result.success) {
      res.json({ success: true, credential: result.credential });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    next(error);
  }
});

// Authenticate with passkey
app.post('/api/passkeys/auth/challenge', async (req, res, next) => {
  try {
    const { credentialId } = req.body;
    const { challengeId, challenge } = await passkeyManager.generateAuthChallenge(credentialId);
    res.json({ success: true, challengeId, challenge });
  } catch (error) {
    next(error);
  }
});

app.post('/api/passkeys/auth', async (req, res, next) => {
  try {
    const { credentialId, challengeId, signature, clientDataJSON } = req.body;
    
    const result = await passkeyManager.verifyAuthentication(
      credentialId,
      challengeId,
      signature,
      clientDataJSON
    );

    if (result.success) {
      res.json({ 
        success: true, 
        sessionToken: result.sessionToken,
        userId: result.userId 
      });
    } else {
      res.status(401).json({ success: false, error: result.error });
    }
  } catch (error) {
    next(error);
  }
});

// Get user's passkeys
app.get('/api/users/:userId/passkeys', (req, res, next) => {
  try {
    const { userId } = req.params;
    const passkeys = passkeyManager.getUserPasskeys(userId);
    res.json({ success: true, passkeys });
  } catch (error) {
    next(error);
  }
});

// Revoke passkey
app.post('/api/passkeys/:credentialId/revoke', (req, res, next) => {
  try {
    const { credentialId } = req.params;
    const { reason = 'User requested' } = req.body;
    
    const success = passkeyManager.revokePasskey(credentialId, reason);
    if (success) {
      res.json({ success: true, message: 'Passkey revoked' });
    } else {
      throw new AppError('NOT_FOUND', 'Passkey not found', 404);
    }
  } catch (error) {
    next(error);
  }
});

// zkLogin endpoint (Bonus C)
app.post('/api/auth/zklogin', async (req, res, next) => {
  try {
    const { jwt, salt } = req.body;
    
    if (!jwt || !salt) {
      throw new AppError('MISSING_PARAMS', 'jwt and salt required', 400);
    }

    const result = await passkeyManager.zkLoginProof(jwt, salt);
    
    if (result.success) {
      res.json({ 
        success: true, 
        userId: result.userId,
        method: 'zkLogin'
      });
    } else {
      res.status(401).json({ success: false, error: result.error });
    }
  } catch (error) {
    next(error);
  }
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message
    });
  } else {
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    });
  }
});

app.listen(PORT, () => {
  console.log(`AgentSafePay API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Monad RPC: ${process.env.MONAD_RPC_URL}`);
});

export default app;
