-- CreateTable
CREATE TABLE "DailyWellnessMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "sleepScore" REAL,
    "sleepSeconds" INTEGER,
    "sleepQuality" REAL,
    "hrvScore" REAL,
    "hrvMs" REAL,
    "hrvSdnnMs" REAL,
    "restingHr" REAL,
    "readiness" REAL,
    "fatigue" REAL,
    "soreness" REAL,
    "stress" REAL,
    "mood" REAL,
    "motivation" REAL,
    "weightKg" REAL,
    "steps" INTEGER,
    "rawData" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyWellnessMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyWellnessMetric_userId_date_source_key" ON "DailyWellnessMetric"("userId", "date", "source");

-- CreateIndex
CREATE INDEX "DailyWellnessMetric_userId_date_idx" ON "DailyWellnessMetric"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyWellnessMetric_userId_source_idx" ON "DailyWellnessMetric"("userId", "source");
