import crypto from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import { PrismaClient } from "@prisma/client";

type ApiUserRole = "superAdmin" | "landlord" | "tenant";
type ProvisionUserInput = {
  email?: unknown;
  fullName?: unknown;
  phone?: unknown;
  role?: unknown;
  skipFirstTimeFlow?: unknown;
};

interface ApiUserResponse {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: ApiUserRole;
  status: "active" | "disabled";
  mustChangePassword: boolean;
  onboardingCompleted: boolean;
  firstTimePasswordToken?: string;
}

const prisma = new PrismaClient();
const prismaDb = prisma as any;
const router = express.Router();
const DEFAULT_LOGIN_PASSWORD = process.env.APP_LOGIN_PASSWORD ?? "demo123";
const ALLOWED_ROLES = new Set<ApiUserRole>(["superAdmin", "landlord", "tenant"]);
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL ?? "http://localhost:3000";
const FIRST_TIME_TOKEN_TTL_HOURS = 48;

const jsonHeaders = (res: Response): void => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const normalizeRole = (value: unknown): ApiUserRole | undefined => {
  if (value === "superAdmin" || value === "landlord" || value === "tenant") return value;
  return undefined;
};

const normalizeText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const normalizeBoolean = (value: unknown): boolean =>
  value === true || value === "true" || value === 1 || value === "1";

const tokenExpiresAt = (): Date => {
  const expires = new Date();
  expires.setHours(expires.getHours() + FIRST_TIME_TOKEN_TTL_HOURS);
  return expires;
};

const generateFirstTimePasswordToken = (): string => crypto.randomBytes(24).toString("hex");

const toUserResponse = (user: any): ApiUserResponse => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  phone: user.phone ?? undefined,
  role: user.role,
  status: user.status,
  mustChangePassword: Boolean(user.mustChangePassword),
  onboardingCompleted: Boolean(user.onboardingCompleted),
  firstTimePasswordToken:
    user.mustChangePassword && typeof user.firstTimePasswordToken === "string" && user.firstTimePasswordToken
      ? user.firstTimePasswordToken
      : undefined
});

const requiresFirstTimeFlowRole = (role: ApiUserRole): boolean => role === "tenant" || role === "landlord";

const ensureFirstTimeTokenForUser = async (user: any): Promise<any> => {
  if (!requiresFirstTimeFlowRole(user.role) || !user.mustChangePassword) return user;
  const stillValid =
    typeof user.firstTimePasswordToken === "string" &&
    user.firstTimePasswordToken.length > 0 &&
    user.firstTimePasswordTokenExpiresAt &&
    new Date(user.firstTimePasswordTokenExpiresAt).getTime() > Date.now();
  if (stillValid) return user;

  const nextToken = generateFirstTimePasswordToken();
  return prismaDb.user.update({
    where: { id: user.id },
    data: {
      firstTimePasswordToken: nextToken,
      firstTimePasswordTokenExpiresAt: tokenExpiresAt()
    }
  });
};

const mockSendWelcomeEmail = (input: {
  email: string;
  fullName: string;
  onboardingLink: string;
  role: ApiUserRole;
}): void => {
  const payload = {
    channel: "email",
    template: "first-access-password-setup",
    to: input.email,
    recipientName: input.fullName,
    role: input.role,
    onboardingLink: input.onboardingLink
  };
  console.info("[MOCK_EMAIL]", JSON.stringify(payload));
};

router.options("/api/auth/login", (_req: Request, res: Response) => {
  jsonHeaders(res);
  res.status(204).end();
});
router.options("/api/auth/provision-user", (_req: Request, res: Response) => {
  jsonHeaders(res);
  res.status(204).end();
});
router.options("/api/auth/provision-users", (_req: Request, res: Response) => {
  jsonHeaders(res);
  res.status(204).end();
});
router.options("/api/auth/onboarding/complete", (_req: Request, res: Response) => {
  jsonHeaders(res);
  res.status(204).end();
});

router.post("/api/auth/login", express.json(), async (req: Request, res: Response): Promise<void> => {
  jsonHeaders(res);
  const email = normalizeText(req.body?.email).toLowerCase();
  const password = normalizeText(req.body?.password);

  if (!email || !password) {
    res.status(400).json({ error: "Missing email or password." });
    return;
  }

  let user = await prismaDb.user.findUnique({ where: { email } });
  if (!user || user.status !== "active") {
    res.status(404).json({ error: "User not found or inactive." });
    return;
  }

  const expectedPassword = typeof user.password === "string" && user.password.length > 0 ? user.password : DEFAULT_LOGIN_PASSWORD;
  if (password !== expectedPassword) {
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }

  user = await ensureFirstTimeTokenForUser(user);

  const userResponse = toUserResponse(user);
  const firstTimePasswordLink =
    requiresFirstTimeFlowRole(userResponse.role) &&
    userResponse.mustChangePassword &&
    userResponse.firstTimePasswordToken
      ? `${FRONTEND_BASE_URL}/onboarding?token=${encodeURIComponent(userResponse.firstTimePasswordToken)}`
      : undefined;

  res.status(200).json({
    user: userResponse,
    firstTimePasswordLink
  });
});

