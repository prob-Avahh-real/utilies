#!/usr/bin/env ts-node
/**
 * Payment Flow Tests
 * Tests end-to-end payment processing
 */

import sessionManager from '../src/sessionManager';
import paymentAdapter from '../src/paymentAdapter';
import policyEngine, { Policy } from '../src/policyEngine';
import { getTimestamp, isValidAddress, generateTaskId } from '../src/utils';

async function runTests() {
  console.log('💳 Testing Payment Flow\n');
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => Promise<boolean>) {
    return fn()
      .then(result => {
        if (result) {
          console.log(`  ✅ ${name}`);
          passed++;
        } else {
          console.log(`  ❌ ${name}`);
          failed++;
        }
      })
      .catch(e => {
        console.log(`  ❌ ${name} - ${e}`);
        failed++;
      });
  }

  // Setup
  const testAgent = '0x' + 'a'.repeat(40);
  const testOwner = '0x' + 'b'.repeat(40);
  const testRecipient = '0x' + 'c'.repeat(40);

  // Test 1: Session creation
  await test('Session creation should work', async () => {
    const session = await sessionManager.createSession({
      agent: testAgent,
      owner: testOwner,
      expiryHours: 1
    });
    return session.id.startsWith('sess_') && session.isActive === true;
  });

  // Test 2: Session retrieval
  const session = await sessionManager.createSession({
    agent: testAgent,
    owner: testOwner,
    expiryHours: 1
  });

  await test('Session retrieval should work', async () => {
    const retrieved = sessionManager.getSession(session.id);
    return retrieved !== undefined && retrieved.id === session.id;
  });

  // Test 3: Agent sessions listing
  await test('Agent sessions listing should work', async () => {
    const sessions = sessionManager.getAgentSessions(testAgent);
    return sessions.length >= 2 && sessions.every(s => s.agent === testAgent);
  });

  // Test 4: Address validation
  await test('Valid address should pass validation', async () => {
    return isValidAddress('0x1234567890123456789012345678901234567890');
  });

  // Test 5: Invalid address should fail
  await test('Invalid address should fail validation', async () => {
    return !isValidAddress('invalid-address');
  });

  // Test 6: Task ID generation
  await test('Task ID generation should work', async () => {
    const id1 = generateTaskId();
    const id2 = generateTaskId();
    return id1.startsWith('task_') && id2.startsWith('task_') && id1 !== id2;
  });

  // Test 7: Session validation
  await test('Session validation should pass for active session', async () => {
    try {
      sessionManager.validateSession(session.id);
      return true;
    } catch {
      return false;
    }
  });

  // Test 8: Payment with valid session (mocked - no wallet)
  await test('Payment policy validation should work', async () => {
    const request = {
      sessionId: session.id,
      amountUSD: 10,
      recipient: testRecipient,
      agent: testAgent
    };
    
    const policyCheck = policyEngine.validatePayment(request, session.policies);
    return policyCheck.approved === true;
  });

  // Test 9: Payment exceeding policy limit
  await test('Payment exceeding limit should be rejected', async () => {
    const request = {
      sessionId: session.id,
      amountUSD: 10000, // Way over limit
      recipient: testRecipient,
      agent: testAgent
    };
    
    const policyCheck = policyEngine.validatePayment(request, session.policies);
    return policyCheck.approved === false;
  });

  // Test 10: Session revocation
  await test('Session revocation should work', async () => {
    const revokeSession = await sessionManager.createSession({
      agent: '0x' + 'd'.repeat(40),
      owner: testOwner,
      expiryHours: 1
    });
    
    sessionManager.revokeSession(revokeSession.id, 'Test revocation');
    const retrieved = sessionManager.getSession(revokeSession.id);
    return retrieved !== undefined && retrieved.isActive === false;
  });

  // Test 11: x402 payment creation
  await test('x402 payment creation should work', async () => {
    const x402 = await paymentAdapter.createX402Payment(25, testRecipient);
    return x402.amount !== undefined && 
           x402.receiver === testRecipient &&
           x402.deadline > getTimestamp();
  });

  // Test 12: Policy registration
  await test('Policy registration should work', async () => {
    const policy: Policy = {
      id: 'custom-policy',
      name: 'Custom Policy',
      maxSinglePaymentUSD: 50,
      maxDailyPaymentUSD: 200,
      allowedRecipients: [testRecipient],
      allowedTokenAddresses: [],
      requireApprovalAboveUSD: 25,
      expiresAt: getTimestamp() + 3600
    };
    policyEngine.registerPolicy(policy);
    const retrieved = policyEngine.getPolicy('custom-policy');
    return retrieved !== undefined && retrieved.name === 'Custom Policy';
  });

  // Test 13: Session with custom policy
  await test('Session with custom policy should use it', async () => {
    const customSession = await sessionManager.createSession({
      agent: '0x' + 'e'.repeat(40),
      owner: testOwner,
      expiryHours: 1,
      policies: ['custom-policy']
    });
    return customSession.policies.includes('custom-policy');
  });

  // Test 14: Daily spend update
  await test('Daily spend should be recorded', async () => {
    const spendSession = await sessionManager.createSession({
      agent: '0x' + 'f'.repeat(40),
      owner: testOwner,
      expiryHours: 1
    });
    
    policyEngine.recordPayment(spendSession.id, 15);
    const spend = policyEngine.getDailySpend(spendSession.id);
    return spend.totalUSD === 15;
  });

  // Test 15: Timestamp utilities
  await test('Timestamp utilities should work', async () => {
    const ts = getTimestamp();
    return ts > 1700000000 && ts < 2000000000; // Rough check for reasonable timestamp
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
