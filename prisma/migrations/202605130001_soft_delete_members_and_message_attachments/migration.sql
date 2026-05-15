ALTER TABLE "BandMember" ADD COLUMN "leftAt" DATETIME;
ALTER TABLE "Message" ADD COLUMN "attachments" JSONB NOT NULL DEFAULT [];
CREATE INDEX "BandMember_bandId_leftAt_idx" ON "BandMember"("bandId", "leftAt");
