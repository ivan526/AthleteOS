ALTER TABLE "AiCoachAudit" ADD COLUMN "requestHash" TEXT;
ALTER TABLE "AiCoachAudit" ADD COLUMN "cacheHit" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "AiCoachAudit_userId_requestHash_createdAt_idx"
ON "AiCoachAudit"("userId", "requestHash", "createdAt");
