import { authenticatedApi } from './api';
import { escapeHtml } from "../../helpers/html";

/**
 * Email delivery via the authenticated server-side /api/send-email route.
 */
export async function sendRealEmail(to: string, subject: string, text: string): Promise<boolean> {
  try {
    await authenticatedApi<{ success: boolean }>('/api/send-email', { to, subject, text });
    return true;
  } catch (error) {
    console.error('[Email Service] Exception:', error);
    return false;
  }
}

/** Build rich HTML email for donor SOS alert (pre-approval tier — ZERO requester PII) */
export function buildDonorSosEmailHTML(params: {
  donorName: string;
  bloodType: string;
  units: number;
  component: string;
  hospitalName: string;
  hospitalArea: string;
  hospitalCity: string;
  urgencyLevel: string;
  trackingCode: string;
  hospitalPincode?: string;
  distanceKm?: number;
  expiresAt?: string;
}): { subject: string; html: string; text: string } {
  const urgencyColor = params.urgencyLevel === 'critical' ? '#dc2626' : params.urgencyLevel === 'urgent' ? '#d97706' : '#16a34a';
  const urgencyLabel = params.urgencyLevel.toUpperCase();
  const firstName = escapeHtml(params.donorName.split(' ')[0]);
  const safeBloodType = escapeHtml(params.bloodType);
  const safeComponent = escapeHtml(params.component);
  const safeHospital = escapeHtml(params.hospitalName);
  const safeArea = escapeHtml(params.hospitalArea);
  const safeCity = escapeHtml(params.hospitalCity);
  const safeCode = escapeHtml(params.trackingCode);
  const safePincode = params.hospitalPincode ? escapeHtml(params.hospitalPincode) : '';
  const distLine = params.distanceKm != null ? `\nDistance: ~${params.distanceKm} km` : '';
  const expiryLine = params.expiresAt ? `\nNeeded by: ${params.expiresAt}` : '';

  const subject = `[FindMyDonor] Urgent need: ${params.bloodType} @ ${params.hospitalName} — can you save a life?`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8f8f8;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">FindMyDonor — Blood Donation Network</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Real-Time Blood Donation Network</p>
    </div>

    <!-- Urgency badge -->
    <div style="background:${urgencyColor};color:#fff;text-align:center;padding:10px;font-size:13px;font-weight:700;letter-spacing:1px;">
      ${urgencyLabel} REQUEST — IMMEDIATE RESPONSE NEEDED
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="font-size:16px;color:#111;margin:0 0 20px;">Hi <strong>${firstName}</strong>,</p>
      <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 24px;">
        A patient urgently needs blood that matches your type. You are within range and eligible to donate. Please respond as soon as possible.
      </p>

      <!-- Request details card -->
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#888;font-size:13px;width:140px;">Blood Group</td><td style="padding:6px 0;font-weight:700;font-size:18px;color:#dc2626;">${safeBloodType}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Units Needed</td><td style="padding:6px 0;font-weight:600;color:#111;">${params.units}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Component</td><td style="padding:6px 0;font-weight:600;color:#111;">${safeComponent}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Hospital</td><td style="padding:6px 0;font-weight:600;color:#111;">${safeHospital}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Location</td><td style="padding:6px 0;font-weight:600;color:#111;">${safeArea}, ${safeCity}${safePincode ? ' — ' + safePincode : ''}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Request ID</td><td style="padding:6px 0;font-family:monospace;font-size:13px;color:#555;">${safeCode}</td></tr>
        </table>
      </div>

      <!-- CTA buttons -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="https://findmydonor.online/donor-dashboard" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:15px;margin:0 8px 12px;">
          Accept Request
        </a>
        <a href="https://findmydonor.online/tracking?code=${safeCode}" style="display:inline-block;background:#f3f4f6;color:#374151;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:600;font-size:15px;margin:0 8px 12px;">
          Track Request
        </a>
      </div>

      <p style="font-size:13px;color:#888;text-align:center;margin:0;">
        If you cannot donate, please log into your donor dashboard and decline so we can find another match quickly.
      </p>
    </div>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;">

    <!-- Hindi Section -->
    <div style="padding:32px;background:#fafafa;">
      <p style="font-size:16px;color:#111;margin:0 0 20px;">नमस्ते <strong>${firstName}</strong>,</p>
      <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 24px;">
        एक मरीज को तत्काल आपके रक्त समूह से मेल खाने वाले रक्त की आवश्यकता है। आप क्षेत्र में हैं और रक्तदान के लिए पात्र हैं। कृपया जितनी जल्दी हो सके उत्तर दें।
      </p>

      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#888;font-size:13px;width:140px;">रक्त समूह</td><td style="padding:6px 0;font-weight:700;font-size:18px;color:#dc2626;">${safeBloodType}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">आवश्यक यूनिट</td><td style="padding:6px 0;font-weight:600;color:#111;">${params.units}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">घटक</td><td style="padding:6px 0;font-weight:600;color:#111;">${safeComponent}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">अस्पताल</td><td style="padding:6px 0;font-weight:600;color:#111;">${safeHospital}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">स्थान</td><td style="padding:6px 0;font-weight:600;color:#111;">${safeArea}, ${safeCity}${safePincode ? ' — ' + safePincode : ''}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">अनुरोध आईडी</td><td style="padding:6px 0;font-family:monospace;font-size:13px;color:#555;">${safeCode}</td></tr>
        </table>
      </div>

      <div style="text-align:center;margin-bottom:28px;">
        <a href="https://findmydonor.online/donor-dashboard" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:15px;margin:0 8px 12px;">
          अनुरोध स्वीकारें
        </a>
        <a href="https://findmydonor.online/tracking?code=${safeCode}" style="display:inline-block;background:#f3f4f6;color:#374151;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:600;font-size:15px;margin:0 8px 12px;">
          अनुरोध ट्रैक करें
        </a>
      </div>

      <p style="font-size:13px;color:#888;text-align:center;margin:0;">
        यदि आप रक्तदान नहीं कर सकते, तो कृपया अस्वीकार करें ताकि हमें अन्य मैच मिल सके।
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#111;color:rgba(255,255,255,0.5);text-align:center;padding:20px 32px;font-size:12px;">
      <p style="margin:0 0 6px;">FindMyDonor — Free Community Blood Donation Network</p>
      <p style="margin:0;">You received this because you are a verified donor. <a href="https://findmydonor.online" style="color:rgba(255,255,255,0.7);">Manage preferences</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `URGENT BLOOD REQUEST — FindMyDonor\n\nHi ${params.donorName},\n\nBlood Type: ${params.bloodType}\nUnits: ${params.units}\nComponent: ${params.component}\nHospital: ${params.hospitalName}, ${params.hospitalArea}, ${params.hospitalCity}${safePincode ? ' — ' + safePincode : ''}\nUrgency: ${urgencyLabel}${distLine}${expiryLine}\nRequest ID: ${params.trackingCode}\n\nLog in to accept: https://findmydonor.online/donor-dashboard\nTrack: https://findmydonor.online/tracking?code=${params.trackingCode}\n\n---\n\nतत्काल रक्त अनुरोध — FindMyDonor\n\nनमस्ते ${params.donorName},\n\nरक्त समूह: ${params.bloodType}\nआवश्यक यूनिट: ${params.units}\nघटक: ${params.component}\nअस्पताल: ${params.hospitalName}, ${params.hospitalArea}, ${params.hospitalCity}${safePincode ? ' — ' + safePincode : ''}\nतत्कालता: ${urgencyLabel}${distLine}${expiryLine}\nअनुरोध आईडी: ${params.trackingCode}\n\nस्वीकार करने के लिए लॉग इन करें: https://findmydonor.online/donor-dashboard\nट्रैक: https://findmydonor.online/tracking?code=${params.trackingCode}`;

  return { subject, html, text };
}

