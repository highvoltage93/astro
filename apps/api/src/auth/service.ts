import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { env } from "../config/env";
import { prisma } from "../prisma/client";

const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_KEY_LENGTH = 32;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

type JwtPayload = {
  sub: string;
  email: string;
  username: string;
  locale: string;
  role: UserRole;
  exp: number;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  locale: string;
  role: UserRole;
};

const encodeBase64Url = (input: Buffer | string): string => Buffer.from(input).toString("base64url");

const decodeBase64UrlJson = <Payload>(input: string): Payload | null => {
  try {
    return JSON.parse(Buffer.from(input, "base64url").toString("utf8")) as Payload;
  } catch {
    return null;
  }
};

const sign = (input: string): string => createHmac("sha256", env.jwtSecret).update(input).digest("base64url");

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, "sha256").toString("base64url");

  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
};

export const verifyPassword = (password: string, passwordHash: string): boolean => {
  const [algorithm, iterationsValue, salt, expectedHash] = passwordHash.split("$");
  const iterations = Number(iterationsValue);

  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !expectedHash) {
    return false;
  }

  const actualHash = pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_LENGTH, "sha256");
  const expectedHashBuffer = Buffer.from(expectedHash, "base64url");

  return actualHash.length === expectedHashBuffer.length && timingSafeEqual(actualHash, expectedHashBuffer);
};

export const createAuthToken = (user: AuthUser): string => {
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      username: user.username,
      locale: user.locale,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
    } satisfies JwtPayload)
  );
  const body = `${header}.${payload}`;

  return `${body}.${sign(body)}`;
};

export const verifyAuthToken = (token: string): JwtPayload | null => {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    return null;
  }

  const expectedSignature = sign(`${header}.${payload}`);
  const actualSignatureBuffer = Buffer.from(signature, "base64url");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "base64url");

  if (
    actualSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(actualSignatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  const parsedPayload = decodeBase64UrlJson<JwtPayload>(payload);

  if (!parsedPayload || parsedPayload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return parsedPayload;
};

const bearerTokenFromRequest = (request: FastifyRequest): string | null => {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
};

export const getOptionalAuthUser = async (request: FastifyRequest): Promise<AuthUser | null> => {
  const token = bearerTokenFromRequest(request);

  if (!token) {
    return null;
  }

  const payload = verifyAuthToken(token);

  if (!payload) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: payload.sub
    },
    select: {
      id: true,
      email: true,
      username: true,
      locale: true,
      role: true
    }
  });
};
