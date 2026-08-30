export type Language = 'EN' | 'HI';

export interface TranslationDictionary {
  nav: {
    requestSos: string;
    trackMatch: string;
    signIn: string;
    signUp: string;
    myDashboard: string;
    requestBloodBtn: string;
  };
  hero: {
    badge: string;
    titleLine1: string;
    titleHighlight: string;
    titleLine2: string;
    subtitle: string;
    requestBloodNow: string;
    joinNetwork: string;
    trackLiveRequest: string;
    safetyVerification: string;
    safetyCooldown: string;
    privacyConsent: string;
  };
  auth: {
    welcomeSignIn: string;
    joinNetworkTitle: string;
    signInSubtitle: string;
    signUpSubtitle: string;
    signInTab: string;
    createAccountTab: string;
    emailLabel: string;
    passwordLabel: string;
    signInBtn: string;
    orContinueWith: string;
    continueGoogle: string;
    noAccountText: string;
    createOneNow: string;
    alreadyHaveAccount: string;
    signInHere: string;
    donorCardTitle: string;
    donorCardTag: string;
    donorCardDesc: string;
    requesterCardTitle: string;
    requesterCardTag: string;
    requesterCardDesc: string;
    signingIn: string;
  };
  footer: {
    description: string;
    quickActions: string;
    requestBloodNow: string;
    createAccount: string;
    col1Title: string;
    col1Request: string;
    col1Track: string;
    col1SignIn: string;
    col1SignUp: string;
    col2Title: string;
    col2HowItWorks: string;
    col2Features: string;
    col2Impact: string;
    col2Faq: string;
    col3Title: string;
    col3Admin: string;
    col3SafetyPolicy: string;
    col3MatchingRules: string;
    copyright: string;
  };
  howItWorks: {
    badge: string;
    title: string;
    subtitle: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
  };
  cta: {
    badge: string;
    title: string;
    subtitle: string;
    requestBtn: string;
    volunteerBtn: string;
  };
  faq: {
    badge: string;
    title: string;
    subtitle: string;
    items: Array<{ q: string; a: string }>;
  };
  features: {
    badge: string;
    title: string;
    subtitle: string;
    items: Array<{ title: string; desc: string }>;
  };
  impact: {
    badge: string;
    title: string;
    subtitle: string;
    stats: Array<{ n: string; label: string; sub: string }>;
  };
  benefits: {
    badge: string;
    title: string;
    subtitle: string;
    items: Array<{ title: string; desc: string }>;
  };
  showcase: {
    badge: string;
    titleLine1: string;
    titleHighlight: string;
    titleLine2: string;
    subtitle: string;
    tabRequester: string;
    tabDonor: string;
    tabHospital: string;
  };
  donorReg: {
    badge: string;
    title: string;
    subtitle: string;
    cooldownNotice: string;
    submitBtn: string;
  };
  requesterReg: {
    badge: string;
    title: string;
    subtitle: string;
    sosHotlineTitle: string;
    sosHotlineSub: string;
    submitBtn: string;
  };
  admin: {
    loginTitle: string;
    loginSubtitle: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    authenticateBtn: string;
    consoleAuthenticated: string;
    seedDemoData: string;
    lockSession: string;
    tabAnalytics: string;
    tabDonors: string;
    tabRequests: string;
    tabMatches: string;
    tabNotifs: string;
    matchRate: string;
    matchRateSub: string;
    fulfillmentRate: string;
    fulfillmentRateSub: string;
    donorUtilization: string;
    donorUtilizationSub: string;
    avgResponseTime: string;
    avgResponseTimeSub: string;
    demandHeatmapTitle: string;
    topPincodesTitle: string;
    criticalAlertPrefix: string;
    criticalAlertSub: string;
    donorsTableTitle: string;
    colDonorName: string;
    colBloodType: string;
    colPincode: string;
    colStatus: string;
    colLastDonation: string;
    colActions: string;
    allBloodTypes: string;
    allStatuses: string;
    searchPincode: string;
    btnLiftCooldown: string;
    btnForceCooldown: string;
    btnUnban: string;
    btnBan: string;
    requestsTableTitle: string;
    colTrackingCode: string;
    colPatient: string;
    colUnits: string;
    colUrgency: string;
    allUrgencies: string;
    searchHospitalPin: string;
    matchesTableTitle: string;
    colRequestId: string;
    colMatchRank: string;
    colNotified: string;
    colResponse: string;
    colOutcome: string;
    btnApprove: string;
    btnDecline: string;
    btnMarkDonated: string;
    notifsTableTitle: string;
    gatewayLog: string;
    recipientId: string;
  };
  donorDashboard: {
    loginTitle: string;
    emailLabel: string;
    passwordLabel: string;
    loginBtn: string;
    memberSince: string;
    cooldownActive: string;
    backInPool: string;
    bloodType: string;
    liveMatchingRequests: string;
    donationHistory: string;
    noActiveRequests: string;
    noActiveRequestsSub: string;
    profileSettings: string;
    updateProfileBtn: string;
    manualDonationEntry: string;
    submitLogBtn: string;
    replyYes: string;
    replyNo: string;
    contactShared: string;
  };
  requesterDashboard: {
    loginTitle: string;
    newRequestBtn: string;
    activeRequests: string;
    noRequests: string;
    noRequestsSub: string;
    trackingCode: string;
    patientName: string;
    hospital: string;
    unitsNeeded: string;
    status: string;
    matchedDonors: string;
    contactInfo: string;
    markFulfilled: string;
  };
}

