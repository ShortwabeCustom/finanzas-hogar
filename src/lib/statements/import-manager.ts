/**
 * Manages temporary import sessions during the multi-step import workflow
 */

interface ImportSession {
  importId: string;
  userId: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  step: number;
  stepName: string;
  totalSteps: number;
  percentage: number;
  preview?: {
    bankName: string;
    period: string;
    transactionCount: number;
    statementDate: string;
    transactions: Array<{
      date: string;
      description: string;
      chargeAmount: number | null;
      creditAmount: number | null;
    }>;
  };
  payload?: any;
  error?: {
    code: string;
    message: string;
  };
  createdAt: Date;
  expiresAt: Date;
}

// In-memory storage (in production, use Redis or database)
const importSessions = new Map<string, ImportSession>();

const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

function generateImportId(): string {
  return "imp_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function createImportSession(userId: string): ImportSession {
  const importId = generateImportId();
  const now = new Date();

  const session: ImportSession = {
    importId,
    userId,
    status: "PROCESSING",
    step: 1,
    stepName: "Cargando archivo...",
    totalSteps: 4,
    percentage: 25,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL),
  };

  importSessions.set(importId, session);
  return session;
}

export function getImportSession(importId: string): ImportSession | null {
  const session = importSessions.get(importId);

  if (!session) return null;

  // Check expiration
  if (new Date() > session.expiresAt) {
    importSessions.delete(importId);
    return null;
  }

  return session;
}

export function updateImportSession(
  importId: string,
  updates: Partial<Omit<ImportSession, "importId" | "userId" | "createdAt">>
): ImportSession | null {
  const session = getImportSession(importId);
  if (!session) return null;

  Object.assign(session, updates);
  importSessions.set(importId, session);
  return session;
}

export function deleteImportSession(importId: string): void {
  importSessions.delete(importId);
}

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [id, session] of importSessions.entries()) {
    if (now > session.expiresAt) {
      importSessions.delete(id);
    }
  }
}, 5 * 60 * 1000);
