import { Sparkles } from "lucide-react";

export default function LoadingState({ label = "Loading your workspace" }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="kivo-loader">
        <span /><span /><span />
        <Sparkles />
      </div>
      <strong>{label}</strong>
    </div>
  );
}
