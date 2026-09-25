import { AdminExperience } from "../legacy/pages/AdminExperience";
import { LegacyShell, useLegacyViewChange } from "../components/LegacyShell";

/**
 * Admin entry. AdminExperience self-gates via AdminLogin and the existing
 * app_metadata.role check — no Hub-side auth logic added.
 */
export function Admin() {
  const onViewChange = useLegacyViewChange();
  return (
    <LegacyShell>
      <AdminExperience
        view="admin"
        onViewChange={onViewChange}
        onBack={() => onViewChange("Rider")}
      />
    </LegacyShell>
  );
}
