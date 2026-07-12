# AgentSafePay - Competition Submission

## Repository
https://github.com/prob-Avahh-real/AgentSafePay

---

## Competition Requirements Checklist

### Mandatory Requirements (5/5) ✅

| Requirement | Implementation | File/Module |
|-------------|---------------|-------------|
| **1. 去中心化 (Decentralization)** | Session keys with non-custodial design, user retains control, revocable permissions | `sessionManager.ts` |
| **2. 安全配置 (Security Config)** | Payment limits (single/daily), whitelist, approval thresholds, emergency pause | `policyEngine.ts` |
| **3. Agent原生 (Agent-Native)** | ✅ Payment `reason` field, task context, retry mechanism with exponential backoff | `server.ts`, `paymentAdapter.ts` |
| **4. 可审计 (Auditability)** | Complete audit trail with timestamp, actor, action, reason, risk assessment | `auditLogger.ts` |
| **5. 恢复与权限 (Recovery & Permissions)** | ✅ Key rotation API, session extension, multi-agent support | `sessionManager.ts` |

### Bonus Features (6/6) ✅

| Bonus | Status | Implementation |
|-------|--------|----------------|
| **A. Session Key** | ✅ | 24h expiry, delegated ephemeral keys, signature-based authorization |
| **B. Policy Engine** | ✅ | Limits enforcement, approval thresholds, whitelist validation |
| **C. Passkey** | ✅ | WebAuthn-style passkeys, challenge-response auth, zkLogin simulation |
| **D. 原生支付 (Native Payments)** | ✅ | Streaming payments, micropayment aggregation, x402 protocol support |
| **E. 人机协同 (Human-AI Collaboration)** | ✅ | Threshold-based human approval, structured receipts for audit |
| **F. 审计收据 (Audit Receipts)** | ✅ | Structured receipts with risk levels, session linkage, compliance format |

---

## Technical Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **Framework**: Express.js
- **Blockchain**: Monad Testnet (Chain ID: 10143)
- **RPC**: https://testnet-rpc.monad.xyz
- **Wallet**: Ethers.js v6
- **Logging**: Winston
- **Passkeys**: Node.js crypto (WebAuthn simulation)

---

## Project Structure

```
AgentSafePay/
├── src/
│   ├── server.ts           # Express API (23 endpoints)
│   ├── sessionManager.ts   # Session keys & key rotation
│   ├── paymentAdapter.ts   # Payment execution & streaming
│   ├── policyEngine.ts     # Policy validation & enforcement
│   ├── passkeyManager.ts   # Passkey & zkLogin auth (Bonus C)
│   ├── receiptManager.ts   # Structured receipts (Bonus F)
│   ├── auditLogger.ts      # Audit trail logging
│   └── utils.ts            # Utility functions
├── scripts/
│   └── deploySessionKey.ts # Contract deployment
├── test/
│   ├── testPayment.ts      # Payment flow tests (15 cases)
│   └── testPolicy.ts       # Policy engine tests (10 cases)
├── .env                    # Environment configuration
├── package.json
├── tsconfig.json
└── README.md
```

---

## API Endpoints (23 Total)

### Core Endpoints
- `POST /api/sessions` - Create session
- `GET /api/sessions/:id` - Get session
- `POST /api/sessions/:id/rotate` - Key rotation (Req 5)
- `POST /api/sessions/:id/extend` - Extend session
- `GET /api/sessions/:id/spend` - Daily spending

### Payments
- `POST /api/payments` - Execute with reason & task context (Req 3)
- `POST /api/payments/batch` - Batch payments
- `POST /api/payments/stream` - Streaming payments (Bonus D)
- `POST /api/payments/micropay` - Micropayment queue (Bonus D)

### Passkeys (Bonus C)
- `POST /api/passkeys/register/challenge` - Generate challenge
- `POST /api/passkeys/register` - Register credential
- `POST /api/passkeys/auth/challenge` - Auth challenge
- `POST /api/passkeys/auth` - Authenticate
- `GET /api/users/:userId/passkeys` - List passkeys
- `POST /api/passkeys/:id/revoke` - Revoke passkey
- `POST /api/auth/zklogin` - zkLogin simulation

