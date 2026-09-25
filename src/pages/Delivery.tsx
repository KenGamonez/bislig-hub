import { useNavigate } from "react-router-dom";
import { PaDeliverExperience } from "../legacy/pages/PaDeliverExperience";
import { LegacyShell } from "../components/LegacyShell";

/** Customer Delivery — ported working Bislig Ride flow, Hub-branded shell. */
export function Delivery() {
  const navigate = useNavigate();
  return (
    <LegacyShell>
      <PaDeliverExperience onBack={() => navigate("/")} />
    </LegacyShell>
  );
}