router.post(
  "/api/auth/provision-user",
  express.json(),
  async (req: Request, res: Response): Promise<void> => {
    jsonHeaders(res);
    const email = normalizeText(req.body?.email).toLowerCase();
    const fullName = normalizeText(req.body?.fullName);
    const phone = normalizeText(req.body?.phone) || undefined;
    const role = normalizeRole(req.body?.role);
    const skipFirstTimeFlow = normalizeBoolean(req.body?.skipFirstTimeFlow);

    if (!email || !fullName || !role) {
      res.status(400).json({ error: "Missing email, fullName, or role." });
      return;
    }
    if (!ALLOWED_ROLES.has(role)) {
      res.status(400).json({ error: "Unsupported role." });
      return;
    }

    const existing = await prismaDb.user.findUnique({ where: { email } });
    const isNew = !existing;

    let user: any;
    let firstTimePasswordLink: string | undefined;
    let mockedEmailSent = false;

    if (isNew) {
      const firstTimeToken =
        requiresFirstTimeFlowRole(role) && !skipFirstTimeFlow ? generateFirstTimePasswordToken() : undefined;
      user = await prismaDb.user.create({
        data: {
          email,
          fullName,
          phone,
          role,
          status: "active",
          password: requiresFirstTimeFlowRole(role) && !skipFirstTimeFlow ? "" : DEFAULT_LOGIN_PASSWORD,
          mustChangePassword: requiresFirstTimeFlowRole(role) && !skipFirstTimeFlow,
          onboardingCompleted: requiresFirstTimeFlowRole(role) && !skipFirstTimeFlow ? false : true,
          firstTimePasswordToken: firstTimeToken ?? "",
          firstTimePasswordTokenExpiresAt: firstTimeToken ? tokenExpiresAt() : null,
          welcomeEmailSentAt: firstTimeToken ? new Date() : null
        }
      });

      if (firstTimeToken) {
        firstTimePasswordLink = `${FRONTEND_BASE_URL}/onboarding?token=${encodeURIComponent(firstTimeToken)}`;
        mockSendWelcomeEmail({ email, fullName, onboardingLink: firstTimePasswordLink, role });
        mockedEmailSent = true;
      }
    } else {
      user = await prismaDb.user.update({
        where: { email },
        data: {
          fullName,
          phone,
          role,
          status: "active"
        }
      });
    }

    const userResponse = toUserResponse(user);
    if (
      !firstTimePasswordLink &&
      requiresFirstTimeFlowRole(userResponse.role) &&
      userResponse.mustChangePassword &&
      userResponse.firstTimePasswordToken
    ) {
      firstTimePasswordLink = `${FRONTEND_BASE_URL}/onboarding?token=${encodeURIComponent(userResponse.firstTimePasswordToken)}`;
    }

    res.status(200).json({
      user: userResponse,
      firstTimePasswordLink,
      mockedEmailSent
    });
  }
);

router.post(
  "/api/auth/provision-users",
  express.json(),
  async (req: Request, res: Response): Promise<void> => {
    jsonHeaders(res);
    const users = Array.isArray(req.body?.users) ? (req.body.users as ProvisionUserInput[]) : undefined;
    if (!users || users.length === 0) {
      res.status(400).json({ error: "Missing users array." });
      return;
    }

    const normalized = users.map((raw: ProvisionUserInput) => ({
      email: normalizeText(raw?.email).toLowerCase(),
      fullName: normalizeText(raw?.fullName),
      phone: normalizeText(raw?.phone) || undefined,
      role: normalizeRole(raw?.role),
      skipFirstTimeFlow: normalizeBoolean(raw?.skipFirstTimeFlow)
    }));

    const invalid = normalized.find((item) => !item.email || !item.fullName || !item.role);
    if (invalid) {
      res.status(400).json({ error: "Each user requires email, fullName, and role." });
      return;
    }

    const results = await Promise.all(
      normalized.map((item) =>
        prismaDb.user.upsert({
          where: { email: item.email },
          create: {
            email: item.email,
            fullName: item.fullName,
            phone: item.phone,
            role: item.role,
            status: "active",
            password:
              requiresFirstTimeFlowRole(item.role as ApiUserRole) && !item.skipFirstTimeFlow
                ? ""
                : DEFAULT_LOGIN_PASSWORD,
            mustChangePassword:
              requiresFirstTimeFlowRole(item.role as ApiUserRole) && !item.skipFirstTimeFlow,
            onboardingCompleted:
              !(requiresFirstTimeFlowRole(item.role as ApiUserRole) && !item.skipFirstTimeFlow),
            firstTimePasswordToken: "",
            firstTimePasswordTokenExpiresAt: null,
            welcomeEmailSentAt: null
          },
          update: {
            fullName: item.fullName,
            phone: item.phone,
            role: item.role,
            status: "active"
          }
        })
      )
    );

    res.status(200).json({
      users: results.map((user) => toUserResponse(user))
    });
  }
);

router.post(
  "/api/auth/onboarding/complete",
  express.json(),
  async (req: Request, res: Response): Promise<void> => {
    jsonHeaders(res);
    const token = normalizeText(req.body?.token);
    const password = normalizeText(req.body?.password);
    const phone = normalizeText(req.body?.phone) || undefined;

    if (!token || !password) {
      res.status(400).json({ error: "Missing token or password." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters." });
      return;
    }

    const user = await prismaDb.user.findFirst({ where: { firstTimePasswordToken: token } });
    if (!user || !requiresFirstTimeFlowRole(user.role)) {
      res.status(404).json({ error: "Invalid onboarding token." });
      return;
    }

    const expiresAt = user.firstTimePasswordTokenExpiresAt ? new Date(user.firstTimePasswordTokenExpiresAt) : undefined;
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      res.status(410).json({ error: "Onboarding token expired. Ask for a new invitation." });
      return;
    }

    const updated = await prismaDb.user.update({
      where: { id: user.id },
      data: {
        password,
        phone,
        mustChangePassword: false,
        onboardingCompleted: true,
        firstTimePasswordToken: "",
        firstTimePasswordTokenExpiresAt: null
      }
    });

    res.status(200).json({ user: toUserResponse(updated) });
  }
);

export const addAuthRoutes = (app: Express): void => {
  app.use(router);
};