/**
 * Build post-approval email sent to donor after they accept — includes requester
 * (coordinator) contact details. Only sent when match.contact_shared_at is set.
 */
export function buildDonorConfirmedDetailsEmailHTML(request: {
  patient_name?: string;
  attending_doctor?: string;
  requester_name: string;
  requester_phone: string;
  blood_type_needed: string;
  hospital_name: string;
  hospital_area: string;
  hospital_city: string;
  tracking_code: string;
  component_needed?: string;
}, donorName: string): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(donorName.split(' ')[0]);
  const patientName = escapeHtml(request.patient_name || 'N/A');
  const doctor = request.attending_doctor ? escapeHtml(request.attending_doctor) : '';
  const coordName = escapeHtml(request.requester_name);
  const coordPhone = escapeHtml(request.requester_phone);
  const bloodType = escapeHtml(request.blood_type_needed);
  const hospital = escapeHtml(request.hospital_name);
  const area = escapeHtml(request.hospital_area);
  const city = escapeHtml(request.hospital_city);
  const code = escapeHtml(request.tracking_code);
  const component = escapeHtml(request.component_needed || 'Whole Blood');
  const mapsQuery = encodeURIComponent(`${request.hospital_name}, ${request.hospital_area || ''}, ${request.hospital_city || ''}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const subject = `[FindMyDonor] Donation confirmed — ${request.blood_type_needed} at ${request.hospital_name}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8f8f8;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#16a34a,#166534);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Donation Confirmed</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:16px;color:#111;margin:0 0 16px;">Hi <strong>${firstName}</strong>, thank you for accepting! You are a hero.</p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#888;font-size:13px;width:160px;">Patient Name</td><td style="padding:6px 0;font-weight:600;color:#111;">${patientName}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Blood Type</td><td style="padding:6px 0;font-weight:700;font-size:16px;color:#dc2626;">${bloodType}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Component</td><td style="padding:6px 0;font-weight:600;color:#111;">${component}</td></tr>
          ${doctor ? `<tr><td style="padding:6px 0;color:#888;font-size:13px;">Attending Doctor</td><td style="padding:6px 0;font-weight:600;color:#111;">${doctor}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Hospital</td><td style="padding:6px 0;font-weight:600;color:#111;">${hospital}, ${area}, ${city}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Request ID</td><td style="padding:6px 0;font-family:monospace;font-size:13px;color:#555;">${code}</td></tr>
        </table>
      </div>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-weight:700;color:#1e40af;font-size:14px;">Coordinator Contact</p>
        <p style="margin:0;font-size:15px;color:#111;"><strong>${coordName}</strong></p>
        <p style="margin:4px 0 0;font-size:15px;color:#111;">Phone: <a href="tel:${coordPhone}" style="color:#2563eb;">${coordPhone}</a></p>
        ${request.requester_phone ? `<p style="margin:12px 0 0;"><a href="https://wa.me/${request.requester_phone.replace(/\D/g, '')}" style="display:inline-block;background:#25d366;color:#fff;text-decoration:none;padding:10px 24px;border-radius:50px;font-weight:600;font-size:14px;">Message on WhatsApp</a></p>` : ''}
      </div>

      <div style="text-align:center;margin-bottom:24px;">
        <a href="${mapsUrl}" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:15px;margin:0 8px 12px;">
          Get Directions
        </a>
        <a href="https://findmydonor.online/tracking?code=${code}" style="display:inline-block;background:#f3f4f6;color:#374151;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:600;font-size:15px;margin:0 8px 12px;">
          Track Request
        </a>
      </div>
    </div>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;">

    <!-- Hindi Section — mirrors SOS stacked pattern -->
    <div style="padding:32px;background:#fafafa;">
      <p style="font-size:16px;color:#111;margin:0 0 16px;">नमस्ते <strong>${firstName}</strong>, धन्यवाद! आप नायक हैं।</p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#888;font-size:13px;width:160px;">मरीज का नाम</td><td style="padding:6px 0;font-weight:600;color:#111;">${patientName}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">रक्त समूह</td><td style="padding:6px 0;font-weight:700;font-size:16px;color:#dc2626;">${bloodType}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">घटक</td><td style="padding:6px 0;font-weight:600;color:#111;">${component}</td></tr>
          ${doctor ? `<tr><td style="padding:6px 0;color:#888;font-size:13px;">उपचार करने वाले डॉक्टर</td><td style="padding:6px 0;font-weight:600;color:#111;">${doctor}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">अस्पताल</td><td style="padding:6px 0;font-weight:600;color:#111;">${hospital}, ${area}, ${city}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">अनुरोध आईडी</td><td style="padding:6px 0;font-family:monospace;font-size:13px;color:#555;">${code}</td></tr>
        </table>
      </div>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-weight:700;color:#1e40af;font-size:14px;">समन्वयक संपर्क</p>
        <p style="margin:0;font-size:15px;color:#111;"><strong>${coordName}</strong></p>
        <p style="margin:4px 0 0;font-size:15px;color:#111;">फ़ोन: <a href="tel:${coordPhone}" style="color:#2563eb;">${coordPhone}</a></p>
        ${request.requester_phone ? `<p style="margin:12px 0 0;"><a href="https://wa.me/${request.requester_phone.replace(/\D/g, '')}" style="display:inline-block;background:#25d366;color:#fff;text-decoration:none;padding:10px 24px;border-radius:50px;font-weight:600;font-size:14px;">व्हाट्सएप पर संदेश भेजें</a></p>` : ''}
      </div>

      <div style="text-align:center;margin-bottom:24px;">
        <a href="${mapsUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:15px;margin:0 8px 12px;">
          दिशा-निर्देश प्राप्त करें
        </a>
        <a href="https://findmydonor.online/tracking?code=${code}" style="display:inline-block;background:#f3f4f6;color:#374151;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:600;font-size:15px;margin:0 8px 12px;">
          अनुरोध ट्रैक करें
        </a>
      </div>
    </div>

    <div style="background:#111;color:rgba(255,255,255,0.5);text-align:center;padding:16px;font-size:12px;">
      FindMyDonor — Free Community Blood Donation Network
    </div>
  </div>
</body>
</html>`;

  const text = `DONATION CONFIRMED — FindMyDonor\n\nHi ${firstName},\n\nThank you for accepting! Here are the details:\n\nPatient: ${request.patient_name || 'N/A'}\nBlood Type: ${request.blood_type_needed}\nComponent: ${request.component_needed || 'Whole Blood'}\n${doctor ? `Doctor: ${request.attending_doctor}\n` : ''}Hospital: ${request.hospital_name}, ${request.hospital_area}, ${request.hospital_city}\nRequest ID: ${request.tracking_code}\n\nCoordinator Contact: ${request.requester_name} — Phone: ${request.requester_phone}\n\nDirections: ${mapsUrl}\nTrack: https://findmydonor.online/tracking?code=${request.tracking_code}\n\nFindMyDonor — Free Community Blood Donation Network`;

  return { subject, html, text };
}

/** Email to requester when a donor is confirmed */
export function buildRequesterConfirmEmailHTML(params: {
  requesterName: string;
  donorName: string;
  bloodType: string;
  trackingCode: string;
  hospitalName: string;
}): { subject: string; html: string; text: string } {
  const subject = `✅ Donor Confirmed — ${params.bloodType} · Request ${params.trackingCode}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8f8f8;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#16a34a,#166534);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">✅ Donor Confirmed</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:16px;color:#111;">Hi <strong>${params.requesterName}</strong>,</p>
      <p style="font-size:15px;color:#444;line-height:1.6;">
        Great news! <strong>${params.donorName}</strong> has confirmed they will donate <strong>${params.bloodType}</strong> blood for request <code>${params.trackingCode}</code> at ${params.hospitalName}.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="https://findmydonor.online/tracking?code=${params.trackingCode}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#166534);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:15px;">
          📍 Track Live
        </a>
      </div>
    </div>
    <div style="background:#111;color:rgba(255,255,255,0.5);text-align:center;padding:16px;font-size:12px;">
      FindMyDonor™ — Free Community Blood Donation Network
    </div>
  </div>
</body>
</html>`;

  const text = `Donor Confirmed — FindMyDonor™\n\nHi ${params.requesterName},\n${params.donorName} has confirmed your ${params.bloodType} request (${params.trackingCode}) at ${params.hospitalName}.\n\nTrack: https://findmydonor.online/tracking?code=${params.trackingCode}`;
  return { subject, html, text };
}

/** Email OTP Template */
export function buildEmailOtpHTML(otp: string): { subject: string; html: string; text: string } {
  const subject = `🔒 Your FindMyDonor™ Verification Code: ${otp}`;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8f8f8;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Verify Your Account</h1>
    </div>
    <div style="padding:32px;text-align:center;">
      <p style="font-size:16px;color:#111;">Please use the following 6-digit code to complete your registration:</p>
      <div style="margin:28px auto;background:#f3f4f6;border-radius:12px;padding:16px;letter-spacing:6px;font-size:32px;font-weight:800;color:#111;width:fit-content;font-family:monospace;">
        ${otp}
      </div>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        This code is valid for 5 minutes. If you did not request this, you can safely ignore this email.
      </p>
    </div>
    <div style="background:#111;color:rgba(255,255,255,0.5);text-align:center;padding:16px;font-size:12px;">
      FindMyDonor™ — Free Community Blood Donation Network<br/>
      Sent by official@findmydonor.online
    </div>
  </div>
</body>
</html>`;

  const text = `Your FindMyDonor™ Verification Code is: ${otp}\n\nThis code is valid for 5 minutes.\n\nSent by official@findmydonor.online`;
  return { subject, html, text };
}

/** Registration Welcome Template */
export function buildWelcomeEmailHTML(params: { name: string; type: 'donor' | 'requester' | 'institution'; bloodType?: string; city?: string; pincode?: string }): { subject: string; html: string; text: string } {
  const subject = `Welcome to FindMyDonor™! 🎉`;
  const safeName = escapeHtml(params.name.split(' ')[0]);
  const safeFullName = escapeHtml(params.name);
  const safeBloodType = escapeHtml(params.bloodType || '');
  const safeCity = escapeHtml(params.city || '');
  const safePincode = escapeHtml(params.pincode || '');
  const ctaUrl = params.type === 'institution' ? 'https://findmydonor.online/institution/login' : 'https://findmydonor.online';
  const ctaLabel = params.type === 'institution' ? 'Sign In to Your Institution' : 'Go to Dashboard';
  
  const donorBody = `Thank you for registering as a volunteer donor with FindMyDonor™! Your profile for blood group <strong>${safeBloodType}</strong> is now active in <strong>${safeCity}</strong>. You will receive alerts if patients in pincode <strong>${safePincode}</strong> or adjacent areas need your blood. Your contact remains completely private until you explicitly consent.`;
  const requesterBody = `Thank you for joining FindMyDonor™! You can now request emergency blood matching anywhere in Delhi NCR. Verified donors will be instantly notified in real-time.`;
  const institutionBody = `Thank you for registering <strong>${safeFullName}</strong> with FindMyDonor™! We have received your application, and it is now <strong>pending review</strong> by our administrative team — every institution is manually verified before it is activated. You will be notified by email with a sign-in link as soon as your institution is approved, after which you can sign in to your dashboard to post blood requests, manage donor camps, and track request activity.`;
  
  const body = params.type === 'donor' ? donorBody : params.type === 'requester' ? requesterBody : institutionBody;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8f8f8;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Welcome to FindMyDonor™</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:16px;color:#111;">Hi <strong>${safeName}</strong>,</p>
      <p style="font-size:15px;color:#444;line-height:1.6;">
        ${body}
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:15px;">
          ${ctaLabel}
        </a>
      </div>
    </div>
    <div style="background:#111;color:rgba(255,255,255,0.5);text-align:center;padding:16px;font-size:12px;">
      FindMyDonor™ — Free Community Blood Donation Network<br/>
      Sent by official@findmydonor.online
    </div>
  </div>
</body>
</html>`;

  const text = `Welcome to FindMyDonor™, ${params.name}!\n\n${
    params.type === 'donor' ? donorBody.replace(/<[^>]*>?/gm, '')
    : params.type === 'requester' ? requesterBody
    : institutionBody.replace(/<[^>]*>?/gm, '')
  }\n\n${
    params.type === 'institution' ? 'Sign In to Your Institution: https://findmydonor.online/institution/login'
    : 'Go to Dashboard: https://findmydonor.online'
  }\n\nSent by official@findmydonor.online`;
  return { subject, html, text };
}

/** Empathy Welcome email — sent to requesters immediately after request creation */
export function buildRequesterEmpathyEmailHTML(params: {
  requesterName: string;
  bloodType: string;
  units: number;
  hospitalName: string;
  trackingCode: string;
}): { subject: string; html: string; text: string } {
  const safeRequester = escapeHtml(params.requesterName.split(' ')[0]);
  const safeBloodType = escapeHtml(params.bloodType);
  const safeHospital = escapeHtml(params.hospitalName);
  const safeCode = escapeHtml(params.trackingCode);
  const safeUnits = escapeHtml(String(params.units));
  const subject = `❤️ We're looking out for you — Request ${params.trackingCode}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8f8f8;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">🩸 FindMyDonor™</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">We're with you. Always.</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="font-size:16px;color:#111;">Dear <strong>${safeRequester}</strong>,</p>
      <p style="font-size:15px;color:#444;line-height:1.7;">
        We have received your request for <strong>${safeUnits} unit${params.units > 1 ? 's' : ''} of ${safeBloodType}</strong> blood at <strong>${safeHospital}</strong>.
      </p>
      <p style="font-size:15px;color:#444;line-height:1.7;">
        Our system is <strong>actively searching</strong> for compatible, verified donors near the hospital right now. You will receive another email the moment a matching donor confirms their availability.
      </p>

      <!-- Status Card -->
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin:24px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;font-size:14px;color:#666;">Tracking Code</td><td style="padding:6px 0;font-size:14px;font-weight:700;color:#111;text-align:right;">${safeCode}</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#666;">Blood Type</td><td style="padding:6px 0;font-size:14px;font-weight:700;color:#dc2626;text-align:right;">${safeBloodType}</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#666;">Units Needed</td><td style="padding:6px 0;font-size:14px;font-weight:700;color:#111;text-align:right;">${safeUnits}</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#666;">Hospital</td><td style="padding:6px 0;font-size:14px;font-weight:700;color:#111;text-align:right;">${safeHospital}</td></tr>
        </table>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:28px 0;">
        <a href="https://findmydonor.online/tracking?code=${safeCode}" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:15px;">
          📍 Track Your Request Live
        </a>
      </div>

      <p style="font-size:14px;color:#888;line-height:1.6;text-align:center;">
        Stay strong. We're working to connect you with a donor as quickly as possible. ❤️
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#111;color:rgba(255,255,255,0.5);text-align:center;padding:16px;font-size:12px;">
      FindMyDonor™ — Free Community Blood Donation Network<br/>
      Sent by official@findmydonor.online
    </div>
  </div>
</body>
</html>`;

  const text = `Dear ${params.requesterName},\n\nWe have received your request for ${params.units} unit(s) of ${params.bloodType} blood at ${params.hospitalName}.\n\nOur system is actively searching for compatible donors. You will be notified the moment a donor confirms.\n\nTracking Code: ${params.trackingCode}\nTrack Live: https://findmydonor.online/tracking?code=${params.trackingCode}\n\nStay strong. We're with you. ❤️\n\nFindMyDonor™ — Free Community Blood Donation Network`;
  return { subject, html, text };
}

/** Email to requester when matching donors have been alerted (extracted from matchingEngine — Phase 4) */
export function buildDonorsMatchedEmailHTML(params: {
  requesterName: string;
  matchedCount: number;
  trackingCode: string;
  hospitalName: string;
}): { subject: string; html: string; text: string } {
  const name = escapeHtml(params.requesterName);
  const hospital = escapeHtml(params.hospitalName);
  const subject = `🩸 [Update] Matching Donors Found for Request ${params.trackingCode}`;
  const html = `<p>Hi <strong>${name}</strong>,</p><p>We have matched <strong>${params.matchedCount}</strong> eligible donor(s) for your blood request <code>${params.trackingCode}</code> at ${hospital}.</p><p><a href="https://findmydonor.online/tracking?code=${params.trackingCode}">Click here to track your request live</a></p>`;
  const text = `Hi ${params.requesterName},\nWe matched ${params.matchedCount} donor(s) for request ${params.trackingCode} at ${params.hospitalName}.\nTrack: https://findmydonor.online/tracking?code=${params.trackingCode}`;
  return { subject, html, text };
}

/** Email to requester when no donors were found on the initial search (extracted from matchingEngine — Phase 4) */
export function buildNoDonorsYetEmailHTML(params: {
  requesterName: string;
  bloodType: string;
  trackingCode: string;
  hospitalName: string;
}): { subject: string; html: string; text: string } {
  const name = escapeHtml(params.requesterName);
  const hospital = escapeHtml(params.hospitalName);
  const subject = `⚠️ [Urgent Update] Searching for Donors — Request ${params.trackingCode}`;
  const html = `<p>Hi <strong>${name}</strong>,</p><p>We are actively searching our network for eligible ${params.bloodType} donors near ${hospital}. Our system will automatically notify matching donors as soon as they become available.</p><p><a href="https://findmydonor.online/tracking?code=${params.trackingCode}">Track Request Live</a></p>`;
  const text = `Hi ${params.requesterName},\nWe are actively searching for ${params.bloodType} donors near ${params.hospitalName}.\nTrack: https://findmydonor.online/tracking?code=${params.trackingCode}`;
  return { subject, html, text };
}

