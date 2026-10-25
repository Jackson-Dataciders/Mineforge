import { ZodError } from "zod";
import { getAllowedUser } from "@/server/session";
import {
  isConflictError,
  isNotFoundError,
  isValidationError,
  ValidationError,
} from "@/storage";

/**
 * Wraps a route handler: re-checks the allowlisted session (ADR 0013) and maps
 * storage errors to JSON responses (409 conflict, 400 validation, 404).
 */
export function apiRoute<Context>(
  handler: (request: Request, context: Context) => Promise<Response>,
) {
  return async (request: Request, context: Context): Promise<Response> => {
    if (!(await getAllowedUser())) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    try {
      return await handler(request, context);
    } catch (error) {
      if (isConflictError(error)) {
        return Response.json(
          { error: "conflict", paths: error.paths },
          { status: 409 },
        );
      }
      if (isValidationError(error)) {
        return Response.json({ error: error.code }, { status: 400 });
      }
      if (error instanceof ZodError) {
        return Response.json({ error: "invalidInput" }, { status: 400 });
      }
      if (isNotFoundError(error)) {
        return Response.json({ error: "notFound" }, { status: 404 });
      }
      console.error(error);
      return Response.json({ error: "unknown" }, { status: 500 });
    }
  };
}

/** Parses a JSON body; malformed JSON becomes a 400 via ZodError-like handling. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("invalidInput");
  }
}
