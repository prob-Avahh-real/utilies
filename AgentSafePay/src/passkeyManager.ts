/**
 * Passkey/WebAuthn Manager (Bonus C)
 * Implements secure authentication using passkeys/zkLogin
 */

import { randomBytes } from 'crypto';
import { generateTaskId, getTimestamp } from './utils';
import { auditLogger } from './auditLogger';

export interface PasskeyCredential {
  id: string;
  userId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  createdAt: number;
  lastUsedAt: number;
}

export interface PasskeyAuthChallenge {
  challengeId: string;
  challenge: string;
  userId: string;
  expiresAt: number;
}

export interface PasskeyAuthResult {
  success: boolean;
  sessionToken?: string;
  userId?: string;
  error?: string;
}

class PasskeyManager {
  private credentials: Map<string, PasskeyCredential> = new Map();
  private challenges: Map<string, PasskeyAuthChallenge> = new Map();
  private userCredentials: Map<string, string[]> = new Map(); // userId -> credentialIds[]

  // Generate registration challenge for passkey creation
  async generateRegistrationChallenge(userId: string): Promise<{ challengeId: string; challenge: string }> {
    const challengeId = `chal_${generateTaskId().slice(5)}`;
    const challenge = this.generateRandomChallenge();
    
    this.challenges.set(challengeId, {
      challengeId,
      challenge,
      userId,
      expiresAt: getTimestamp() + 300 // 5 minutes
    });

    auditLogger.log({
      eventType: 'SESSION_CREATED',
      actor: userId,
      metadata: { type: 'passkey_challenge', challengeId }
    });

    return { challengeId, challenge };
  }

  // Register a new passkey credential
  async registerPasskey(
    challengeId: string,
    credentialId: string,
    publicKey: string,
    transports: string[] = []
  ): Promise<{ success: boolean; credential?: PasskeyCredential; error?: string }> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return { success: false, error: 'Challenge not found or expired' };
    }

    if (getTimestamp() > challenge.expiresAt) {
      this.challenges.delete(challengeId);
      return { success: false, error: 'Challenge expired' };
    }

    // Check if credential already exists
    if (this.credentials.has(credentialId)) {
      return { success: false, error: 'Credential already registered' };
    }

    const credential: PasskeyCredential = {
      id: credentialId,
      userId: challenge.userId,
      publicKey,
      counter: 0,
      transports,
      createdAt: getTimestamp(),
      lastUsedAt: getTimestamp()
    };

    this.credentials.set(credentialId, credential);

    // Link to user
    const userCreds = this.userCredentials.get(challenge.userId) || [];
    userCreds.push(credentialId);
    this.userCredentials.set(challenge.userId, userCreds);

    // Clean up challenge
    this.challenges.delete(challengeId);

    auditLogger.log({
      eventType: 'SESSION_CREATED',
      actor: challenge.userId,
      metadata: { type: 'passkey_registered', credentialId }
    });

    return { success: true, credential };
  }

  // Generate authentication challenge
  async generateAuthChallenge(credentialId?: string): Promise<{ challengeId: string; challenge: string }> {
    const challengeId = `chal_${generateTaskId().slice(5)}`;
    const challenge = this.generateRandomChallenge();
    
    this.challenges.set(challengeId, {
      challengeId,
      challenge,
      userId: credentialId || 'unknown',
      expiresAt: getTimestamp() + 300
    });

    return { challengeId, challenge };
  }

  // Verify passkey authentication
  async verifyAuthentication(
    credentialId: string,
    challengeId: string,
    signature: string,
    clientDataJSON?: string
  ): Promise<PasskeyAuthResult> {
    const credential = this.credentials.get(credentialId);
    if (!credential) {
      return { success: false, error: 'Credential not found' };
    }

    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return { success: false, error: 'Challenge not found or expired' };
    }

    if (getTimestamp() > challenge.expiresAt) {
      this.challenges.delete(challengeId);
      return { success: false, error: 'Challenge expired' };
    }

    // Verify signature (simplified - in production use proper WebAuthn verification)
    const isValid = this.verifySignature(
      credential.publicKey,
      challenge.challenge,
      signature
    );

    if (!isValid) {
      auditLogger.log({
        eventType: 'POLICY_VIOLATION',
        actor: credential.userId,
        reason: 'Passkey authentication failed - invalid signature',
        metadata: { credentialId }
      });
      return { success: false, error: 'Invalid signature' };
    }

    // Update credential
    credential.counter++;
    credential.lastUsedAt = getTimestamp();
    this.credentials.set(credentialId, credential);

    // Clean up challenge
    this.challenges.delete(challengeId);

    // Generate session token
    const sessionToken = this.generateSessionToken(credential.userId);

    auditLogger.log({
      eventType: 'SESSION_CREATED',
      actor: credential.userId,
      metadata: { type: 'passkey_auth', credentialId, counter: credential.counter }
    });

    return { success: true, sessionToken, userId: credential.userId };
  }

  // Get user's passkeys
  getUserPasskeys(userId: string): PasskeyCredential[] {
    const credentialIds = this.userCredentials.get(userId) || [];
    return credentialIds
      .map(id => this.credentials.get(id))
      .filter((c): c is PasskeyCredential => c !== undefined);
  }

  // Revoke a passkey
  revokePasskey(credentialId: string, reason: string): boolean {
    const credential = this.credentials.get(credentialId);
    if (!credential) return false;

    this.credentials.delete(credentialId);

    const userCreds = this.userCredentials.get(credential.userId) || [];
    const updated = userCreds.filter(id => id !== credentialId);
    this.userCredentials.set(credential.userId, updated);

    auditLogger.log({
      eventType: 'KEY_REVOKED',
      actor: credential.userId,
      reason: `Passkey revoked: ${reason}`,
      metadata: { credentialId }
    });

    return true;
  }

  // zkLogin simulation (for competition demonstration)
  async zkLoginProof(
    jwt: string,
    salt: string
  ): Promise<{ success: boolean; userId?: string; error?: string }> {
    // In production: verify JWT with zk-SNARK proof
    // This is a simulation for demonstration
    try {
      const mockUserId = `zk_${Buffer.from(jwt.slice(0, 20)).toString('hex')}_${salt.slice(0, 8)}`;
      
      auditLogger.log({
        eventType: 'SESSION_CREATED',
        actor: mockUserId,
        metadata: { type: 'zklogin_auth', salt }
      });

      return { success: true, userId: mockUserId };
    } catch {
      return { success: false, error: 'zkLogin verification failed' };
    }
  }

  private generateRandomChallenge(): string {
    return randomBytes(32).toString('base64url');
  }

  private generateSessionToken(userId: string): string {
    const timestamp = getTimestamp();
    const random = generateTaskId().slice(5);
    return `sess_${userId.slice(0, 8)}_${timestamp}_${random}`;
  }

  private verifySignature(publicKey: string, challenge: string, signature: string): boolean {
    // Simplified verification - in production use proper WebAuthn crypto
    // This is a mock for demonstration purposes
    return signature.length > 0 && publicKey.length > 0;
  }

  // Cleanup expired challenges
  cleanupExpiredChallenges(): number {
    const now = getTimestamp();
    let cleaned = 0;
    for (const [id, challenge] of this.challenges) {
      if (challenge.expiresAt < now) {
        this.challenges.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}

export const passkeyManager = new PasskeyManager();
export default passkeyManager;
