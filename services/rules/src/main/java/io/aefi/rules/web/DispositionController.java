package io.aefi.rules.web;

import io.aefi.rules.drools.DispositionEngine;
import io.aefi.rules.model.DispositionResult;
import io.aefi.rules.model.FactPayload;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
public class DispositionController {

	private final DispositionEngine engine;

	public DispositionController(DispositionEngine engine) {
		this.engine = engine;
	}

	@GetMapping("/health")
	public Health health() {
		return new Health("ok", "aefi-rules");
	}

	@PostMapping(path = "/v1/disposition", consumes = MediaType.APPLICATION_JSON_VALUE)
	public DispositionResult dispose(@RequestBody FactPayload payload) {
		return engine.dispose(payload);
	}

	public record Health(String status, String service) {
	}
}
