import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDonorSosEmailHTML, buildDonorConfirmedDetailsEmailHTML } from "../src/lib/email";

describe("Email Privacy Gate", () => {
  it("pre-approval donor email contains ZERO requester PII", () => {
    const { html, text } = buildDonorSosEmailHTML({
      donorName: "Test Donor",
      bloodType: "O-",
      units: 2,
      component: "Whole Blood",
      hospitalName: "Fortis Hospital",
      hospitalArea: "Shalimar Bagh",
      hospitalCity: "Delhi",
      urgencyLevel: "critical",
      trackingCode: "BLD-2026-TEST001",
    });

    const combined = html + text;
    const piiKeys = ["requester_name", "requester_phone", "requester_email", "patient_age", "patient_gender", "uhid", "additional_notes", "patient_name"];
    for (const key of piiKeys) {
      assert.ok(!combined.includes(key), `Pre-approval email must not contain PII key: ${key}`);
    }
    // Also check that no actual PII values leak
    assert.ok(!combined.includes("Jane Doe"), "Must not contain requester name");
    assert.ok(!combined.includes("9876543210"), "Must not contain requester phone");
  });
});

describe("Email Templates", () => {
  it("SOS email accepts all new optional fields (hospitalPincode, distanceKm, expiresAt)", () => {
    const result = buildDonorSosEmailHTML({
      donorName: "Test Donor",
      bloodType: "O-",
      units: 2,
      component: "Whole Blood",
      hospitalName: "Fortis Hospital",
      hospitalArea: "Shalimar Bagh",
      hospitalCity: "Delhi",
      urgencyLevel: "critical",
      trackingCode: "BLD-2026-TEST001",
      hospitalPincode: "110034",
      distanceKm: 5.2,
      expiresAt: "2026-08-26T12:00:00Z",
    });
    assert.ok(result.subject.includes("FindMyDonor"), "Subject should contain [FindMyDonor]");
    assert.ok(result.html.includes("110034"), "HTML should contain pincode");
    assert.ok(result.text.includes("110034"), "Text should contain pincode");
    assert.ok(result.text.includes("5.2"), "Text should contain distance");
  });

  it("confirmed-details email includes coordinator contact section", () => {
    const result = buildDonorConfirmedDetailsEmailHTML({
      patient_name: "Rahul Kumar",
      attending_doctor: "Dr. Sharma",
      requester_name: "Priya Singh",
      requester_phone: "9876543210",
      blood_type_needed: "O-",
      hospital_name: "Fortis Hospital",
      hospital_area: "Shalimar Bagh",
      hospital_city: "Delhi",
      tracking_code: "BLD-2026-TEST001",
    }, "Test Donor");
    assert.ok(result.html.includes("Coordinator Contact"), "Should have coordinator section");
    assert.ok(result.html.includes("Priya Singh"), "Should contain requester name");
    assert.ok(result.html.includes("9876543210"), "Should contain requester phone");
    assert.ok(result.html.includes("Dr. Sharma"), "Should contain doctor name");
  });

  it("confirmed-details email gracefully omits doctor when not provided", () => {
    const result = buildDonorConfirmedDetailsEmailHTML({
      patient_name: "Rahul Kumar",
      requester_name: "Priya Singh",
      requester_phone: "9876543210",
      blood_type_needed: "O-",
      hospital_name: "Fortis Hospital",
      hospital_area: "Shalimar Bagh",
      hospital_city: "Delhi",
      tracking_code: "BLD-2026-TEST001",
    }, "Test Donor");
    assert.ok(!result.html.includes("Attending Doctor"), "Should not have doctor row");
  });
});
