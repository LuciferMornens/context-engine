import { Router } from "express";
import type { Request, Response } from "express";

/** Configuration for the auth service */
export const AUTH_TIMEOUT = 3000;

/**
 * Validate a JWT token and extract the user payload.
 * @param token - The JWT string
 * @returns The decoded user or null
 */
export function validateToken(token: string): User | null {
  if (!token) return null;
  return decode(token);
}

export class AuthService {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  /** Sign a new token for the given user */
  async signToken(user: User): Promise<string> {
    return jwt.sign({ id: user.id }, this.secret);
  }

  async revokeToken(tokenId: string): Promise<void> {
    await this.db.delete(tokenId);
  }
}

interface User {
  id: number;
  email: string;
  role: string;
}

type AuthResult = { ok: true; user: User } | { ok: false; error: string };

export default function createRouter(): Router {
  return Router();
}
