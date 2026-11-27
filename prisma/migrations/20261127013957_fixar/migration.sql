-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "pinned_at" TIMESTAMPTZ(6),
ADD COLUMN     "pinned_by" UUID;

-- CreateIndex
CREATE INDEX "messages_channel_id_pinned_at_idx" ON "messages"("channel_id", "pinned_at");
