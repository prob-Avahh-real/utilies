# AgentSafePay

Secure agent payment system with session keys, policy enforcement, and Monad testnet integration.

## Overview

AgentSafePay enables AI agents to make secure, policy-constrained payments on behalf of users. It provides:

- **Session Key Management**: Delegated keys with time-bound permissions
- **Policy Engine**: Payment limits, allowed recipients, approval thresholds
- **Payment Adapters**: MPP and x402 protocol support
- **Audit Logging**: Complete transaction history
- **Monad Testnet**: Fast, low-cost settlement

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   AI Agent  │────▶│ Session Key  │────▶│   Policy    │
└─────────────┘     └──────────────┘     │   Engine    │
                                         └──────┬──────┘
                                                │
┌─────────────┐     ┌──────────────┐     ┌──────▼──────┐
│   Audit     │◀────│  Payment     │◀────│   Monad     │
│    Log      │     │   Adapter    │     │  Testnet    │
└─────────────┘     └──────────────┘     └─────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Edit `.env` with your credentials:

```env
PRIVATE_KEY=your_testnet_private_key
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MAX_DAILY_PAYMENT_USD=1000
MAX_SINGLE_PAYMENT_USD=100
```

### 3. Start the Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

## API Reference

### Sessions

**Create Session**
```bash
POST /api/sessions
{
  "agent": "0xAgentAddress",
  "owner": "0xOwnerAddress",
  "expiryHours": 24
}
```

**Get Session**
```bash
GET /api/sessions/:sessionId
```

**Revoke Session**
```bash
POST /api/sessions/:sessionId/revoke
{
  "reason": "Security concern"
}
```

### Payments

**Execute Payment**
```bash
POST /api/payments
{
  "sessionId": "sess_...",
  "amountUSD": 50,
  "recipient": "0x...",
  "tokenAddress": "0x..." // Optional, defaults to native token
}
```

**Batch Payments**
```bash
POST /api/payments/batch
{
  "payments": [
    { "sessionId": "...", "amountUSD": 10, "recipient": "0x..." },
    { "sessionId": "...", "amountUSD": 20, "recipient": "0x..." }
  ]
}
```

**x402 Payment**
```bash
POST /api/x402/payment
{
  "amountUSD": 25,
  "receiver": "0x..."
}
```

### Policies

**Create Policy**
```bash
POST /api/policies
{
  "name": "Conservative Policy",
  "maxSinglePaymentUSD": 50,
  "maxDailyPaymentUSD": 200,
  "allowedRecipients": ["0x..."],
  "requireApprovalAboveUSD": 25
}
```

**Get Daily Spend**
```bash
GET /api/sessions/:sessionId/spend
```

## Agent Integration Example

```typescript
// Initialize session
const session = await fetch('http://localhost:3000/api/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent: '0xAIAgentAddress',
    owner: '0xUserAddress',
    expiryHours: 24
  })
}).then(r => r.json());

// Execute payment
const payment = await fetch('http://localhost:3000/api/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: session.session.id,
    amountUSD: 25,
    recipient: '0xVendorAddress'
  })
}).then(r => r.json());

if (payment.success) {
  console.log(`Payment sent! Tx: ${payment.txHash}`);
}
```

## Monad Testnet Deployment

### 1. Fund Your Wallet

Get test MON from the [Monad Faucet](https://testnet.monad.xyz/faucet).

### 2. Deploy Session Key Contract

```bash
npm run deploy:session -- 0xAgentAddress 24
```

This deploys a session key contract with:
- Owner: your wallet
- Agent: specified agent address
- Expiry: specified hours from now

### 3. Verify on Explorer

View your contract at:
```
https://testnet.monadexplorer.com/address/0xYourContractAddress
```

## Testing

Run all tests:
```bash
npm test
```

Run policy tests only:
```bash
ts-node test/testPolicy.ts
```

Run payment tests only:
```bash
ts-node test/testPayment.ts
```

## Security Features

- **Session Keys**: Time-bound, revocable delegated keys
- **Policy Engine**: Configurable spending limits and recipient allowlists
- **Approval Thresholds**: Human-in-the-loop for large payments
- **Audit Logging**: Complete transaction history
- **Daily Limits**: Aggregate spending controls

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MONAD_RPC_URL` | - | Monad testnet RPC endpoint |
| `PRIVATE_KEY` | - | Deployer wallet private key |
| `MAX_DAILY_PAYMENT_USD` | 1000 | Maximum daily spend per session |
| `MAX_SINGLE_PAYMENT_USD` | 100 | Maximum single payment amount |
| `SESSION_KEY_EXPIRY_HOURS` | 24 | Default session validity period |
| `PORT` | 3000 | API server port |

## Project Structure

```
AgentSafePay/
├── src/
│   ├── server.ts           # API server
│   ├── sessionManager.ts   # Session key management
│   ├── policyEngine.ts     # Payment policies
│   ├── paymentAdapter.ts   # MPP/x402 adapters
│   ├── auditLogger.ts      # Audit logging
│   └── utils.ts            # Utilities
├── scripts/
│   └── deploySessionKey.ts # Deployment script
├── test/
│   ├── testPayment.ts      # Payment tests
│   └── testPolicy.ts       # Policy tests
├── .env                    # Configuration
└── package.json
```

## License

MIT
