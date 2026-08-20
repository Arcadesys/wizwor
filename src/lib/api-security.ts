import { NextResponse } from "next/server";
import { z } from "zod";

const privateApiHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

export const sessionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9._:-]+$/);

const blockedObjectKeys = new Set(["__proto__", "constructor", "prototype"]);
const boundedKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => !blockedObjectKeys.has(value));
const boundedScalarSchema = z.union([z.string().max(300), z.number().finite(), z.boolean()]);
const boundedRecordSchema = z
  .record(boundedKeySchema, boundedScalarSchema)
  .refine((value) => Object.keys(value).length <= 16);
const boundedProfileValueSchema = z.union([
  boundedScalarSchema,
  z.array(boundedScalarSchema).max(16),
  boundedRecordSchema,
]);

export const boundedProfileSchema = z
  .record(boundedKeySchema, boundedProfileValueSchema)
  .refine((value) => Object.keys(value).length <= 24);

export function apiJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(privateApiHeaders)) {
    headers.set(key, value);
  }

  return NextResponse.json(body, { ...init, headers });
}

export function rejectCrossOriginRequest(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");

  try {
    const fallbackUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0].trim();
    const host = forwardedHost || request.headers.get("host") || fallbackUrl.host;
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0].trim();
    const protocol = forwardedProtocol || fallbackUrl.protocol.slice(0, -1);
    const expectedOrigin = `${protocol}://${host}`;

    if (!origin || new URL(origin).origin !== expectedOrigin) {
      return apiJson({ error: "Cross-origin requests are not allowed." }, { status: 403 });
    }
  } catch {
    return apiJson({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  return null;
}

type JsonBodyResult =
  | { ok: true; data: unknown }
  | { ok: false; response: NextResponse };

export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return {
      ok: false,
      response: apiJson({ error: "Content-Type must be application/json." }, { status: 415 }),
    };
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      ok: false,
      response: apiJson({ error: "Request body is too large." }, { status: 413 }),
    };
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return {
      ok: false,
      response: apiJson({ error: "Request body is too large." }, { status: 413 }),
    };
  }

  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      response: apiJson({ error: "Invalid JSON body." }, { status: 400 }),
    };
  }
}

export function logServerError(scope: string, error: unknown) {
  const details: Record<string, unknown> = {
    type: "wizwor.server_error",
    scope,
    errorName: error instanceof Error ? error.name : "UnknownError",
  };

  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
    details.status = error.status;
  }

  console.error(JSON.stringify(details));
}
