-- CreateTable
CREATE TABLE "user_responsibilities" (
    "userId" TEXT NOT NULL,
    "responsibilityId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_responsibilities_pkey" PRIMARY KEY ("userId","responsibilityId")
);

-- AddForeignKey
ALTER TABLE "user_responsibilities" ADD CONSTRAINT "user_responsibilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_responsibilities" ADD CONSTRAINT "user_responsibilities_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "responsibilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
