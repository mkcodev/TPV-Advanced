import { SignJWT, jwtVerify } from 'jose';

export interface EmployeeSessionPayload {
  employeeId: string;
  deviceId: string;
}

const ALG = 'HS256';
const EXPIRATION = '12h';

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

// Signs a short-lived employee session JWT (HS256).
// The token is stored in memory on the terminal and sent in x-employee-session.
// Role is NOT embedded — always re-read from DB in role-gated procedures.
export async function signEmployeeSession(
  payload: EmployeeSessionPayload,
  secret: string,
): Promise<string> {
  return new SignJWT({ employeeId: payload.employeeId, deviceId: payload.deviceId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(secretKey(secret));
}

// Returns the payload if valid, null if expired/tampered/unparseable.
export async function verifyEmployeeSession(
  token: string,
  secret: string,
): Promise<EmployeeSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret));
    if (typeof payload.employeeId !== 'string' || typeof payload.deviceId !== 'string') {
      return null;
    }
    return { employeeId: payload.employeeId, deviceId: payload.deviceId };
  } catch {
    return null;
  }
}
