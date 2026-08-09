import type {
  AefiEnvelope,
  ExplainResult,
  ExplainStep,
  VerifyResult,
} from "../lib/types";
import { ConfidencePanel } from "./ConfidencePanel";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { EvidencePath } from "./EvidencePath";
import { ExplorerLink } from "./ExplorerLink";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { VerifyPanel } from "./VerifyPanel";

interface Props {
  loading: boolean;
  explainHash: string | null;
  explain: AefiEnvelope<ExplainResult> | null;
  verify: AefiEnvelope<VerifyResult> | null;
  verifyBusy: boolean;
  steps: ExplainStep[];
  stepIdx: number | null;
  onSelectStep: (index: number | null) => void;
  onVerify: () => void;
  onClose: () => void;
}

export function SettlementModal({
  loading,
  explainHash,
  explain,
  verify,
  verifyBusy,
  steps,
  stepIdx,
  onSelectStep,
  onVerify,
  onClose,
}: Props) {
  return (
    <Modal
      title="Settlement evidence"
      size="lg"
      elevated
      onClose={onClose}
      subtitle={
        explainHash ? (
          <ExplorerLink value={explainHash} kind="tx" />
        ) : null
      }
    >
      {loading && !explain ? (
        <div className="loading-panel explain-loading">
          <Spinner size="md" label="Loading settlement evidence" />
        </div>
      ) : null}

      {explain ? (
        <>
          <EvidencePath
            steps={steps}
            selectedIndex={stepIdx}
            onSelect={onSelectStep}
          />
          <div className="result-grid">
            <ConfidencePanel envelope={explain} />
            <VerifyPanel
              envelope={verify}
              loading={verifyBusy}
              onVerify={onVerify}
            />
          </div>
          <EvidenceDrawer
            step={stepIdx != null ? steps[stepIdx] ?? null : null}
            evidence={explain.evidence}
            onClose={() => onSelectStep(null)}
          />
        </>
      ) : null}
    </Modal>
  );
}
