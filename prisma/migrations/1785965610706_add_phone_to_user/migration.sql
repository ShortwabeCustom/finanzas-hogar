-- AddColumn phone to User table
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- Add index for WhatsApp lookups (improves performance)
CREATE INDEX "User_phone_idx" ON "User"("phone");
