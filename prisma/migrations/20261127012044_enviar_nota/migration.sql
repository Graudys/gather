-- CreateTable
CREATE TABLE "shared_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_note_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shared_note_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_note_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shared_notes_message_id_key" ON "shared_notes"("message_id");

-- CreateIndex
CREATE INDEX "shared_notes_workspace_id_idx" ON "shared_notes"("workspace_id");

-- CreateIndex
CREATE INDEX "shared_note_images_shared_note_id_idx" ON "shared_note_images"("shared_note_id");

-- AddForeignKey
ALTER TABLE "shared_notes" ADD CONSTRAINT "shared_notes_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_note_images" ADD CONSTRAINT "shared_note_images_shared_note_id_fkey" FOREIGN KEY ("shared_note_id") REFERENCES "shared_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
