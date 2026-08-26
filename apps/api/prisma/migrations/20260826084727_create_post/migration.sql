/*
  Warnings:

  - You are about to drop the column `mediaUrl` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnailUrl` on the `posts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "posts" DROP COLUMN "mediaUrl",
DROP COLUMN "thumbnailUrl",
ADD COLUMN     "codeHighlightHtml" TEXT,
ADD COLUMN     "mediaPath" TEXT,
ADD COLUMN     "thumbnailPath" TEXT;
