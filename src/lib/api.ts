export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T = void>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (method !== "GET") {
    const csrf = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!csrf.ok)
      throw new ApiError(
        csrf.status,
        "Unable to secure the request. Please retry.",
      );
    headers["X-CSRF-TOKEN"] = (await csrf.json()).token;
  }
  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let result: Record<string, unknown> = {};
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON gateway response */
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      String(
        result.message ??
          result.title ??
          (response.status === 401
            ? "Sign-in failed or your session expired. Check your details and try again."
            : response.status === 403
              ? "You do not have permission. Staff actions require MFA."
              : response.status === 429
                ? "Too many attempts. Wait a minute before trying again."
                : "Something went wrong. Please try again."),
      ),
    );
  return result as T;
}
export interface Session {
  id: string;
  displayName: string;
  email: string;
  emailConfirmed: boolean;
  twoFactorEnabled: boolean;
  mfaVerified: boolean;
  memberships: {
    club_id: string;
    club_name: string;
    role: "guardian" | "coach" | "manager" | "admin";
  }[];
}
