-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AthleteProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "primarySport" TEXT NOT NULL DEFAULT 'running',
    "weeklyAvailableDays" INTEGER NOT NULL DEFAULT 5,
    "preferredSports" JSONB NOT NULL DEFAULT [],
    "primaryGoal" TEXT,
    "goalDate" DATETIME,
    "goalTime" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AthleteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'intervals.icu',
    "athleteId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "lastSyncAt" DATETIME,
    "syncStatus" TEXT NOT NULL DEFAULT 'idle',
    "syncMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConnectedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectedAccountId" TEXT NOT NULL,
    "providerActivityId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "distanceMeters" REAL,
    "tss" REAL,
    "intensityFactor" REAL,
    "avgHr" REAL,
    "maxHr" REAL,
    "avgPower" REAL,
    "normalizedPower" REAL,
    "avgPace" REAL,
    "elevationGain" REAL,
    "rawData" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Activity_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyAthleteState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dataLevel" TEXT NOT NULL,
    "dataQuality" JSONB NOT NULL,
    "fitness" REAL,
    "fatigue" REAL,
    "form" REAL,
    "sleepScore" REAL,
    "hrvScore" REAL,
    "acwr" REAL,
    "monotony" REAL,
    "strain" REAL,
    "adherence" REAL,
    "subjectiveFatigue" INTEGER,
    "trainingCapacity" INTEGER NOT NULL,
    "capacityStatus" TEXT NOT NULL,
    "trainingRiskScore" REAL NOT NULL,
    "trainingRiskLevel" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "stateJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyAthleteState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "trainingCapacity" INTEGER NOT NULL,
    "capacityStatus" TEXT NOT NULL,
    "trainingRiskScore" REAL NOT NULL,
    "trainingRiskLevel" TEXT NOT NULL,
    "goalPhase" TEXT,
    "dataLevel" TEXT NOT NULL,
    "availableTimeMinutes" INTEGER NOT NULL DEFAULT 60,
    "preferredSport" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "expectedTss" REAL NOT NULL,
    "intensity" TEXT NOT NULL,
    "structure" JSONB NOT NULL,
    "dayType" TEXT NOT NULL,
    "hardSafetyTriggered" BOOLEAN NOT NULL DEFAULT false,
    "triggeredRules" JSONB,
    "evidence" JSONB,
    "userFriendlyReason" TEXT NOT NULL,
    "technicalReason" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "originalRecommendationId" TEXT,
    "decisionJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "feedbackType" TEXT NOT NULL,
    "subjectiveFatigue" INTEGER,
    "pain" BOOLEAN NOT NULL DEFAULT false,
    "painArea" TEXT,
    "availableTimeMinutes" INTEGER,
    "preferredSport" TEXT,
    "note" TEXT,
    "adjustedRecommendationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserFeedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "DailyRecommendation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "weekEnd" DATETIME NOT NULL,
    "summary" TEXT NOT NULL,
    "adherence" REAL NOT NULL,
    "weeklyTss" REAL NOT NULL,
    "loadChangeVsLastWeek" REAL NOT NULL,
    "trainingRiskLevel" TEXT NOT NULL,
    "highlights" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "nextWeekRecommendation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteProfile_userId_key" ON "AthleteProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_userId_provider_key" ON "ConnectedAccount"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_connectedAccountId_providerActivityId_key" ON "Activity"("connectedAccountId", "providerActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAthleteState_userId_date_key" ON "DailyAthleteState"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRecommendation_userId_date_key" ON "DailyRecommendation"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_userId_weekStart_key" ON "WeeklyReview"("userId", "weekStart");
