import * as jose from "jose";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import type { SessionPayload } from "./types";

const JWT_ALG = "HS256";

export async function signSessionToken(
  payload: SessionPayload,
): Promise<string> {
  const secret = new TextEncoder().encode(env.appSecret);
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("1 year")
    .sign(secret);
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  if (!token) {
    logger.warn("No token provided for session verification");
    return null;
  }
  try {
    const secret = new TextEncoder().encode(env.appSecret);
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: [JWT_ALG],
    });
    const { unionId, clientId } = payload;
    if (!unionId || !clientId) {
      logger.warn("JWT payload missing required fields");
      return null;
    }
    return { unionId, clientId } as SessionPayload;
  } catch (error) {
    logger.warn("JWT verification failed", { error: String(error) });
    return null;
  }
}
