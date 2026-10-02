-- AlterEnum: quote-sent becomes an explicit human action, not automatic on approval
ALTER TYPE "CustomerApprovalStatus" ADD VALUE IF NOT EXISTS 'GENERATED' BEFORE 'SENT';
