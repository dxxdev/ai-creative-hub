-- DropIndex
DROP INDEX "posts_contentType_idx";

-- DropIndex
DROP INDEX "posts_createdAt_idx";

-- DropIndex
DROP INDEX "posts_visibility_status_idx";

-- CreateIndex
CREATE INDEX "posts_contentType_visibility_status_createdAt_idx" ON "posts"("contentType", "visibility", "status", "createdAt");
