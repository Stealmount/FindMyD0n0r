import type { TranslationDictionary } from './types';
export const en: TranslationDictionary = {
    account: {
        deleteTitle: "Delete Account",
        deleteWarning: "This permanently removes your profile, donation history, and request records. This cannot be undone.",
        deleteConfirmPlaceholder: "Type DELETE to confirm",
        deleteConfirmButton: "Permanently Delete Account",
        deleteCancel: "Cancel",
        deleteSuccess: "Your account has been deleted.",
        deleteError: "Failed to delete account. Please try again.",
        deleteLoading: "Deleting account…",
    },
    nav: {
      requestSos: 'Request Blood',
      trackMatch: 'Track Match',
      signIn: 'Sign In',
      signUp: 'Sign Up',
      myDashboard: 'My Dashboard',
      requestBloodBtn: 'Request Blood',
    },
    hero: {
      badge: 'National Live Blood Matching Network',
      titleLine1: 'The moment',
      titleHighlight: 'life',
      titleLine2: 'needs blood, we find a donor in minutes.',
      subtitle: 'FindMyDonor™ is a community blood network. Post a request, and we notify verified donors nearby who match the blood group — multiple donors for multiple units, with 60-day safety tracking built in.',
      requestBloodNow: 'Request blood now',
      joinNetwork: 'Join FindMyDonor™ Network',
      trackLiveRequest: 'Track live request',
      safetyVerification: 'Medical safety verification',
      safetyCooldown: '60-day safety cooldown',
      privacyConsent: 'Privacy consent gateway',
    },
    auth: {
      welcomeSignIn: 'Welcome to FindMyDonor™',
      joinNetworkTitle: 'Join the FindMyDonor™ Network',
      signInSubtitle: 'Sign in once to access your personalized Donor Dashboard or Requester Portal.',
      signUpSubtitle: 'Choose your role below to get started. Registration takes under 60 seconds.',
      signInTab: 'Sign In',
      createAccountTab: 'Create Account',
      emailLabel: 'Email Address',
      passwordLabel: 'Password',
      signInBtn: 'Sign In to Dashboard',
      orContinueWith: 'OR CONTINUE WITH',
      continueGoogle: 'Continue with Google',
      noAccountText: "Don't have a FindMyDonor™ account yet?",
      createOneNow: 'Create one now',
      alreadyHaveAccount: 'Already have an account?',
      signInHere: 'Sign in here',
      donorCardTitle: 'Volunteer Blood Donor',
      donorCardTag: 'Save Lives',
      donorCardDesc: 'Register as a voluntary donor. Get alerted when nearby patients match your blood group, track safety recovery periods, and make a lifesaver impact.',
      requesterCardTitle: 'Blood Requester / Hospital',
      requesterCardTag: 'Post a Request',
      requesterCardDesc: 'Create a requester account to broadcast blood requirements to verified donors, track matching updates, or connect via our 24x7 helpline.',
      signingIn: 'Signing In...',
    },
    footer: {
      description: 'The real-time blood matching network. We connect requesters and donors in minutes — not hours — so no life is lost waiting.',
      quickActions: 'QUICK ACTIONS',
      requestBloodNow: 'Request Blood Now',
      createAccount: 'Create Account',
      forHospitals: 'For Hospitals (Beta)',
      col1Title: 'INTERACTIVE PLATFORM',
      col1Request: 'Request Emergency Blood',
      col1Track: 'Track Match',
      col1SignIn: 'Sign In',
      col1ForInstitutions: 'For Institutions (Beta)',
      col1SignUp: 'Create Account (Sign Up)',
      col2Title: 'COMMUNITY & SYSTEM',
      col2HowItWorks: 'How It Works',
      col2Features: 'Platform Features',
      col2Impact: 'Live Impact Metrics',
      col2Faq: 'Frequently Asked Questions',
      col3Title: 'MANAGEMENT',
      col3Admin: 'Admin Console',
      col3SafetyPolicy: 'Medical Safety Policy',
      col3MatchingRules: 'Proximity Matching Rules',
      copyright: '© 2026 FindMyDonor™ Community Network. All rights reserved. Free & Open for patients, donors, and the community.',
    },
    howItWorks: {
      badge: 'WHAT FINDMYDONOR DOES',
      title: 'What does FindMyDonor do?',
      subtitle: 'A fast, transparent, and direct connection between people who need blood and verified voluntary donors nearby.',
      step1Title: '1. Request Emergency Blood',
      step1Desc: 'Enter required blood group, hospital location, and unit count. Our algorithm instantly matches verified donors in your pincode.',
      step2Title: '2. Live Proximity Notification',
      step2Desc: 'Eligible donors who have completed their safety cooldown receive real-time alerts with hospital directions.',
      step3Title: '3. Direct Hospital Donation',
      step3Desc: 'Donors arrive directly at the hospital or blood bank. No middlemen, zero commercial fees, complete transparency.',
    },
    cta: {
      badge: 'CONNECT. DONATE. SAVE.',
      title: 'Ready to make a difference or need blood urgently?',
      subtitle: 'Whether you need blood or want to become a voluntary donor, FindMyDonor™ connects you in minutes.',
      requestBtn: 'Request blood now',
      volunteerBtn: 'Become a Volunteer Donor',
    },
    faq: {
      badge: 'FREQUENTLY ASKED QUESTIONS',
      title: 'Got questions? We have answers.',
      subtitle: 'Everything you need to know about how FindMyDonor works, donor eligibility, and blood requests.',
      items: [
        {
          q: "How does FindMyDonor™ find a donor in real time?",
          a: "When a request is posted, our matching engine filters our network by blood group, eligibility, distance, and preferences — and pushes a notification to every donor who fits. The first to accept is locked in; others remain on warm standby for additional units."
        },
        {
          q: "How fast is a donor matched after posting a request?",
          a: "Most requests receive an accepted donor match within 3 to 4 minutes. Our automated paging system contacts donors within a 5 km radius immediately."
        },
        {
          q: "Is FindMyDonor™ really 100% free?",
          a: "Yes, FindMyDonor™ is completely free for patients, donors, and hospitals forever. We never charge for blood matching or emergency SOS broadcasting."
        },
        {
          q: "How does the 60-day safety cooldown work?",
          a: "To protect donor health, our platform enforces a strict 60-day recovery window after whole blood donation (90 days for certain criteria). Donors on cooldown are automatically excluded from urgent alerts."
        },
        {
          q: "Can hospitals register and broadcast urgent needs?",
          a: "Absolutely. Hospital staff and blood banks can create an official account to broadcast emergency blood requirements directly to verified donors."
        },
        {
          q: "How do hospitals integrate FindMyDonor™?",
          a: "Hospitals can use our clean web dashboard to track inventory, verify patient requests, and coordinate incoming voluntary donors with zero setup fee."
        }
      ]
    },
    features: {
      badge: 'PLATFORM FEATURES',
      title: 'Simple tools that connect donors and requesters.',
      subtitle: 'We focus on the features that matter most: matching nearby donors, protecting donor health, and respecting privacy.',
      items: [
        {
          title: "Smart Donor Matching",
          desc: "Matches nearby verified donors by blood group and eligibility, notifying only those who can actually help."
        },
        {
          title: "Notify Multiple Donors",
          desc: "Simultaneously notifies multiple eligible donors when more than one unit is required, so you're not dependent on a single response."
        },
        {
          title: "Safety Cooldown Tracking",
          desc: "Automatically checks donor eligibility based on recommended donation intervals. Donors within their recovery window won't be contacted."
        },
        {
          title: "Hospital-Aware Routing",
          desc: "Planned navigation to the exact hospital wing or blood bank counter — including entry instructions for donors."
        },
        {
          title: "Timely Notifications",
          desc: "Notifications respect quiet hours, frequency caps, and donor preferences. No spam — only relevant alerts when a compatible request is nearby."
        },
        {
          title: "Donor Verification",
          desc: "Supports identity verification and stores donor information. Final medical screening and eligibility are determined by the authorised blood bank or hospital."
        }
      ]
    },
    impact: {
      badge: 'OUR GOALS & PROGRESS',
      title: 'Building a community blood network.',
      subtitle: 'We share our goals and progress openly as we grow.',
      stats: [
        {
          n: "100+",
          label: "DONORS TARGET",
          sub: "Verified voluntary donors in Delhi NCR"
        },
        {
          n: "< 3m",
          label: "TARGET MATCH TIME",
          sub: "alert → notification"
        },
        {
          n: "3",
          label: "PILOT AREAS",
          sub: "Delhi, Noida, and Gurugram"
        },
        {
          n: "100%",
          label: "FREE COMMUNITY PLATFORM",
          sub: "Zero commercial fees forever"
        }
      ]
    },
    benefits: {
      badge: 'WHY FINDMYDONOR™',
      title: 'Designed for speed, trust, and safety.',
      subtitle: 'How we empower donors, patients, and hospitals.',
      items: [
        {
          title: "Instant proximity paging",
          desc: "We notify only eligible donors within the required travel radius — keeping alerts relevant and respectful."
        },
        {
          title: "Zero spam, strict frequency caps",
          desc: "Once a donor donates, our engine enforces an automatic 60-day cool-off window."
        },
        {
          title: "Verified hospital integration",
          desc: "Planned direct blood bank integration will help verify that requests are genuine and units reach the intended patient."
        },
        {
          title: "Privacy first communication",
          desc: "Phone numbers stay private between donors and hospitals until a match is confirmed."
        }
      ]
    },
    showcase: {
      badge: 'SEE IT IN ACTION',
      titleLine1: 'One platform.',
      titleHighlight: 'Three lives',
      titleLine2: 'in the loop.',
      subtitle: 'The same FindMyDonor™ app serves the patient who needs blood, the donor who gives it, and the hospital that runs the request. Switch between perspectives to see the magic happen.',
      tabRequester: 'Requester view',
      tabDonor: 'Donor view',
      tabHospital: 'Hospital view',
    },
    donorReg: {
      badge: 'DONOR ONBOARDING',
      title: 'Register as a Volunteer Lifesaver',
      subtitle: 'Join our growing community of voluntary blood donors.',
      cooldownNotice: 'Our 60-day recovery cooldown protects your health and prevents alert fatigue.',
      submitBtn: 'Complete Volunteer Registration →',
    },
    requesterReg: {
      badge: 'REQUESTER ONBOARDING',
      title: 'Register for Blood Requests',
      subtitle: 'Post verified requests and connect directly with local voluntary donors.',
      sosHotlineTitle: 'Need help? Call 24x7 Blood Helpline',
      sosHotlineSub: 'Speak directly with our coordinators for assistance',
      submitBtn: 'Complete Requester Registration →',
    },
    admin: {
      loginTitle: 'Admin Portal Login',
      loginSubtitle: 'Authorized operations, override controllers, and analytics dashboard.',
      passwordLabel: 'Administrator Password',
      passwordPlaceholder: "Enter 'admin' to access",
      authenticateBtn: 'Authenticate Admin Credentials',
      consoleAuthenticated: 'Console Authenticated • FindMyDonor™',
      seedDemoData: 'Seed Demo Data',
      lockSession: 'Lock Session',
      tabAnalytics: 'Dashboard Analytics',
      tabDonors: 'Manage Donors',
      tabRequests: 'Blood Requests',
      tabMatches: 'Match Lifecycles',
      tabNotifs: 'WhatsApp Logs',
      matchRate: 'Match Rate',
      matchRateSub: 'Requests with matched donors',
      fulfillmentRate: 'Fulfillment Rate',
      fulfillmentRateSub: 'Matched requests donated',
      donorUtilization: 'Donor Utilization',
      donorUtilizationSub: 'Donors active in last 90 days',
      avgResponseTime: 'Avg Response Time',
      avgResponseTimeSub: 'Alert response YES/NO',
      demandHeatmapTitle: 'Demand Heatmap by Blood Type Needed',
      topPincodesTitle: 'Top Geographic Pincode Densities',
      criticalAlertPrefix: 'CRITICAL',
      criticalAlertSub: 'These blood requests have 0 compatible volunteer donors nearby. Immediate administrator outreach or area expansion fallback required.',
      donorsTableTitle: 'VOLUNTEER DONORS POOL',
      colDonorName: 'DONOR NAME',
      colBloodType: 'BLOOD TYPE',
      colPincode: 'PINCODE / CITY',
      colStatus: 'STATUS',
      colLastDonation: 'LAST DONATION',
      colActions: 'ACTIONS OVERRIDE',
      allBloodTypes: 'All Blood Types',
      allStatuses: 'All Statuses',
      searchPincode: 'Search Pincode...',
      btnLiftCooldown: 'Lift Cooldown',
      btnForceCooldown: 'Force Cooldown',
      btnUnban: 'Unban',
      btnBan: 'Ban',
      requestsTableTitle: 'BLOOD REQUESTS TRACKER',
      colTrackingCode: 'TRACKING CODE',
      colPatient: 'PATIENT / REQUESTER',
      colUnits: 'UNITS',
      colUrgency: 'URGENCY',
      allUrgencies: 'All Urgencies',
      searchHospitalPin: 'Hospital Pincode...',
      matchesTableTitle: 'ACTIVE MATCH LIFECYCLES (NOTIFIED → RESPONSE → OUTCOME)',
      colRequestId: 'REQUEST ID',
      colMatchRank: 'MATCH RANK',
      colNotified: 'NOTIFICATION SENT',
      colResponse: 'DONOR RESPONSE',
      colOutcome: 'OUTCOME',
      btnApprove: 'Approve',
      btnDecline: 'Decline',
      btnMarkDonated: 'Mark Donated',
      notifsTableTitle: 'WHATSAPP / SMS OUTBOUND NOTIFICATION LOGS',
      gatewayLog: 'gateway log',
      recipientId: 'Recipient ID',
    },
    donorDashboard: {
      loginTitle: 'Donor Login',
      emailLabel: 'Email Address',
      passwordLabel: 'Password',
      loginBtn: 'Access Dashboard',
      memberSince: 'Member since',
      cooldownActive: 'Recovery Cooldown Active',
      backInPool: 'Back in pool on',
      bloodType: 'Blood Type',
      liveMatchingRequests: 'Live Matching Requests',
      donationHistory: 'Donation History',
      noActiveRequests: 'You have no active match requests',
      noActiveRequestsSub: 'When a blood request is raised in your area, you will receive immediate alerts here!',
      profileSettings: 'Profile Settings',
      updateProfileBtn: 'Update Profile',
      manualDonationEntry: 'Manual Donation Entry',
      submitLogBtn: 'Submit Log',
      replyYes: 'Accept & Share Contact',
      replyNo: 'Decline',
      contactShared: 'Contact Shared',
      viewDetails: 'View Details',
      pass: 'Pass',
      kmAway: 'km away',
      requestDetails: 'Request Details',
      close: 'Close',
      location: 'Location',
      hospitalLabel: 'Hospital',
      patientLabel: 'Patient',
      bloodGroup: 'Blood Group',
      units: 'Units',
      componentLabel: 'Component',
      urgency: 'Urgency',
      contactRequester: 'Contact Requester',
      callRequester: 'Call Requester',
      requesterName: 'Requester Name',
      requesterPhone: 'Requester Phone',
      trackingLabel: 'Tracking Code',
      timeline: 'Request Timeline',
      stepRequestCreated: 'Request Created',
      stepLiveMatching: 'Live Matching',
      stepDonorResponded: 'Donor Responded',
      stepMatchConfirmed: 'Match Confirmed',
      stepRequestFulfilled: 'Request Fulfilled',
      stepDonationCompleted: 'Donation Completed',
      trackRequest: 'Track this request',
      contactUnlockHint: 'Your contact details unlock for the requester once you accept.',
      acceptedChip: 'Accepted',
      iCanDonate: 'I Can Donate',
      whatsappRequester: 'WhatsApp Requester',
      openInMap: 'Open in Maps',
      trackMatch: 'Track Match',
    },
    requesterDashboard: {
      loginTitle: 'Requester Portal Login',
      newRequestBtn: 'Post Emergency Blood Request',
      activeRequests: 'Active Blood Requests',
      noRequests: 'No Active Requests',
      noRequestsSub: 'When you post a blood request, you can track it live here.',
      trackingCode: 'Tracking Code',
      patientName: 'Patient',
      hospital: 'Hospital',
      unitsNeeded: 'Units',
      status: 'Status',
      matchedDonors: 'Matched Donors',
      contactInfo: 'Contact',
      markFulfilled: 'Mark as Fulfilled',
    },
};