export const translations: Record<Language, TranslationDictionary> = {
  EN: {
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
      subtitle: 'FindMyDonor™ is a real-time blood matching network. Post a request, and we instantly notify verified donors nearby who match the blood group — multiple donors for multiple units, with 60-day & 90-day safety tracking built in.',
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
      requesterCardTag: 'Emergency Request',
      requesterCardDesc: 'Create a requester account to broadcast urgent blood requirements to verified donors, track live matching updates, or connect via our 24x7 emergency helpline.',
      signingIn: 'Signing In...',
    },
    footer: {
      description: 'The real-time blood matching network. We connect requesters and donors in minutes — not hours — so no life is lost waiting.',
      quickActions: 'QUICK ACTIONS',
      requestBloodNow: 'Request Blood Now',
      createAccount: 'Create Account',
      col1Title: 'INTERACTIVE PLATFORM',
      col1Request: 'Request Emergency Blood',
      col1Track: 'Track Live Request',
      col1SignIn: 'Sign In',
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
      badge: 'THREE SIMPLE STEPS',
      title: 'How FindMyDonor™ saves lives in minutes',
      subtitle: 'A fast, transparent, and direct bridge between emergency requesters and verified voluntary blood donors nearby.',
      step1Title: '1. Request Emergency Blood',
      step1Desc: 'Enter required blood group, hospital location, and unit count. Our algorithm instantly matches verified donors in your pincode.',
      step2Title: '2. Live Proximity Notification',
      step2Desc: 'Eligible donors who have completed their safety cooldown receive real-time alerts with hospital directions.',
      step3Title: '3. Direct Hospital Donation',
      step3Desc: 'Donors arrive directly at the hospital or blood bank. No middlemen, zero commercial fees, complete transparency.',
    },
    cta: {
      badge: 'URGENT LIFE-SAVING NETWORK',
      title: 'Ready to make a difference or need blood urgently?',
      subtitle: 'Whether you need blood immediately or want to register as a voluntary lifesaver, FindMyDonor™ connects you in seconds.',
      requestBtn: 'Request Emergency Blood Now',
      volunteerBtn: 'Become a Volunteer Donor',
    },
    faq: {
      badge: 'FREQUENTLY ASKED QUESTIONS',
      title: 'Got questions? We have answers.',
      subtitle: 'Everything you need to know about safety protocols, donor eligibility, and emergency blood requests.',
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
      badge: 'BUILT FOR THE MOMENT THAT MATTERS',
      title: 'Every feature earns its place in the chain of survival.',
      subtitle: 'We obsess over emergency scenarios — power outages, mid-shift staffing, unreachable phone numbers. FindMyDonor™ is the safety net that turns chaos into a calm, coordinated response.',
      items: [
        {
          title: "Real-time matching engine",
          desc: "Sub-second matching against verified donors. Considers blood group, proximity eligibility, location, and donation history."
        },
        {
          title: "Multi-donor requests",
          desc: "Need 4 units? We page four eligible donors in parallel and assign the first to accept while others stay on warm standby."
        },
        {
          title: "Safety cooldown tracking",
          desc: "Automatic eligibility windows (60 & 90 day safety rules) so donors can never be over-notified. Compliance-grade audit logs included."
        },
        {
          title: "Hospital-aware routing",
          desc: "Donors are navigated to the exact wing, bed, or blood bank counter — including verified parking and entry instructions."
        },
        {
          title: "Vitals & recovery",
          desc: "Optional post-donation check-ins track hemoglobin, hydration, and recovery — surfaced back to your donor profile."
        },
        {
          title: "Smart, silent alerts",
          desc: "Notifications respect quiet hours, frequency caps, and the donor's preferences. Zero spam — only when it matters."
        },
        {
          title: "Hospital dashboard",
          desc: "Real-time inventory, predicted shortages, and a one-click request console for transfusion teams."
        },
        {
          title: "Planned surgeries",
          desc: "Schedule a procedure 2 weeks out and we pre-warm donors for the date — no last-minute scrambles."
        },
        {
          title: "Verification, end-to-end",
          desc: "Every donor completes medical screening, ID check, and blood-type confirmation before they can be matched."
        }
      ]
    },
    impact: {
      badge: 'MEASURABLE LIFE-SAVING IMPACT',
      title: 'Real numbers. Real lives saved.',
      subtitle: 'Transparent live statistics across our community network.',
      stats: [
        {
          n: "50+",
          label: "VERIFIED VOLUNTARY DONORS",
          sub: "Ready to respond on safety cooldowns in Delhi NCR"
        },
        {
          n: "3m 42s",
          label: "MEDIAN TIME TO MATCH",
          sub: "request → donor"
        },
        {
          n: "3",
          label: "ACTIVE PILOT CITIES",
          sub: "Delhi, Noida, and Gurugram live"
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
          desc: "We notify only eligible donors within the required travel radius — no broadcast blast to people 500 km away."
        },
        {
          title: "Zero spam, strict frequency caps",
          desc: "Once a donor donates, our engine enforces an automatic 60-day cool-off window."
        },
        {
          title: "Verified hospital integration",
          desc: "Direct blood bank verification ensures requests are genuine and units reach the intended patient."
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
      subtitle: 'Join India’s fastest real-time blood matching network.',
      cooldownNotice: 'Our 60-day recovery cooldown protects your health and prevents alert fatigue.',
      submitBtn: 'Complete Volunteer Registration →',
    },
    requesterReg: {
      badge: 'EMERGENCY REQUESTER ONBOARDING',
      title: 'Register for Emergency Blood Requests',
      subtitle: 'Post verified requests and connect directly with local voluntary donors.',
      sosHotlineTitle: 'Need immediate help? Call 24x7 Emergency Blood Hotline',
      sosHotlineSub: 'Speak directly with our duty coordinators for urgent assistance',
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
  },
  HI: {
    nav: {
      requestSos: 'रक्त अनुरोध करें',
      trackMatch: 'स्थिति ट्रैक करें',
      signIn: 'लॉगिन',
      signUp: 'पंजीकरण',
      myDashboard: 'मेरा डैशबोर्ड',
      requestBloodBtn: 'रक्त अनुरोध करें',
    },
    hero: {
      badge: 'राष्ट्रीय लाइव रक्त मिलान नेटवर्क',
      titleLine1: 'जिस क्षण जीवन को',
      titleHighlight: 'रक्त',
      titleLine2: 'की आवश्यकता होती है, हम मिनटों में रक्तदाता खोजते हैं।',
      subtitle: 'FindMyDonor™ एक रीयल-टाइम रक्त मिलान नेटवर्क है। अनुरोध दर्ज करें, और हम तुरंत आपके पास के सत्यापित रक्तदाताओं को सूचित करते हैं — बिना किसी दलाल के, 100% नि:शुल्क समुदाय।',
      requestBloodNow: 'अभी रक्त अनुरोध करें',
      joinNetwork: 'रक्तदान नेटवर्क से जुड़ें',
      trackLiveRequest: 'लाइव अनुरोध ट्रैक करें',
      safetyVerification: 'चिकित्सा सुरक्षा सत्यापन',
      safetyCooldown: '60-दिवसीय सुरक्षा अंतराल',
      privacyConsent: 'गोपनीयता और सुरक्षा सहमति',
    },
    auth: {
      welcomeSignIn: 'FindMyDonor™ में आपका स्वागत है',
      joinNetworkTitle: 'रक्तदान नेटवर्क से जुड़ें',
      signInSubtitle: 'अपने व्यक्तिगत डोनर डैशबोर्ड या रिक्वेस्टर पोर्टल तक पहुँचने के लिए लॉगिन करें।',
      signUpSubtitle: 'शुरू करने के लिए नीचे अपनी भूमिका चुनें। पंजीकरण में 60 सेकंड से भी कम समय लगता है।',
      signInTab: 'लॉगिन करें',
      createAccountTab: 'खाता बनाएं',
      emailLabel: 'ईमेल पता',
      passwordLabel: 'पासवर्ड',
      signInBtn: 'डैशबोर्ड में लॉगिन करें',
      orContinueWith: 'या इसके साथ जारी रखें',
      continueGoogle: 'Google के साथ जारी रखें',
      noAccountText: 'क्या आपके पास अभी तक रक्तदान खाता नहीं है?',
      createOneNow: 'अभी नया खाता बनाएं',
      alreadyHaveAccount: 'क्या आपके पास पहले से खाता है?',
      signInHere: 'यहाँ लॉगिन करें',
      donorCardTitle: 'स्वैच्छिक रक्तदाता (Volunteer Donor)',
      donorCardTag: 'जीवन बचाएं',
      donorCardDesc: 'स्वैच्छिक रक्तदाता के रूप में पंजीकरण करें। जब आस-पास के मरीजों को आपके रक्त समूह की आवश्यकता हो तो अलर्ट प्राप्त करें।',
      requesterCardTitle: 'रक्त आवश्यकता / अस्पताल (Blood Requester)',
      requesterCardTag: 'आपातकालीन अनुरोध',
      requesterCardDesc: 'सत्यापित रक्तदाताओं को तत्काल रक्त आवश्यकताएं भेजने, लाइव ट्रैकिंग देखने या 24x7 हेल्पलाइन से जुड़ने के लिए रिक्वेस्टर खाता बनाएं।',
      signingIn: 'लॉगिन हो रहा है...',
    },
    footer: {
      description: 'रीयल-टाइम रक्त मिलान नेटवर्क। हम मरीजों और रक्तदाताओं को मिनटों में जोड़ते हैं ताकि प्रतीक्षा में कोई जान न जाए।',
      quickActions: 'त्वरित कार्रवाई (QUICK ACTIONS)',
      requestBloodNow: 'अभी रक्त अनुरोध करें',
      createAccount: 'नया खाता बनाएं',
      col1Title: 'इंटरैक्टिव प्लेटफ़ॉर्म',
      col1Request: 'आपातकालीन रक्त अनुरोध करें',
      col1Track: 'लाइव अनुरोध ट्रैक करें',
      col1SignIn: 'लॉगिन करें (Sign In)',
      col1SignUp: 'खाता बनाएं (Sign Up)',
      col2Title: 'समुदाय और प्रणाली',
      col2HowItWorks: 'यह कैसे काम करता है',
      col2Features: 'प्लेटफ़ॉर्म की विशेषताएं',
      col2Impact: 'लाइव प्रभाव मेट्रिक्स',
      col2Faq: 'अक्सर पूछे जाने वाले प्रश्न (FAQ)',
      col3Title: 'प्रबंधन (MANAGEMENT)',
      col3Admin: 'एडमिन कंसोल',
      col3SafetyPolicy: 'चिकित्सा सुरक्षा नीति',
      col3MatchingRules: 'निकटता मिलान नियम',
      copyright: '© 2026 FindMyDonor™ Community Network. सर्वाधिकार सुरक्षित। मरीजों और रक्तदाताओं के लिए 100% नि:शुल्क।',
    },
    howItWorks: {
      badge: 'तीन आसान चरण',
      title: 'FindMyDonor™ मिनटों में जीवन कैसे बचाता है',
      subtitle: 'आपातकालीन जरूरतमंदों और आस-पास के सत्यापित स्वैच्छिक रक्तदाताओं के बीच एक तेज़ और सीधा सेतु।',
      step1Title: '1. आपातकालीन रक्त अनुरोध',
      step1Desc: 'आवश्यक रक्त समूह, अस्पताल का स्थान और यूनिट संख्या दर्ज करें। हमारा एल्गोरिदम तुरंत आपके पिनकोड में रक्तदाताओं से मिलान करता है।',
      step2Title: '2. लाइव निकटता सूचना (Alerts)',
      step2Desc: 'पात्र रक्तदाता जिन्होंने अपनी सुरक्षा अवधि पूरी कर ली है, उन्हें अस्पताल के पते के साथ रीयल-टाइम अलर्ट प्राप्त होते हैं।',
      step3Title: '3. सीधा अस्पताल में रक्तदान',
      step3Desc: 'रक्तदाता सीधे अस्पताल या ब्लड बैंक पहुँचते हैं। कोई बिचौलिया नहीं, शून्य व्यावसायिक शुल्क, पूर्ण पारदर्शिता।',
    },
    cta: {
      badge: 'तत्काल जीवन रक्षक नेटवर्क',
      title: 'क्या आपको तुरंत रक्त की आवश्यकता है या आप जीवन बचाना चाहते हैं?',
      subtitle: 'चाहे आपको तुरंत रक्त चाहिए या आप स्वैच्छिक रक्तदाता बनना चाहते हैं, रक्तदान आपको सेकंडों में जोड़ता है।',
      requestBtn: 'अभी आपातकालीन रक्त मांगें',
      volunteerBtn: 'स्वैच्छिक रक्तदाता बनें',
    },
    faq: {
      badge: 'अक्सर पूछे जाने वाले प्रश्न',
      title: 'कोई प्रश्न हैं? हमारे पास उत्तर हैं।',
      subtitle: 'सुरक्षा प्रोटोकॉल, रक्तदाता पात्रता और आपातकालीन रक्त अनुरोधों के बारे में वह सब कुछ जो आपको जानना चाहिए।',
      items: [
        {
          q: "रक्तदान वास्तविक समय में रक्तदाता कैसे खोजता है?",
          a: "जब कोई अनुरोध पोस्ट किया जाता है, तो हमारा मिलान इंजन हमारे नेटवर्क को रक्त समूह, पात्रता, दूरी और प्राथमिकताओं के आधार पर फ़िल्टर करता है — और योग्य हर रक्तदाता को सूचना भेजता है। जो पहला स्वीकार करता है वह असाइन हो जाता है; अन्य अतिरिक्त इकाइयों के लिए स्टैंडबाय पर रहते हैं।"
        },
        {
          q: "अनुरोध पोस्ट करने के बाद रक्तदाता कितनी जल्दी मिलता है?",
          a: "अधिकांश अनुरोधों को 3 से 4 मिनट के भीतर एक स्वीकृत रक्तदाता मिल जाता है। हमारी स्वचालित प्रणाली 5 किमी के दायरे में तुरंत रक्तदाताओं से संपर्क करती है।"
        },
        {
          q: "क्या रक्तदान वास्तव में 100% मुफ़्त है?",
          a: "हाँ, रक्तदान मरीजों, रक्तदाताओं और अस्पतालों के लिए हमेशा के लिए पूरी तरह से मुफ़्त है। हम रक्त मिलान या आपातकालीन SOS के लिए कभी कोई शुल्क नहीं लेते हैं।"
        },
        {
          q: "60-दिन की सुरक्षा कूलडाउन अवधि कैसे काम करती है?",
          a: "रक्तदाता के स्वास्थ्य की रक्षा के लिए, हमारा मंच पूर्ण रक्त दान के बाद अनिवार्य 60-दिन की रिकवरी अवधि लागू करता है। कूलडाउन पर मौजूद रक्तदाताओं को स्वचालित रूप से आपातकालीन अलर्ट से छूट दी जाती है।"
        },
        {
          q: "क्या अस्पताल पंजीकरण करके तत्काल आवश्यकताएँ प्रसारित कर सकते हैं?",
          a: "बिल्कुल। अस्पताल के कर्मचारी और ब्लड बैंक आधिकारिक खाता बनाकर सत्यापित रक्तदाताओं को सीधे आपातकालीन रक्त आवश्यकताएँ प्रसारित कर सकते हैं।"
        },
        {
          q: "अस्पताल रक्तदान को कैसे एकीकृत कर सकते हैं?",
          a: "अस्पताल हमारे स्वच्छ वेब डैशबोर्ड का उपयोग करके इन्वेंट्री ट्रैक कर सकते हैं और बिना किसी शुल्क के स्वैच्छिक रक्तदाताओं के साथ समन्वय कर सकते हैं।"
        }
      ]
    },
    features: {
      badge: 'महत्वपूर्ण क्षणों के लिए निर्मित',
      title: 'हर विशेषता जीवन रक्षा श्रृंखला में अपना स्थान अर्जित करती है।',
      subtitle: 'हम आपातकालीन परिदृश्यों पर ध्यान केंद्रित करते हैं — बिजली की कटौती, कर्मचारियों की कमी, अनुपलब्ध फ़ोन नंबर। रक्तदान वह सुरक्षा जाल है जो अराजकता को एक शांत और समन्वित प्रतिक्रिया में बदल देता है।',
      items: [
        {
          title: "रियल-टाइम मैचिंग इंजन",
          desc: "सत्यापित रक्तदाताओं के साथ उप-सेकंड मिलान। रक्त समूह, दूरी की पात्रता, स्थान और दान इतिहास को ध्यान में रखता है।"
        },
        {
          title: "मल्टी-डोनर अनुरोध",
          desc: "4 यूनिट चाहिए? हम एक साथ चार योग्य रक्तदाताओं को सूचित करते हैं और पहले स्वीकार करने वाले को असाइन करते हैं।"
        },
        {
          title: "सुरक्षा कूलडाउन ट्रैकिंग",
          desc: "स्वचालित पात्रता अवधि (60 और 90 दिन सुरक्षा नियम) ताकि रक्तदाताओं को कभी अतिरिक्त सूचनाएं न मिलें। ऑडिट लॉग शामिल हैं।"
        },
        {
          title: "अस्पताल-सटीक नेविगेशन",
          desc: "रक्तदाताओं को सटीक विंग, बिस्तर या ब्लड बैंक काउंटर तक निर्देशित किया जाता है — पार्किंग और प्रवेश निर्देशों सहित।"
        },
        {
          title: "स्वास्थ्य और रिकवरी ट्रैकिंग",
          desc: "दान के बाद की जांच हीमोग्लोबिन, हाइड्रेशन और रिकवरी को ट्रैक करती है — जो आपके डोनर प्रोफ़ाइल में दर्ज होती है।"
        },
        {
          title: "स्मार्ट, मौन अलर्ट",
          desc: "सूचनाएं शांत समय और रक्तदाता की प्राथमिकताओं का सम्मान करती हैं। शून्य स्पैम — केवल महत्वपूर्ण समय पर।"
        },
        {
          title: "अस्पताल डैशबोर्ड",
          desc: "रियल-टाइम इन्वेंट्री, संभावित कमी की भविष्यवाणी और ट्रांसफ़्यूज़न टीमों के लिए एक-क्लिक अनुरोध कंसोल।"
        },
        {
          title: "नियोजित सर्जरी",
          desc: "2 सप्ताह पहले प्रक्रिया शेड्यूल करें और हम उस तिथि के लिए रक्तदाताओं को तैयार रखते हैं — अंतिम समय में कोई भागदौड़ नहीं।"
        },
        {
          title: "एंड-टू-एंड सत्यापन",
          desc: "प्रत्येक रक्तदाता मैचिंग से पहले मेडिकल स्क्रीनिंग, आईडी जांच और रक्त समूह की पुष्टि पूरी करता है।"
        }
      ]
    },
    impact: {
      badge: 'मापने योग्य जीवन रक्षक प्रभाव',
      title: 'वास्तविक आँकड़े। बचाई गई वास्तविक जानें।',
      subtitle: 'हमारे सामुदायिक नेटवर्क के पार पारदर्शी लाइव आँकड़े।',
      stats: [
        {
          n: "50+",
          label: "सत्यापित स्वैच्छिक रक्तदाता",
          sub: "दिल्ली एनसीआर पायलट में सुरक्षा कूलडाउन के साथ तैयार"
        },
        {
          n: "3m 42s",
          label: "मिलान का औसत समय",
          sub: "अनुरोध → रक्तदाता"
        },
        {
          n: "3",
          label: "शहर और जिले सक्रिय",
          sub: "दिल्ली, नोएडा, और गुरुग्राम लाइव"
        },
        {
          n: "100%",
          label: "निःशुल्क सामुदायिक मंच",
          sub: "हमेशा के लिए शून्य व्यावसायिक शुल्क"
        }
      ]
    },
    benefits: {
      badge: 'रक्तदान क्यों चुनें',
      title: 'गति, विश्वास और सुरक्षा के लिए डिज़ाइन किया गया।',
      subtitle: 'हम रक्तदाताओं, मरीजों और अस्पतालों को कैसे सशक्त बनाते हैं।',
      items: [
        {
          title: "तत्काल नजदीकी सूचना",
          desc: "हम केवल आवश्यक यात्रा दायरे के भीतर योग्य रक्तदाताओं को सूचित करते हैं — 500 किमी दूर के लोगों को नहीं।"
        },
        {
          title: "शून्य स्पैम, सख्त आवृत्ति सीमा",
          desc: "एक बार दान करने के बाद, हमारा इंजन स्वचालित 60-दिन की विश्राम अवधि लागू करता है।"
        },
        {
          title: "सत्यापित अस्पताल एकीकरण",
          desc: "सीधे ब्लड बैंक सत्यापन से सुनिश्चित होता है कि अनुरोध वास्तविक हैं और रक्त सही मरीज तक पहुंचता है।"
        },
        {
          title: "गोपनीयता-प्रथम संवाद",
          desc: "जब तक मिलान की पुष्टि नहीं हो जाती, तब तक रक्तदाताओं और अस्पतालों के बीच फ़ोन नंबर निजी रहते हैं।"
        }
      ]
    },
    showcase: {
      badge: 'लाइव कार्यप्रणाली देखें',
      titleLine1: 'एक मंच।',
      titleHighlight: 'तीन जीवन',
      titleLine2: 'एक साथ जुड़े।',
      subtitle: 'यही रक्तदान ऐप रक्त की आवश्यकता वाले मरीज, रक्त देने वाले दाता और अनुरोध चलाने वाले अस्पताल की सेवा करता है। विभिन्न दृष्टिकोणों को देखने के लिए स्विच करें।',
      tabRequester: 'अनुरोधकर्ता दृश्य',
      tabDonor: 'रक्तदाता दृश्य',
      tabHospital: 'अस्पताल दृश्य',
    },
    donorReg: {
      badge: 'रक्तदाता पंजीकरण',
      title: 'स्वैच्छिक जीवन रक्षक के रूप में पंजीकरण करें',
      subtitle: 'भारत के सबसे तेज़ रियल-टाइम रक्त मिलान नेटवर्क से जुड़ें।',
      cooldownNotice: 'हमारी 60-दिन की सुरक्षा कूलडाउन अवधि आपके स्वास्थ्य की रक्षा करती है।',
      submitBtn: 'स्वैच्छिक पंजीकरण पूरा करें →',
    },
    requesterReg: {
      badge: 'आपातकालीन अनुरोधकर्ता पंजीकरण',
      title: 'आपातकालीन रक्त अनुरोध के लिए पंजीकरण करें',
      subtitle: 'सत्यापित अनुरोध पोस्ट करें और स्थानीय स्वैच्छिक रक्तदाताओं से सीधे जुड़ें।',
      sosHotlineTitle: 'तुरंत सहायता चाहिए? 24x7 आपातकालीन रक्त हेल्पलाइन पर कॉल करें',
      sosHotlineSub: 'तत्काल सहायता के लिए हमारे ड्यूटी समन्वयकों से सीधे बात करें',
      submitBtn: 'अनुरोधकर्ता पंजीकरण पूरा करें →',
    },
    admin: {
      loginTitle: 'एडमिन पोर्टल लॉगिन',
      loginSubtitle: 'अधिकृत संचालन, नियंत्रण प्रणाली और विश्लेषण डैशबोर्ड।',
      passwordLabel: 'प्रशासक पासवर्ड (Administrator Password)',
      passwordPlaceholder: "प्रवेश के लिए 'admin' दर्ज करें",
      authenticateBtn: 'एडमिन क्रेडेंशियल सत्यापित करें',
      consoleAuthenticated: 'कंसोल प्रमाणित • ब्लड कनेक्ट',
      seedDemoData: 'डेमो डेटा जोड़ें',
      lockSession: 'सत्र बंद करें',
      tabAnalytics: 'डैशबोर्ड विश्लेषण',
      tabDonors: 'रक्तदाता प्रबंधन',
      tabRequests: 'रक्त अनुरोध',
      tabMatches: 'मिलान जीवनचक्र',
      tabNotifs: 'व्हाट्सएप लॉग',
      matchRate: 'मिलान दर',
      matchRateSub: 'मिलान किए गए रक्तदाताओं के साथ अनुरोध',
      fulfillmentRate: 'पूर्ति दर',
      fulfillmentRateSub: 'सफल रक्तदान अनुरोध',
      donorUtilization: 'रक्तदाता उपयोग',
      donorUtilizationSub: 'पिछले 90 दिनों में सक्रिय रक्तदाता',
      avgResponseTime: 'औसत प्रतिक्रिया समय',
      avgResponseTimeSub: 'अलर्ट प्रतिक्रिया हाँ/नहीं',
      demandHeatmapTitle: 'आवश्यक रक्त समूह द्वारा मांग हीटमैप',
      topPincodesTitle: 'शीर्ष भौगोलिक पिनकोड घनत्व',
      criticalAlertPrefix: 'महत्वपूर्ण चेतावनी',
      criticalAlertSub: 'इन रक्त अनुरोधों के पास 0 अनुकूल स्वैच्छिक रक्तदाता हैं। तत्काल प्रशासक आउटरीच आवश्यक है।',
      donorsTableTitle: 'स्वैच्छिक रक्तदाता सूची',
      colDonorName: 'रक्तदाता का नाम',
      colBloodType: 'रक्त समूह',
      colPincode: 'पिनकोड / शहर',
      colStatus: 'स्थिति',
      colLastDonation: 'अंतिम रक्तदान',
      colActions: 'कार्रवाई (नियंत्रण)',
      allBloodTypes: 'सभी रक्त समूह',
      allStatuses: 'सभी स्थितियां',
      searchPincode: 'पिनकोड खोजें...',
      btnLiftCooldown: 'कूलडाउन हटाएं',
      btnForceCooldown: 'कूलडाउन लागू करें',
      btnUnban: 'प्रतिबंध हटाएं',
      btnBan: 'प्रतिबंधित करें',
      requestsTableTitle: 'रक्त अनुरोध ट्रैकर',
      colTrackingCode: 'ट्रैकिंग कोड',
      colPatient: 'मरीज / अनुरोधकर्ता',
      colUnits: 'यूनिट्स',
      colUrgency: 'आपात स्थिति',
      allUrgencies: 'सभी आपात स्तर',
      searchHospitalPin: 'अस्पताल पिनकोड...',
      matchesTableTitle: 'सक्रिय मिलान जीवनचक्र (सूचना → प्रतिक्रिया → परिणाम)',
      colRequestId: 'अनुरोध आईडी',
      colMatchRank: 'मिलान रैंक',
      colNotified: 'सूचना भेजी गई',
      colResponse: 'रक्तदाता की प्रतिक्रिया',
      colOutcome: 'परिणाम',
      btnApprove: 'स्वीकृत करें',
      btnDecline: 'अस्वीकार करें',
      btnMarkDonated: 'रक्तदान चिह्नित करें',
      notifsTableTitle: 'व्हाट्सएप / एसएमएस आउटबाउंड अधिसूचना लॉग',
      gatewayLog: 'गेटवे लॉग',
      recipientId: 'प्राप्तकर्ता आईडी',
    },
    donorDashboard: {
      loginTitle: 'रक्तदाता लॉगिन (Donor Login)',
      emailLabel: 'ईमेल पता (Email Address)',
      passwordLabel: 'पासवर्ड (Password)',
      loginBtn: 'डैशबोर्ड में प्रवेश करें',
      memberSince: 'सदस्यता तिथि',
      cooldownActive: 'सुरक्षा रिकवरी अवधि सक्रिय',
      backInPool: 'पुनः उपलब्ध होने की तिथि',
      bloodType: 'रक्त समूह',
      liveMatchingRequests: 'लाइव मैचिंग अनुरोध',
      donationHistory: 'रक्तदान इतिहास',
      noActiveRequests: 'आपके पास कोई सक्रिय मैच अनुरोध नहीं है',
      noActiveRequestsSub: 'जब आपके क्षेत्र में रक्त अनुरोध आएगा, तो आपको तुरंत यहाँ अलर्ट मिलेगा!',
      profileSettings: 'प्रोफ़ाइल सेटिंग्स',
      updateProfileBtn: 'प्रोफ़ाइल अपडेट करें',
      manualDonationEntry: 'मैन्युअल रक्तदान प्रविष्टि',
      submitLogBtn: 'लॉग जमा करें',
      replyYes: 'स्वीकारें और संपर्क साझा करें (Accept)',
      replyNo: 'अस्वीकार करें (Decline)',
      contactShared: 'संपर्क साझा किया गया',
    },
    requesterDashboard: {
      loginTitle: 'अनुरोधकर्ता पोर्टल लॉगिन',
      newRequestBtn: 'नया आपातकालीन रक्त अनुरोध पोस्ट करें',
      activeRequests: 'सक्रिय रक्त अनुरोध',
      noRequests: 'कोई सक्रिय अनुरोध नहीं',
      noRequestsSub: 'जब आप रक्त अनुरोध पोस्ट करेंगे, तो आप उसे यहाँ लाइव ट्रैक कर सकेंगे।',
      trackingCode: 'ट्रैकिंग कोड',
      patientName: 'मरीज (Patient)',
      hospital: 'अस्पताल',
      unitsNeeded: 'यूनिट (Units)',
      status: 'स्थिति (Status)',
      matchedDonors: 'मिले हुए रक्तदाता',
      contactInfo: 'संपर्क जानकारी',
      markFulfilled: 'पूरा हुआ चिह्नित करें',
    },
  },
};
