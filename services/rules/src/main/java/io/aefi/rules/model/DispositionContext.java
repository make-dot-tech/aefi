package io.aefi.rules.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Working-memory fact for Drools. Built from FactPayload; rules mutate result.
 */
public class DispositionContext {
	private FactPayload payload;
	private DispositionResult result = new DispositionResult();
	private int presentCount;
	private boolean hasExactStrength;
	private boolean hasStrongStrength;
	private boolean onlyPaymentObserved;
	private boolean authGap;
	private boolean hasGaps;
	private String coverageStatus = "unknown";
	private List<String> presentCodes = new ArrayList<>();
	private boolean resolved;

	public static DispositionContext from(FactPayload payload, String modelVersion) {
		DispositionContext ctx = new DispositionContext();
		ctx.payload = payload;
		ctx.result.setConfidenceModelVersion(modelVersion);

		List<FactPayload.Fact> facts = payload.getFacts() != null ? payload.getFacts() : List.of();
		int present = 0;
		boolean exact = false;
		boolean strong = false;
		boolean onlyPayment = true;
		List<String> codes = new ArrayList<>();
		for (FactPayload.Fact f : facts) {
			if (!f.isPresent()) {
				continue;
			}
			present++;
			codes.add(f.getCode());
			if ("exact".equalsIgnoreCase(f.getStrength())) {
				exact = true;
			}
			if ("strong".equalsIgnoreCase(f.getStrength())) {
				strong = true;
			}
			if (!"payment_only_observed".equals(f.getCode())) {
				onlyPayment = false;
			}
		}
		if (present == 0) {
			onlyPayment = false;
		}

		ctx.presentCount = present;
		ctx.hasExactStrength = exact;
		ctx.hasStrongStrength = strong;
		ctx.onlyPaymentObserved = onlyPayment;
		ctx.presentCodes = codes;

		FactPayload.Coverage cov = payload.getCoverage() != null ? payload.getCoverage() : new FactPayload.Coverage();
		String status = cov.getStatus() != null ? cov.getStatus() : "unknown";
		if ("unknown".equals(status) && present > 0) {
			status = "partial";
		}
		ctx.coverageStatus = status;
		ctx.authGap = cov.getKnownGaps() != null
				&& cov.getKnownGaps().contains("authorization_evidence_missing");
		ctx.hasGaps = cov.getKnownGaps() != null && !cov.getKnownGaps().isEmpty();

		for (String code : codes) {
			ctx.result.addReason(code);
		}
		if (ctx.authGap) {
			ctx.result.addReason("authorization_evidence_missing");
		}
		return ctx;
	}

	public FactPayload getPayload() {
		return payload;
	}

	public DispositionResult getResult() {
		return result;
	}

	public int getPresentCount() {
		return presentCount;
	}

	public boolean isHasExactStrength() {
		return hasExactStrength;
	}

	public boolean isHasStrongStrength() {
		return hasStrongStrength;
	}

	public boolean isOnlyPaymentObserved() {
		return onlyPaymentObserved;
	}

	public boolean isAuthGap() {
		return authGap;
	}

	public boolean isHasGaps() {
		return hasGaps;
	}

	public String getCoverageStatus() {
		return coverageStatus;
	}

	public boolean isCoverageMinimal() {
		return "minimal".equals(coverageStatus);
	}

	public List<String> getPresentCodes() {
		return presentCodes;
	}

	public boolean isResolved() {
		return resolved;
	}

	public void resolve(String confidence) {
		this.result.setConfidence(confidence);
		this.resolved = true;
	}
}
