package io.aefi.rules.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class DispositionResult {
	private String confidence = "unverified";

	@JsonProperty("confidence_reasons")
	private List<String> confidenceReasons = new ArrayList<>();

	@JsonProperty("confidence_model_version")
	private String confidenceModelVersion;

	@JsonProperty("mandate_status")
	private String mandateStatus;

	@JsonProperty("task_status")
	private String taskStatus;

	@JsonProperty("overall_status")
	private String overallStatus;

	public String getConfidence() {
		return confidence;
	}

	public void setConfidence(String confidence) {
		this.confidence = confidence;
	}

	public List<String> getConfidenceReasons() {
		return confidenceReasons;
	}

	public void setConfidenceReasons(List<String> confidenceReasons) {
		this.confidenceReasons = confidenceReasons != null ? confidenceReasons : new ArrayList<>();
	}

	public void addReason(String reason) {
		if (reason != null && !confidenceReasons.contains(reason)) {
			confidenceReasons.add(reason);
		}
	}

	public String getConfidenceModelVersion() {
		return confidenceModelVersion;
	}

	public void setConfidenceModelVersion(String confidenceModelVersion) {
		this.confidenceModelVersion = confidenceModelVersion;
	}

	public String getMandateStatus() {
		return mandateStatus;
	}

	public void setMandateStatus(String mandateStatus) {
		this.mandateStatus = mandateStatus;
	}

	public String getTaskStatus() {
		return taskStatus;
	}

	public void setTaskStatus(String taskStatus) {
		this.taskStatus = taskStatus;
	}

	public String getOverallStatus() {
		return overallStatus;
	}

	public void setOverallStatus(String overallStatus) {
		this.overallStatus = overallStatus;
	}
}
