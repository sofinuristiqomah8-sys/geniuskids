import CreateWizard from "@/components/create/CreateWizard";
import AppHeader from "@/components/ui/AppHeader";
import { t } from "@/lib/i18n";

export default function CreatePage() {
  return (
    <main className="min-h-[100dvh] bg-surface">
      <AppHeader backHref="/" title={t("header.createTitle")} />
      <CreateWizard />
    </main>
  );
}
