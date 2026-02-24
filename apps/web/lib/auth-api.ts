const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type KeystoneUserRole = "superAdmin" | "landlord" | "tenant";

export interface KeystoneUserRecord {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: KeystoneUserRole;
  status: "active" | "disabled";
  mustChangePassword: boolean;
  onboardingCompleted: boolean;
  firstTimePasswordToken?: string;
}

export interface KeystoneLoginResponse {
  user: KeystoneUserRecord;
  firstTimePasswordLink?: string;
}

const asErrorMessage = (value: unknown, fallback: string): string => {
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
};

export const loginWithKeystone = async (input: {
  email: string;
  password: string;
}): Promise<KeystoneLoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: unknown;
    user?: KeystoneUserRecord;
    firstTimePasswordLink?: string;
  };

  if (!response.ok || !body.user) {
    throw new Error(asErrorMessage(body.error, "Login failed."));
  }
  return { user: body.user, firstTimePasswordLink: body.firstTimePasswordLink };
};

export const provisionKeystoneUser = async (input: {
  email: string;
  fullName: string;
  phone?: string;
  role: KeystoneUserRole;
  skipFirstTimeFlow?: boolean;
}): Promise<{ user: KeystoneUserRecord; firstTimePasswordLink?: string; mockedEmailSent?: boolean }> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/provision-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: unknown;
    user?: KeystoneUserRecord;
    firstTimePasswordLink?: string;
    mockedEmailSent?: boolean;
  };
  if (!response.ok || !body.user) {
    throw new Error(asErrorMessage(body.error, "User provisioning failed."));
  }
  return { user: body.user, firstTimePasswordLink: body.firstTimePasswordLink, mockedEmailSent: body.mockedEmailSent };
};

export const provisionKeystoneUsers = async (
  users: Array<{
    email: string;
    fullName: string;
    phone?: string;
    role: KeystoneUserRole;
    skipFirstTimeFlow?: boolean;
  }>
): Promise<KeystoneUserRecord[]> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/provision-users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ users })
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: unknown;
    users?: KeystoneUserRecord[];
  };

  if (!response.ok || !Array.isArray(body.users)) {
    throw new Error(asErrorMessage(body.error, "Bulk user provisioning failed."));
  }

  return body.users;
};

export const completeTenantOnboarding = async (input: {
  token: string;
  password: string;
  phone?: string;
}): Promise<KeystoneUserRecord> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/onboarding/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: unknown;
    user?: KeystoneUserRecord;
  };

  if (!response.ok || !body.user) {
    throw new Error(asErrorMessage(body.error, "Onboarding failed."));
  }
  return body.user;
};
