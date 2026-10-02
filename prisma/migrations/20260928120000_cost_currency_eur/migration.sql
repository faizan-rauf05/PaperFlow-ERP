-- Allow material cost prices to be entered in EUR (converted to KWD via the
-- server-fetched EUR->KWD rate, same as USD).
ALTER TYPE "CostCurrency" ADD VALUE 'EUR';
