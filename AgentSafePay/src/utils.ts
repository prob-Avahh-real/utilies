import { randomUUID } from 'crypto';
import { ethers } from 'ethers';

export function generateTaskId(): string {
  return `task_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function generateSessionId(): string {
  return `sess_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toISOString();
}

export function usdToWei(usdAmount: number, ethPrice: number): bigint {
  const ethAmount = usdAmount / ethPrice;
  return ethers.parseEther(ethAmount.toFixed(18));
}

export function weiToUsd(weiAmount: bigint, ethPrice: number): number {
  const ethAmount = Number(ethers.formatEther(weiAmount));
  return ethAmount * ethPrice;
}

export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}
