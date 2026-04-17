import { PasswordGate } from "@/components/PasswordGate";
import { QuotesPage } from "@/components/quotes/QuotesPage";

export default function PreventiviPage() {
  return (
    <PasswordGate>
      <QuotesPage />
    </PasswordGate>
  );
}
