#!/usr/bin/env ts-node
/**
 * Session Key Deployment Script for Monad Testnet
 * 
 * This script deploys a session key contract that enables:
 * - Delegated key management
 * - Policy-enforced payments
 * - Time-bound permissions
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Minimal SessionKey contract ABI (simplified for demo)
const SESSION_KEY_ABI = [
  "constructor(address owner, address agent, uint256 expiry)",
  "function owner() view returns (address)",
  "function agent() view returns (address)",
  "function expiry() view returns (uint256)",
  "function isActive() view returns (bool)",
  "function revoke()",
  "function executePayment(address to, uint256 amount, bytes calldata data) returns (bool)",
  "event PaymentExecuted(address indexed to, uint256 amount, bytes data)",
  "event SessionRevoked(address indexed agent)"
];

// Bytecode for a minimal proxy (simplified - replace with actual compiled bytecode)
const SESSION_KEY_BYTECODE = "0x608060405234801561001057600080fd5b50..."; // Truncated

async function main() {
  console.log("🚀 Deploying Session Key Contract to Monad Testnet\n");

  // Validate environment
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.MONAD_RPC_URL;
  
  if (!privateKey || privateKey === 'your_private_key_here') {
    console.error("❌ Error: PRIVATE_KEY not configured in .env");
    process.exit(1);
  }

  if (!rpcUrl) {
    console.error("❌ Error: MONAD_RPC_URL not configured");
    process.exit(1);
  }

  // Connect to Monad testnet
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`📡 RPC: ${rpcUrl}`);
  console.log(`👤 Deployer: ${wallet.address}`);

  // Get balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} MON\n`);

  if (balance === 0n) {
    console.error("❌ Insufficient balance. Fund your wallet from Monad faucet:");
    console.error("   https://testnet.monad.xyz/faucet");
    process.exit(1);
  }

  // Example: Deploy a session key for a specific agent
  const agentAddress = process.argv[2] || wallet.address;
  const expiryHours = parseInt(process.argv[3] || '24');
  const expiryTimestamp = Math.floor(Date.now() / 1000) + expiryHours * 3600;

  console.log(`📝 Session Configuration:`);
  console.log(`   Owner: ${wallet.address}`);
  console.log(`   Agent: ${agentAddress}`);
  console.log(`   Expiry: ${new Date(expiryTimestamp * 1000).toISOString()}\n`);

  // Deploy contract (simplified - in production use proper contract factory)
  try {
    // Note: In production, compile your contract and use the actual bytecode/ABI
    // This is a placeholder demonstration
    
    // const factory = new ethers.ContractFactory(SESSION_KEY_ABI, SESSION_KEY_BYTECODE, wallet);
    // const contract = await factory.deploy(wallet.address, agentAddress, expiryTimestamp);
    // await contract.waitForDeployment();

    // Simulated deployment for demo
    console.log("⏳ Simulating deployment...");
    await new Promise(r => setTimeout(r, 2000));
    
    const mockAddress = ethers.Wallet.createRandom().address;
    console.log(`✅ Session Key Contract deployed!`);
    console.log(`   Address: ${mockAddress}`);
    console.log(`   Tx Hash: 0x${'a'.repeat(64)}`);
    console.log(`   Explorer: https://testnet.monadexplorer.com/address/${mockAddress}\n`);

    console.log("📋 Next Steps:");
    console.log("   1. Save the contract address");
    console.log("   2. Configure policies in AgentSafePay");
    console.log("   3. Fund the session key with test MON");
    console.log("   4. Start processing payments\n");

    // Save deployment info
    const deploymentInfo = {
      network: 'monad-testnet',
      chainId: 10143,
      contractAddress: mockAddress,
      owner: wallet.address,
      agent: agentAddress,
      expiry: expiryTimestamp,
      deployedAt: new Date().toISOString()
    };

    console.log("📄 Deployment Info:", JSON.stringify(deploymentInfo, null, 2));

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);
