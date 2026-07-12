import { ethers } from 'ethers';
import { generateSessionId, getTimestamp, isValidAddress, AppError } from './utils';
import { auditLogger } from './auditLogger';
import policyEngine, { Policy } from './policyEngine';

export interface Session {
  id: string;
  agent: string;
  delegatedKey: string;
  owner: string;
  createdAt: number;
  expiresAt: number;
  policies: string[];
  isActive: boolean;
  totalPayments: number;
  totalVolumeUSD: number;
}

export interface CreateSessionRequest {
  agent: string;
  owner: string;
  expiryHours: number;
  policies?: string[];
}

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private agentSessions: Map<string, string[]> = new Map();

  async createSession(request: CreateSessionRequest): Promise<Session> {
    if (!isValidAddress(request.agent)) {
      throw new AppError('INVALID_AGENT', 'Invalid agent address', 400);
    }
    if (!isValidAddress(request.owner)) {
      throw new AppError('INVALID_OWNER', 'Invalid owner address', 400);
    }

    const sessionId = generateSessionId();
    const now = getTimestamp();
    const expiry = now + request.expiryHours * 3600;

    // Generate delegated key (simplified - in production use MPC/TSS)
    const delegatedKey = this.generateDelegatedKey();

    // Create default policy if none provided
    let policyIds = request.policies || [];
    if (policyIds.length === 0) {
      const defaultPolicy = policyEngine.createDefaultPolicy(request.agent, request.expiryHours);
      policyEngine.registerPolicy(defaultPolicy);
      policyIds = [defaultPolicy.id];
    }

    const session: Session = {
      id: sessionId,
      agent: request.agent,
      delegatedKey,
      owner: request.owner,
      createdAt: now,
      expiresAt: expiry,
      policies: policyIds,
      isActive: true,
      totalPayments: 0,
      totalVolumeUSD: 0
    };

    this.sessions.set(sessionId, session);
    
    const agentSess = this.agentSessions.get(request.agent) || [];
    agentSess.push(sessionId);
    this.agentSessions.set(request.agent, agentSess);

    auditLogger.logSessionCreated(sessionId, request.agent, expiry, policyIds);

    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getAgentSessions(agent: string): Session[] {
    const sessionIds = this.agentSessions.get(agent) || [];
    return sessionIds
      .map(id => this.sessions.get(id))
      .filter((s): s is Session => s !== undefined);
  }

  validateSession(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AppError('SESSION_NOT_FOUND', 'Session not found', 404);
    }
    if (!session.isActive) {
      throw new AppError('SESSION_INACTIVE', 'Session has been revoked', 403);
    }
    if (getTimestamp() > session.expiresAt) {
      throw new AppError('SESSION_EXPIRED', 'Session has expired', 403);
    }
    return session;
  }

  revokeSession(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      auditLogger.logKeyRevoked(sessionId, session.agent, reason);
    }
  }

  recordPayment(sessionId: string, amountUSD: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.totalPayments += 1;
      session.totalVolumeUSD += amountUSD;
    }
  }

  getSessionPolicies(sessionId: string): Policy[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    
    return session.policies
      .map(id => policyEngine.getPolicy(id))
      .filter((p): p is Policy => p !== undefined);
  }

  private generateDelegatedKey(): string {
    // In production: integrate with MPC/TSS service (e.g., Toro, Coinbase MPC)
    // For demo: generate a random address
    const randomWallet = ethers.Wallet.createRandom();
    return randomWallet.address;
  }

  cleanupExpiredSessions(): number {
    const now = getTimestamp();
    let cleaned = 0;
    for (const [id, session] of this.sessions) {
      if (session.expiresAt < now && session.isActive) {
        session.isActive = false;
        cleaned++;
      }
    }
    return cleaned;
  }

  // Key rotation (Requirement 5: Recovery and permission management)
  async rotateSessionKey(sessionId: string, reason: string): Promise<Session> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AppError('SESSION_NOT_FOUND', 'Session not found', 404);
    }

    if (!session.isActive) {
      throw new AppError('SESSION_INACTIVE', 'Session is not active', 403);
    }

    // Generate new delegated key
    const newKey = this.generateDelegatedKey();
    const oldKey = session.delegatedKey;
    
    // Update session with new key
    session.delegatedKey = newKey;
    
    // Log key rotation
    auditLogger.log({
      eventType: 'KEY_REVOKED',
      sessionId,
      actor: session.agent,
      reason: `Key rotated: ${reason}. Old key: ${oldKey}`,
      metadata: { oldKey, newKey, rotationReason: reason }
    });

    return session;
  }

  // Extend session expiry
  extendSession(sessionId: string, additionalHours: number): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AppError('SESSION_NOT_FOUND', 'Session not found', 404);
    }

    session.expiresAt += additionalHours * 3600;
    return session;
  }
}

export const sessionManager = new SessionManager();
export default sessionManager;
