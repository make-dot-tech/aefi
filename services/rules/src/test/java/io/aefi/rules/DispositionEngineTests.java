package io.aefi.rules;

import io.aefi.rules.drools.DispositionEngine;
import io.aefi.rules.model.DispositionResult;
import io.aefi.rules.model.FactPayload;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class DispositionEngineTests {

	@Autowired
	DispositionEngine engine;

	@Test
	void unverifiedWhenNoFacts() {
		FactPayload payload = new FactPayload();
		payload.setSchemaVersion("0.1.0");
		FactPayload.Subject subject = new FactPayload.Subject();
		subject.setType("payment");
		subject.setId("pay:1");
		payload.setSubject(subject);
		FactPayload.Coverage cov = new FactPayload.Coverage();
		cov.setStatus("unknown");
		payload.setCoverage(cov);

		DispositionResult result = engine.dispose(payload);
		assertEquals("unverified", result.getConfidence());
		assertTrue(result.getConfidenceReasons().contains("insufficient_evidence"));
	}

	@Test
	void mediumForSettlementOnlyWithAuthGap() {
		FactPayload payload = new FactPayload();
		payload.setSchemaVersion("0.1.0");
		FactPayload.Subject subject = new FactPayload.Subject();
		subject.setType("payment");
		subject.setId("pay:1");
		payload.setSubject(subject);

		FactPayload.Fact fact = new FactPayload.Fact();
		fact.setCode("payment_only_observed");
		fact.setPresent(true);
		fact.setStrength("exact");
		fact.setRefs(List.of("pay:1"));
		payload.setFacts(List.of(fact));

		FactPayload.Coverage cov = new FactPayload.Coverage();
		cov.setStatus("minimal");
		cov.setKnownGaps(List.of("authorization_evidence_missing"));
		payload.setCoverage(cov);

		DispositionResult result = engine.dispose(payload);
		assertEquals("medium", result.getConfidence());
		assertTrue(result.getConfidenceReasons().contains("payment_only_observed"));
		assertTrue(result.getConfidenceReasons().contains("authorization_evidence_missing"));
	}
}
