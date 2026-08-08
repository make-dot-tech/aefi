package io.aefi.rules.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class FactPayload {
	@JsonProperty("schema_version")
	private String schemaVersion;

	private Subject subject;
	private List<Fact> facts = new ArrayList<>();

	@JsonProperty("evidence_types")
	private List<String> evidenceTypes = new ArrayList<>();

	private Coverage coverage = new Coverage();
	private Map<String, Object> context;

	public String getSchemaVersion() {
		return schemaVersion;
	}

	public void setSchemaVersion(String schemaVersion) {
		this.schemaVersion = schemaVersion;
	}

	public Subject getSubject() {
		return subject;
	}

	public void setSubject(Subject subject) {
		this.subject = subject;
	}

	public List<Fact> getFacts() {
		return facts;
	}

	public void setFacts(List<Fact> facts) {
		this.facts = facts != null ? facts : new ArrayList<>();
	}

	public List<String> getEvidenceTypes() {
		return evidenceTypes;
	}

	public void setEvidenceTypes(List<String> evidenceTypes) {
		this.evidenceTypes = evidenceTypes != null ? evidenceTypes : new ArrayList<>();
	}

	public Coverage getCoverage() {
		return coverage;
	}

	public void setCoverage(Coverage coverage) {
		this.coverage = coverage != null ? coverage : new Coverage();
	}

	public Map<String, Object> getContext() {
		return context;
	}

	public void setContext(Map<String, Object> context) {
		this.context = context;
	}

	public static class Subject {
		private String type;
		private String id;

		public String getType() {
			return type;
		}

		public void setType(String type) {
			this.type = type;
		}

		public String getId() {
			return id;
		}

		public void setId(String id) {
			this.id = id;
		}
	}

	public static class Fact {
		private String code;
		private boolean present;
		private String strength;
		private List<String> refs = new ArrayList<>();

		public String getCode() {
			return code;
		}

		public void setCode(String code) {
			this.code = code;
		}

		public boolean isPresent() {
			return present;
		}

		public void setPresent(boolean present) {
			this.present = present;
		}

		public String getStrength() {
			return strength;
		}

		public void setStrength(String strength) {
			this.strength = strength;
		}

		public List<String> getRefs() {
			return refs;
		}

		public void setRefs(List<String> refs) {
			this.refs = refs != null ? refs : new ArrayList<>();
		}
	}

	public static class Coverage {
		private String status = "unknown";

		@JsonProperty("known_gaps")
		private List<String> knownGaps = new ArrayList<>();

		public String getStatus() {
			return status;
		}

		public void setStatus(String status) {
			this.status = status;
		}

		public List<String> getKnownGaps() {
			return knownGaps;
		}

		public void setKnownGaps(List<String> knownGaps) {
			this.knownGaps = knownGaps != null ? knownGaps : new ArrayList<>();
		}
	}
}
