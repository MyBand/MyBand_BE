ALTER TABLE "User" ADD COLUMN "nickname" TEXT;
ALTER TABLE "User" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Band" ADD COLUMN "genre" TEXT;
ALTER TABLE "Band" ADD COLUMN "iconUrl" TEXT;
ALTER TABLE "Band" ADD COLUMN "inviteCode" TEXT;

UPDATE "Band"
SET "inviteCode" = upper(substr(hex(randomblob(4)), 1, 8))
WHERE "inviteCode" IS NULL;

CREATE UNIQUE INDEX "Band_inviteCode_key" ON "Band"("inviteCode");
