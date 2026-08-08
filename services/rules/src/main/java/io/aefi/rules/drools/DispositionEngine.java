package io.aefi.rules.drools;

import io.aefi.rules.model.DispositionContext;
import io.aefi.rules.model.DispositionResult;
import io.aefi.rules.model.FactPayload;
import org.kie.api.KieServices;
import org.kie.api.builder.KieBuilder;
import org.kie.api.builder.KieFileSystem;
import org.kie.api.builder.Message;
import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;
import org.kie.internal.io.ResourceFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

@Service
public class DispositionEngine {

	@Value("${aefi.confidence-model-version:0.1.0}")
	private String modelVersion;

	private KieContainer kieContainer;

	@PostConstruct
	void init() {
		KieServices ks = KieServices.Factory.get();
		KieFileSystem kfs = ks.newKieFileSystem();
		kfs.write(ResourceFactory.newClassPathResource("rules/disposition.drl"));
		KieBuilder builder = ks.newKieBuilder(kfs).buildAll();
		if (builder.getResults().hasMessages(Message.Level.ERROR)) {
			throw new IllegalStateException("Drools build failed: " + builder.getResults());
		}
		kieContainer = ks.newKieContainer(ks.getRepository().getDefaultReleaseId());
	}

	public DispositionResult dispose(FactPayload payload) {
		DispositionContext ctx = DispositionContext.from(payload, modelVersion);
		KieSession session = kieContainer.newKieSession();
		try {
			session.insert(ctx);
			session.fireAllRules();
			return ctx.getResult();
		} finally {
			session.dispose();
		}
	}
}