### Policies & Receipts
- `POST /api/policies` - Create policy (Bonus B)
- `GET /api/receipts/:id` - Get receipt by ID or taskId (Bonus F)
- `GET /api/sessions/:id/receipts` - Session receipts
- `GET /api/health` - Health check

### x402 Protocol
- `POST /api/x402/payment` - x402 protocol support (Bonus D)

---

## Monad Testnet Integration

```typescript
// Configuration in .env
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
CHAIN_ID=10143
PORT=10143
```

**Wallet Address**: `0xCDDD79B84948F39721c9A285811430C3a4869a52`

**Features**:
- Direct Monad testnet RPC integration
- On-chain transaction submission
- Chain ID 10143 compliance
- Wallet funding via https://testnet.monad.xyz/faucet

---

## Agent-Native Features (Requirement 3)

### Payment Reason
```bash
curl -X POST http://localhost:10143/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess_...",
    "amountUSD": 10,
    "recipient": "0x...",
    "reason": "Paying for compute resources",
    "taskContext": {
      "taskType": "inference",
      "priority": "high",
      "previousTaskId": "task_..."
    }
  }'
```

### Retry Mechanism
- 3 retry attempts with exponential backoff
- Configurable via `retryCount` field
- Audit logging of retry events

---

## Key Rotation (Requirement 5)

```bash
# Rotate session key
POST /api/sessions/:id/rotate
Body: { "reason": "Security rotation" }

Response:
{
  "success": true,
  "newKey": "0x...",
  "oldKey": "0x...",
  "expiresAt": 1776068178
}
```

---

## Passkey Implementation (Bonus C)

### Features
- **Registration**: Challenge-response flow
- **Authentication**: WebAuthn-style verification
- **Management**: List, revoke credentials
- **zkLogin**: Zero-knowledge proof simulation

### Flow
1. Generate challenge → `POST /api/passkeys/register/challenge`
2. Client creates credential (frontend)
3. Register with server → `POST /api/passkeys/register`
4. Future auth via `POST /api/passkeys/auth`

---

## Structured Receipts (Bonus F)

```json
{
  "receiptId": "rcpt_abc123",
  "taskId": "task_def456",
  "sessionId": "sess_ghi789",
  "version": "1.0",
  "metadata": {
    "taskType": "inference",
    "paymentReason": "Compute resources"
  },
  "risk": {
    "level": "low",
    "score": 15,
    "factors": ["amount"]
  },
  "compliance": {
    "humanApproved": false,
    "approvalReason": "Auto-approved",
    "auditTrail": [...]
  },
  "signatures": {
    "agent": "0x...",
    "delegatedKey": "0x...",
    "timestamp": "2026-04-12T10:30:00Z"
  }
}
```

---

## Testing

```bash
# Run all tests
npm test

# Individual test suites
ts-node test/testPayment.ts  # 15 payment cases
ts-node test/testPolicy.ts   # 10 policy cases
```

**Test Coverage**:
- Session lifecycle
- Policy enforcement
- Payment execution
- Retry mechanisms
- Streaming payments
- Micropayment aggregation
- Receipt generation
- x402 protocol
- Passkey flows
- zkLogin simulation

---

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Start server
npm run start

# Or dev mode
npm run dev

# Verify running
curl http://localhost:10143/health
```

---

## Competition Highlights

### Innovation Points
1. **Agent-Native Design**: First-class support for payment reasons and task context
2. **Streaming Payments**: Native machine-to-machine streaming support
3. **Passkey + zkLogin**: Modern authentication without passwords
4. **Structured Receipts**: Compliance-ready audit format with risk assessment
5. **Retry Resilience**: Automatic failure recovery for agent operations

### Security Features
- Non-custodial session keys
- Policy-based spending limits
- Human approval thresholds
- Full audit trail
- Key rotation capability
- Passkey authentication

---

## Submission Checklist

- [x] Repository: https://github.com/prob-Avahh-real/AgentSafePay
- [x] All 5 mandatory requirements implemented
- [x] All 6 bonus features implemented
- [x] Monad testnet integration (Chain 10143)
- [x] Comprehensive API documentation
- [x] Test suite included
- [x] README with setup instructions
- [x] Code committed and pushed

---

**Submitted by**: prob-Avahh-real  
**Date**: April 12, 2026
