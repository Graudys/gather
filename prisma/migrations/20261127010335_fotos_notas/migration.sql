-- CreateTable
CREATE TABLE "note_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "note_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "note_images_note_id_idx" ON "note_images"("note_id");

-- CreateIndex
CREATE INDEX "note_images_workspace_id_idx" ON "note_images"("workspace_id");

-- AddForeignKey
ALTER TABLE "note_images" ADD CONSTRAINT "note_images_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
