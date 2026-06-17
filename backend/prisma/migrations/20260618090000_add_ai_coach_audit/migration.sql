-- CreateTable
CREATE TABLE "AiCoachAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "inputEvidence" JSONB NOT NULL,
    "ruleResult" JSONB,
    "rawOutput" TEXT,
    "finalOutput" TEXT NOT NULL,
    "guardrailReasons" JSONB,
    "safetyFiltered" BOOLEAN NOT NULL DEFAULT false,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiCoachAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiCoachAudit_userId_createdAt_idx" ON "AiCoachAudit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCoachAudit_interactionType_createdAt_idx" ON "AiCoachAudit"("interactionType", "createdAt");
