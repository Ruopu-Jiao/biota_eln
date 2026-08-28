-- CreateEnum
CREATE TYPE "PlanningTaskStatus" AS ENUM ('QUEUED', 'SCHEDULED', 'DONE');

-- CreateTable
CREATE TABLE "PlanningWhiteboard" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PlanningWhiteboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningProject" (
    "id" TEXT NOT NULL,
    "whiteboardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PlanningProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningExperiment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PlanningExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningTask" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "PlanningTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "startDate" DATE,
    "endDate" DATE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PlanningTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningTaskEntryLink" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningTaskEntryLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanningWhiteboard_repositoryId_updatedAt_idx" ON "PlanningWhiteboard"("repositoryId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningWhiteboard_repositoryId_slug_key" ON "PlanningWhiteboard"("repositoryId", "slug");

-- CreateIndex
CREATE INDEX "PlanningProject_whiteboardId_sortOrder_idx" ON "PlanningProject"("whiteboardId", "sortOrder");

-- CreateIndex
CREATE INDEX "PlanningExperiment_projectId_sortOrder_idx" ON "PlanningExperiment"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "PlanningTask_experimentId_status_sortOrder_idx" ON "PlanningTask"("experimentId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "PlanningTaskEntryLink_entryId_idx" ON "PlanningTaskEntryLink"("entryId");

-- CreateIndex
CREATE INDEX "PlanningTaskEntryLink_taskId_sortOrder_idx" ON "PlanningTaskEntryLink"("taskId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningTaskEntryLink_taskId_entryId_key" ON "PlanningTaskEntryLink"("taskId", "entryId");

-- AddForeignKey
ALTER TABLE "PlanningWhiteboard" ADD CONSTRAINT "PlanningWhiteboard_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningProject" ADD CONSTRAINT "PlanningProject_whiteboardId_fkey" FOREIGN KEY ("whiteboardId") REFERENCES "PlanningWhiteboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningExperiment" ADD CONSTRAINT "PlanningExperiment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PlanningProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningTask" ADD CONSTRAINT "PlanningTask_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "PlanningExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningTaskEntryLink" ADD CONSTRAINT "PlanningTaskEntryLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PlanningTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningTaskEntryLink" ADD CONSTRAINT "PlanningTaskEntryLink_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
