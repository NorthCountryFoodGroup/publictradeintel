"use strict";

const crypto = require("node:crypto");

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""), "utf8");
  const rightBuffer = Buffer.from(String(right ?? ""), "utf8");
  const length = Math.max(leftBuffer.length, rightBuffer.length, 1);
  const leftPadded = Buffer.alloc(length);
  const rightPadded = Buffer.alloc(length);
  leftBuffer.copy(leftPadded);
  rightBuffer.copy(rightPadded);
  const equal = crypto.timingSafeEqual(leftPadded, rightPadded);
  return equal && leftBuffer.length === rightBuffer.length;
}

class SlidingWindowLimiter {
  constructor({ windowMs, maximumAttempts, lockoutMs, maximumEntries = 5000, now = Date.now }) {
    this.windowMs = windowMs;
    this.maximumAttempts = maximumAttempts;
    this.lockoutMs = lockoutMs;
    this.maximumEntries = maximumEntries;
    this.now = now;
    this.entries = new Map();
  }

  cleanup() {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.lockedUntil <= now && entry.windowStartedAt + this.windowMs <= now) this.entries.delete(key);
    }
    while (this.entries.size > this.maximumEntries) this.entries.delete(this.entries.keys().next().value);
  }

  check(key) {
    this.cleanup();
    const now = this.now();
    const entry = this.entries.get(key);
    if (!entry) return { allowed: true, retryAfterMs: 0 };
    if (entry.lockedUntil > now) return { allowed: false, retryAfterMs: entry.lockedUntil - now };
    if (entry.windowStartedAt + this.windowMs <= now) {
      this.entries.delete(key);
      return { allowed: true, retryAfterMs: 0 };
    }
    return { allowed: true, retryAfterMs: 0 };
  }

  recordFailure(key) {
    const now = this.now();
    let entry = this.entries.get(key);
    if (!entry || entry.windowStartedAt + this.windowMs <= now) {
      entry = { attempts: 0, windowStartedAt: now, lockedUntil: 0 };
    }
    entry.attempts += 1;
    if (entry.attempts >= this.maximumAttempts) entry.lockedUntil = now + this.lockoutMs;
    this.entries.set(key, entry);
    this.cleanup();
    return this.check(key);
  }

  reset(key) {
    this.entries.delete(key);
  }
}

function clientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return (forwarded || request.socket?.remoteAddress || "unknown").slice(0, 120);
}

module.exports = {
  SlidingWindowLimiter,
  boundedInteger,
  clientIp,
  constantTimeEqual,
};
