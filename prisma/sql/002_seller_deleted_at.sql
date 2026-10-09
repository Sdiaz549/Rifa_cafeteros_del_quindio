ALTER TABLE "Seller" ADD COLUMN "deletedAt" DATETIME;
CREATE INDEX "Seller_deletedAt_idx" ON "Seller"("deletedAt");
