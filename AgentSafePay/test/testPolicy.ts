#!/usr/bin/env ts-node
/**
 * Policy Engine Tests
 * Validates payment policies and constraints
 */

import policyEngine, { Policy, PaymentRequest } from '../src/policyEngine';
import { getTimestamp } from '../src/utils';

async function runTests() {
  console.log('🧪 Testing Policy Engine\n');
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => boolean) {
    try {
      const result = fn();
      if (result) {
        console.log(`  ✅ ${name}`);
        passed++;
      } else {
        console.log(`  ❌ ${name}`);
        failed++;
      }
    } catch (e) {
      console.log(`  ❌ ${name} - ${e}`);
      failed++;
    }
  }

  // Setup test policy
  const testPolicy: Policy = {
    id: 'test-policy-1',
    name: 'Test Policy',
    maxSinglePaymentUSD: 100,
    maxDailyPaymentUSD: 500,
    allowedRecipients: ['0x1234567890123456789012345678901234567890'],
    allowedTokenAddresses: [],
    requireApprovalAboveUSD: 50,
    expiresAt: getTimestamp() + 86400
  };
  policyEngine.registerPolicy(testPolicy);

  // Test 1: Valid payment within limits
  test('Payment within single limit should pass', () => {
    const request: PaymentRequest = {
      amountUSD: 50,
      recipient: '0x1234567890123456789012345678901234567890',
      sessionId: 'test-session',
      agent: 'test-agent'
    };
    const result = policyEngine.validatePayment(request, ['test-policy-1']);
    return result.approved === true;
  });

  // Test 2: Payment exceeding single limit
  test('Payment exceeding single limit should fail', () => {
    const request: PaymentRequest = {
      amountUSD: 150,
      recipient: '0x1234567890123456789012345678901234567890',
      sessionId: 'test-session',
      agent: 'test-agent'
    };
    const result = policyEngine.validatePayment(request, ['test-policy-1']);
    return result.approved === false;
  });

  // Test 3: Unauthorized recipient
  test('Payment to unauthorized recipient should fail', () => {
    const request: PaymentRequest = {
      amountUSD: 10,
      recipient: '0x0000000000000000000000000000000000000000',
      sessionId: 'test-session',
      agent: 'test-agent'
    };
    const result = policyEngine.validatePayment(request, ['test-policy-1']);
    return result.approved === false;
  });

  // Test 4: Daily spend tracking
  test('Daily spend tracking should work', () => {
    policyEngine.recordPayment('test-session', 30);
    const spend = policyEngine.getDailySpend('test-session');
    return spend.totalUSD === 30;
  });

  // Test 5: Daily limit enforcement
  test('Daily limit should be enforced', () => {
    // First use up daily limit
    policyEngine.recordPayment('daily-test', 450);
    
    const request: PaymentRequest = {
      amountUSD: 100,
      recipient: '0x1234567890123456789012345678901234567890',
      sessionId: 'daily-test',
      agent: 'test-agent'
    };
    const result = policyEngine.validatePayment(request, ['test-policy-1']);
    return result.approved === false; // 450 + 100 > 500
  });

  // Test 6: Approval threshold check
  test('Large payments should require approval', () => {
    const needsApproval = policyEngine.requiresApproval(75, ['test-policy-1']);
    return needsApproval === true;
  });

  // Test 7: Small payments shouldn't require approval
  test('Small payments should not require approval', () => {
    const needsApproval = policyEngine.requiresApproval(25, ['test-policy-1']);
    return needsApproval === false;
  });

  // Test 8: Non-existent policy
  test('Non-existent policy should fail validation', () => {
    const request: PaymentRequest = {
      amountUSD: 10,
      recipient: '0x1234567890123456789012345678901234567890',
      sessionId: 'test-session',
      agent: 'test-agent'
    };
    const result = policyEngine.validatePayment(request, ['non-existent']);
    return result.approved === false;
  });

  // Test 9: Policy retrieval
  test('Policy retrieval should work', () => {
    const policy = policyEngine.getPolicy('test-policy-1');
    return policy !== undefined && policy.name === 'Test Policy';
  });

  // Test 10: Expired policy
  test('Expired policy should fail validation', () => {
    const expiredPolicy: Policy = {
      id: 'expired-policy',
      name: 'Expired',
      maxSinglePaymentUSD: 1000,
      maxDailyPaymentUSD: 10000,
      allowedRecipients: [],
      allowedTokenAddresses: [],
      requireApprovalAboveUSD: 100,
      expiresAt: getTimestamp() - 3600 // Expired 1 hour ago
    };
    policyEngine.registerPolicy(expiredPolicy);

    const request: PaymentRequest = {
      amountUSD: 10,
      recipient: '0x1234567890123456789012345678901234567890',
      sessionId: 'test-session',
      agent: 'test-agent'
    };
    const result = policyEngine.validatePayment(request, ['expired-policy']);
    return result.approved === false;
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
