import { Link } from "react-router-dom";

export function WorkspaceSessionNote() {
  return (
    <p className="workspace-session-note">
      Scenario edits, context selections, and data requests stay in this tab until you reload or close it.{" "}
      <Link to="/brief#brief-export-actions">Export a copy from the Planning Brief</Link> for your records.
      To resume in a fresh tab, re-enter your settings in the workspace.
    </p>
  );
}
