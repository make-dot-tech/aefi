package io.aefi.rules.drools;

import io.aefi.rules.model.DispositionContext;

/**
 * Salience-ordered disposition policy (Drools then-block / direct call).
 * Mirrors Wave A TS composer semantics with controlled reason codes.
 */
public final class DispositionPolicies {

	private DispositionPolicies() {
	}

	public static void apply(DispositionContext ctx) {
		if (ctx.isResolved()) {
			return;
		}
		if (ctx.getPresentCount() == 0) {
			ctx.resolve("unverified");
			if (ctx.getResult().getConfidenceReasons().isEmpty()) {
				ctx.getResult().addReason("insufficient_evidence");
			}
			return;
		}

		if (ctx.isHasExactStrength()
				&& !ctx.isCoverageMinimal()
				&& (!ctx.isOnlyPaymentObserved() || !ctx.isHasGaps())) {
			ctx.resolve("high");
			return;
		}

		if (ctx.isHasExactStrength() && ctx.isOnlyPaymentObserved() && ctx.isHasGaps()) {
			ctx.resolve("medium");
			return;
		}

		if (ctx.isHasExactStrength() || ctx.isHasStrongStrength()) {
			ctx.resolve("medium");
			return;
		}

		ctx.resolve("low");
	}
}
