// QR Resets™ — source-faithful website copy.
// ----------------------------------------------------------------------------
// Every string below is transcribed verbatim from the verified website copy
// document. NO data is invented or re-analyzed. Numbers are reproduced exactly
// as supplied and labeled as planning models / estimates per the source.

export const QR_LOGO_URL =
  "https://r2-uploader-production.up.railway.app/files/BNDRtptLG.png";

export const QR_BRAND = {
  name: "QR Resets™",
  tagline: "One scan. One dollar. One real Reset.",
  shortBio:
    "QR Resets™ | One scan. One dollar. One real Reset. Flexible, person-directed help before a temporary crisis becomes permanent collapse.",
  domain: "QRResets.org",
};

export const QR_NAV = [
  { id: "how-it-works", label: "How It Works" },
  { id: "request", label: "Request a Reset" },
  { id: "give", label: "Give $1" },
  { id: "rules", label: "Our Rules" },
  { id: "transparency", label: "Transparency" },
  { id: "definitions", label: "Definitions" },
  { id: "evidence", label: "Evidence" },
  { id: "faq", label: "FAQ" },
] as const;

export type QrSectionId =
  | "top"
  | "how-it-works"
  | "request"
  | "give"
  | "levels"
  | "rules"
  | "transparency"
  | "definitions"
  | "evidence"
  | "faq";

// ---- HOME / HERO ----------------------------------------------------------

export const QR_HERO = {
  headline: "One scan. One dollar. One real Reset.",
  subhead:
    "QR Resets™ helps people repair the practical support failures turning a temporary crisis into permanent collapse.",
  points: [
    "Housing. Transportation. Healthcare. Communication. Paperwork. A reliable human being. Emergency money. Follow-through.",
    "Not lifelong management.",
    "Not another maze.",
    "Not help conditioned on surrendering control.",
  ],
  promise: "One flexible, person-directed plan that repairs the broken chain.",
  primaryCta: "GIVE $1 A MONTH",
  secondaryCta: "REQUEST A RESET",
  disclaimer:
    "Requesting help is not consent to treatment, publicity, supervision or control.",
};

// ---- THE BASIC IDEA -------------------------------------------------------

export const QR_BASIC_IDEA = {
  heading: "Phoenix has enough people to make one dollar matter.",
  body:
    "The U.S. Census Bureau estimated that 1,665,481 people lived in Phoenix on July 1, 2025.",
  bridge:
    "If Phoenix generated one $1 monthly contribution for every resident, the fund would receive:",
  bigNumber: "$19,985,772 per year",
  explanation:
    "That does not mean every resident—including every child—must personally pay. It means reaching the equivalent of one $1 monthly contribution per resident through individuals, families, businesses, sponsors and matching partners.",
  small1: "One dollar is small.",
  small2: "Nearly twenty million dollars is not.",
  cta: "BECOME A $1 MONTHLY CONTRIBUTOR",
};

// ---- THE PROBLEM ----------------------------------------------------------

export const QR_PROBLEM = {
  heading: "People rarely collapse because exactly one thing went wrong.",
  intro:
    "A person can still be intelligent, capable, motivated and willing to rebuild while simultaneously lacking:",
  lacks: [
    "A safe place to sleep",
    "A housing deposit",
    "Transportation to work or medical care",
    "A working phone",
    "Internet access",
    "Identification",
    "Medication",
    "Trauma support",
    "Help navigating benefits",
    "Assistance with legal or administrative paperwork",
    "A reliable person who follows through",
    "Enough emergency money to absorb the next surprise",
  ],
  problem:
    "Traditional programs often divide these needs among separate agencies.\n\nEach agency may solve one narrow problem while leaving the other blockers intact.\n\nThe person remains trapped—not because recovery is impossible, but because the prerequisites for recovery were never assembled at the same time.",
  conclusion: "QR Resets repairs the chain, not one isolated link.",
};

// ---- WHAT IS A RESET ------------------------------------------------------

export const QR_WHAT_IS_RESET = {
  heading: "A Reset is a flexible package of money, coordination and practical support.",
  intro: "Every Reset is different because every person’s failure chain is different.",
  paysForTitle: "A Reset may pay for:",
  paysFor: [
    "Housing deposits",
    "Temporary rent support",
    "Short-term lodging",
    "Utilities",
    "Transportation",
    "Vehicle repair",
    "Phone and internet service",
    "Identification and document replacement",
    "Medical appointments",
    "Voluntary mental-health or trauma care",
    "Medication access",
    "Food and essential supplies",
    "Employment equipment",
    "Licensing or certification",
    "Childcare",
    "Storage",
    "Legal or administrative assistance",
    "A flexible emergency reserve",
    "An optional navigator",
    "Other person-approved needs directly connected to stability",
  ],
  closing:
    "A Reset is not merely a payment.\n\nIt is the coordinated removal of the barriers preventing a person from moving forward.",
};

// ---- WHAT QR RESETS IS NOT ------------------------------------------------

export const QR_IS_NOT = {
  heading: "We are not here to manage people.",
  intro: "QR Resets is not:",
  notList: [
    "A shelter",
    "A permanent-supportive-housing program",
    "A treatment mandate",
    "A behavioral-compliance program",
    "A religious program",
    "A sobriety test",
    "A drug-testing program",
    "A publicity exchange",
    "A trauma-story contest",
    "A reward for appearing “deserving”",
    "A system that forces people to surrender autonomy to receive help",
    "A replacement for emergency, clinical or long-term supportive services when those services are genuinely needed",
  ],
  fillsTitle: "QR Resets fills the space between:",
  between1: "“Here is a phone number—good luck.”",
  between2: "“We need to control your life before we will help.”",
};

// ---- WHO QR RESETS IS FOR -------------------------------------------------

export const QR_WHO_FOR = {
  intro:
    "QR Resets is designed for people experiencing a temporary or compounding crisis whose independence may be restored through meaningful, time-limited support.",
  mayBeTitle: "A person may be:",
  mayBe: [
    "Homeless",
    "At immediate risk of homelessness",
    "Leaving domestic violence",
    "Recovering from illness or injury",
    "Living with trauma or disability",
    "Estranged from family",
    "Unemployed or underemployed",
    "Missing transportation",
    "Buried in administrative barriers",
    "Unable to access existing benefits",
    "Trying to keep a family together",
    "Returning from hospitalization, incarceration or another major disruption",
    "Working but unable to absorb a sudden expense",
  ],
  diagnosisNote:
    "A diagnosis does not automatically include or exclude anyone.\n\nHaving PTSD, depression, anxiety, a physical disability, a substance-use history or another health condition does not make someone incapable of directing their own life.",
  question: "What support does this person say would restore stability and control?",
};

// ---- PERSON-DIRECTED PARTICIPATION ----------------------------------------

export const QR_PERSON_DIRECTED = {
  heading: "Nothing about the person without the person.",
  everyResetTitle: "Every Reset is:",
  everyReset: [
    "Created with the person",
    "Approved by the person",
    "Directed by the person",
    "Written in language the person understands",
    "Flexible enough to change when reality changes",
    "Voluntary from beginning to end",
  ],
  personDecidesTitle: "The person decides:",
  personDecides: [
    "What stability means",
    "Which problems matter first",
    "What help is wanted",
    "What help is not wanted",
    "Who may participate",
    "What information may be shared",
    "Whether a navigator is useful",
    "Whether the Reset should pause, change or end",
  ],
  closing: "Support adapts to the person. The person is not forced to adapt to the program.",
};

// ---- OUR CONSENT PROMISE --------------------------------------------------

export const QR_CONSENT_PROMISE = {
  heading: "Our Consent Promise",
  willNot: [
    "Coerce participation",
    "Manipulate someone into joining",
    "Pressure someone into treatment",
    "Require sobriety as a universal condition",
    "Force religious participation",
    "Require public gratitude",
    "Threaten to withdraw help for disagreeing",
    "Require a person to perform trauma",
    "Publish someone’s identity without separate consent",
    "Treat receiving help as consent to publicity",
    "Require obedience to a navigator",
    "Punish someone for revising the plan",
    "Automatically disqualify someone for missing a call, appointment, form or deadline while in crisis",
  ],
  closing: "Participation may be withdrawn at any time.",
  closing2: "Declining a recommendation does not automatically end a Reset.",
};

// ---- LOOSE RULES ----------------------------------------------------------

export const QR_LOOSE_RULES = {
  heading: "The rules are deliberately limited.",
  intro: "QR Resets requires only:",
  rules: [
    {
      n: 1,
      name: "Consent",
      desc: "The person understands and voluntarily approves the Reset.",
    },
    {
      n: 2,
      name: "Legality",
      desc: "Funds cannot knowingly finance unlawful activity.",
    },
    {
      n: 3,
      name: "Basic safety",
      desc: "QR Resets will not knowingly finance an action creating an immediate and serious danger.",
    },
    {
      n: 4,
      name: "Financial transparency",
      desc: "The fund publicly reports aggregate money received, administrative expenses and Reset spending.",
    },
    {
      n: 5,
      name: "Protection against exploitation",
      desc: "No navigator, partner, family member, vendor or donor may control or exploit the person through the Reset.",
    },
  ],
  closing: "These rules protect the person and the shared fund.",
  closing2: "They are not tools for controlling someone’s life.",
};

// ---- THE RISK DOCTRINE ----------------------------------------------------

export const QR_RISK_DOCTRINE = {
  heading:
    "We would rather occasionally help the “wrong” person than become another system that blocks the right one.",
  costOfWrong:
    "The cost of providing money to someone who may not have needed it—or may not use every dollar perfectly—is limited.",
  costOfDenyTitle: "The cost of wrongly denying someone in a real crisis can include:",
  costOfDeny: [
    "Prolonged homelessness",
    "Lost employment",
    "Family separation",
    "Medical deterioration",
    "Emergency-room use",
    "Lost documents and property",
    "Deeper trauma",
    "Chronic homelessness",
    "Greater public expense",
    "Loss of trust in every future source of help",
  ],
  operatesOn: "QR Resets therefore operates on presumptive trust.",
  verifyTitle: "We verify what is necessary to:",
  verify: [
    "Send money accurately",
    "Prevent organized exploitation",
    "Protect the person",
    "Report spending honestly",
  ],
  noMoral: "We do not require a person to prove moral worthiness.",
  closing:
    "QR Resets tolerates limited financial leakage before it tolerates preventable abandonment.",
};

// ---- HOW IT WORKS ---------------------------------------------------------

export const QR_HOW_IT_WORKS = {
  heading: "How It Works",
  steps: [
    {
      n: 1,
      title: "Scan",
      body: "A person scans a QR Resets code or visits the website.\n\nNo referral is required.",
    },
    {
      n: 2,
      title: "Tell us what is blocked",
      body: "The person identifies:",
      list: [
        "What happened",
        "What remains functional",
        "What is preventing progress",
        "What would help immediately",
        "What would create lasting stability",
        "What assistance is unwanted",
      ],
    },
    {
      n: 3,
      title: "Build the Reset together",
      body: "The person and a Reset builder create a flexible plan.\n\nThe plan identifies:",
      list: [
        "Immediate barriers",
        "Load-bearing barriers",
        "Available resources",
        "Missing resources",
        "Desired support",
        "Known costs",
        "Time-sensitive deadlines",
        "Backup options",
        "A maximum working budget",
      ],
    },
    {
      n: 4,
      title: "The person approves it",
      body: "Nothing moves forward until the person approves the plan.\n\nApproval is not permanent consent. The plan can change.",
    },
    {
      n: 5,
      title: "Fund the Reset",
      body: "Depending on the person’s preference and the nature of the expense, money may be:",
      list: [
        "Paid directly to the person",
        "Loaded onto a person-controlled card",
        "Paid to a landlord or utility",
        "Paid to a healthcare or transportation provider",
        "Split between direct funds and vendor payments",
        "Held as an emergency reserve",
      ],
      note: "Vendor payment is not mandatory when direct flexible money is the more effective option.",
    },
    {
      n: 6,
      title: "Remove the blockers together",
      body: "An optional navigator can help coordinate:",
      list: [
        "Housing",
        "Transportation",
        "Appointments",
        "Documents",
        "Benefits",
        "Vendors",
        "Deadlines",
        "Employment resources",
        "Follow-up",
      ],
      note: "The navigator executes the person’s plan.\n\nThe navigator does not control the person.",
    },
    {
      n: 7,
      title: "Close the Reset",
      body: "A Reset closes when:",
      list: [
        "The person says the agreed objective has been reached",
        "The person no longer wants assistance",
        "The plan changes into a different form of support",
        "The maximum budget is reached",
        "Continuing would violate the limited rules",
      ],
      note: "Closing a Reset is not a declaration that the person is “fixed.”\n\nIt means the agreed Reset has ended.",
    },
  ],
};

// ---- REQUEST A RESET ------------------------------------------------------

export const QR_REQUEST = {
  heading: "What would help you regain control?",
  reassurance: [
    "You do not need to prove that you are perfect.",
    "You do not need to tell your entire life story.",
    "You do not need a diagnosis.",
    "You do not need to agree to treatment.",
  ],
  prompt: "Tell us what is happening, what is blocked and what you believe would help.",
  fields: [
    {
      label: "What name should we use?",
      help: "This may be your legal name, chosen name or another name you are comfortable using.",
      type: "text" as const,
    },
    {
      label: "How should we contact you?",
      help: "",
      type: "choice" as const,
      options: ["Text", "Phone", "Email", "Another method"],
    },
    {
      label: "Where are you currently located?",
      help: "City and state are enough to begin.",
      type: "text" as const,
    },
    {
      label: "What is happening right now?",
      help: "Short answers are acceptable.",
      type: "textarea" as const,
    },
    {
      label: "What is the most urgent problem?",
      help: "What becomes worse if nothing changes soon?",
      type: "textarea" as const,
    },
    {
      label: "What is blocking you from resolving it yourself?",
      help: "Examples: Money, Housing, Transportation, Health, Documentation, Communication, Family support, Legal or administrative barriers, Childcare, Something else",
      type: "textarea" as const,
    },
    {
      label: "What do you believe would help?",
      help: "Your answer matters more than an outsider’s assumption.",
      type: "textarea" as const,
    },
    {
      label: "What support do you not want?",
      help: "Examples: No treatment referral, No family involvement, No religious provider, No public story, No case manager, No direct vendor payment, No phone calls",
      type: "textarea" as const,
    },
    {
      label: "Is there a deadline?",
      help: "Examples: Eviction date, Medical appointment, Job start, Court date, Utility shutoff, Shelter loss, Prescription pickup, School deadline",
      type: "text" as const,
    },
    {
      label: "What is already working?",
      help: "A Reset should preserve your strengths—not replace them.",
      type: "textarea" as const,
    },
    {
      label: "Is anyone currently helping?",
      help: "Optional.",
      type: "text" as const,
    },
    {
      label: "Do you want help building the Reset plan?",
      help: "",
      type: "choice" as const,
      options: ["Yes", "No", "Not sure", "I want to build it myself"],
    },
    {
      label: "Are there documents you want us to review?",
      help: "Optional. Documents are not required to submit an initial request.",
      type: "text" as const,
    },
  ],
  consentRequired: [
    "I understand that submitting this request does not require me to accept services, treatment, publicity or a plan I did not choose.",
    "I understand that any Reset plan must be created with me and approved by me before it is activated.",
  ],
  consentOptional: [
    "I give permission for QR Resets to contact me about this request.",
    "I may be willing to share part of my experience publicly later. I understand this is separate from receiving help and may be withdrawn.",
  ],
  submit: "START MY RESET REQUEST",
  confirmation: {
    heading: "Your request was received.",
    body: "You remain in control of what happens next.",
    note: "If you are facing an immediate medical or physical emergency, contact local emergency services. QR Resets is not an emergency-dispatch service.",
  },
};

// ---- GIVE $1 --------------------------------------------------------------

export const QR_GIVE = {
  heading: "Give one dollar. Help repair an entire chain.",
  intro:
    "A one-dollar contribution cannot pay a housing deposit, restore transportation or fund months of support by itself.\n\nThousands of one-dollar contributions can.",
  ctas: ["$1 MONTHLY", "$12 ANNUALLY", "CHOOSE ANOTHER AMOUNT", "SPONSOR MULTIPLE RESIDENTS"],
  explanationTitle: "Your contribution enters the shared Reset Fund.",
  fundSupportsTitle: "The fund supports:",
  fundSupports: [
    "Direct financial assistance",
    "Housing stabilization",
    "Transportation",
    "Healthcare access",
    "Communication",
    "Documents",
    "Benefits restoration",
    "Employment needs",
    "Optional navigation",
    "Emergency reserves",
    "Program operations",
    "Fraud protection",
    "Public financial reporting",
  ],
  donorRules: [
    "Donors do not control an individual’s plan.",
    "Donors do not purchase access to private information.",
    "Donors do not vote on whether someone deserves help.",
  ],
  phoenixModelTitle: "The Phoenix Model",
  phoenixModel:
    "Phoenix’s official July 1, 2025 population estimate was 1,665,481.",
  phoenixFormula: "1,665,481 × $1 × 12 = $19,985,772 per year",
  phoenixNote: "This is a mathematical participation scenario—not a fundraising forecast.",
  planningTitle: "Planning Capacity",
  planningIntro: "QR Resets currently models:",
  planning: [
    "15% for operations, verification, navigators, payment costs, fraud protection and reserves",
    "85% for direct Reset funding",
    "Approximately $15,000 as a conservative average funded cost per completed Reset",
  ],
  planningUnderTitle: "Under those assumptions:",
  planningUnder: [
    "Gross fund: $19,985,772",
    "85% available for Resets: $16,987,906",
    "Modeled capacity: approximately 1,100 Resets per year",
  ],
  planningNote:
    "This is a planning estimate.\n\nSome Resets will cost less.\n\nSome will cost substantially more.\n\nThe fund will publish actual costs and outcomes when operations begin.",
  costGrowthTitle: "Costs will not remain fixed.",
  costGrowthBody:
    "The planning model assumes costs may rise approximately 4% annually.",
  costGrowthScenario:
    "If donations remained flat while average Reset costs increased 4% each year:",
  costGrowthResults: [
    "Modeled average Reset cost would rise from $15,000 to approximately $18,250 after five annual increases.",
    "Annual capacity would fall from approximately 1,100 to approximately 930 Resets.",
  ],
  costGrowthForThatReasonTitle: "For that reason:",
  costGrowthForThatReason: [
    "Reset budgets will be updated regularly.",
    "Capacity claims will be revised when real cost data become available.",
    "The program will not promise a permanent fixed number of Resets.",
    "Sponsors and matching partners will be used to protect capacity as costs rise.",
  ],
};

// ---- RESET LEVELS ---------------------------------------------------------

export const QR_LEVELS = {
  heading: "Different crises require different levels of support.",
  intro:
    "The levels below are planning categories—not rigid eligibility classes.\n\nA person is not forced into the cheapest category.\n\nA person is not required to spend the maximum.",
  levels: [
    {
      code: "QR STABILIZE",
      title: "Immediate protection and breathing room",
      uses: [
        "Temporary lodging",
        "Transportation",
        "Phone access",
        "Food",
        "Medication access",
        "Identification",
        "Utility reconnection",
        "Emergency cash",
        "One urgent administrative barrier",
      ],
      range: "Working planning range: up to approximately $3,000",
    },
    {
      code: "QR RESTORE",
      title: "Repair the connected barriers preventing recovery",
      uses: [
        "Deposit and move-in costs",
        "Temporary rent bridge",
        "Transportation",
        "Healthcare",
        "Trauma support",
        "Benefits restoration",
        "Employment equipment",
        "Documentation",
        "Optional navigation",
        "Emergency reserve",
      ],
      range: "Working planning range: approximately $3,000–$10,000",
    },
    {
      code: "QR REBUILD",
      title: "Sustained support without lifelong management",
      uses: [
        "Housing stabilization",
        "Longer rent bridge",
        "Complex medical or disability coordination",
        "Family stabilization",
        "Legal or administrative navigation",
        "Employment rebuilding",
        "Transportation restoration",
        "Nine to twelve months of optional navigation",
        "Larger emergency reserve",
      ],
      range: "Working planning range: approximately $10,000–$25,000",
    },
  ],
  noteTitle: "Important Note",
  note: "These are not automatic caps.",
  noteBody: "Actual plans depend on:",
  noteFactors: [
    "The person’s goals",
    "Current costs",
    "Available resources",
    "Household size",
    "Local housing conditions",
    "Time required",
    "What the person approves",
    "What the fund can responsibly support",
  ],
};

// ---- OUR RULES PAGE -------------------------------------------------------

export const QR_RULES_PAGE = {
  heading: "Loose rules. Strong rights.",
  intro:
    "QR Resets is intentionally easier to enter than systems built around suspicion.\n\nThat does not mean no accountability.\n\nIt means accountability is focused on money, consent and exploitation—not personal obedience.",
  rightsTitle: "The Person’s Rights",
  rightsIntro: "Every person receiving a Reset has the right to:",
  rights: [
    "Understand the plan",
    "Approve or reject the plan",
    "Change the plan",
    "Decline treatment",
    "Decline publicity",
    "Decline family involvement",
    "Request direct financial control",
    "Ask why a decision was made",
    "Correct inaccurate information",
    "Choose whether to work with a navigator",
    "Replace a navigator",
    "Pause the Reset",
    "End participation",
    "Receive a record of approved spending",
    "Report coercion or exploitation",
    "Appeal a funding decision",
  ],
  navBoundariesTitle: "Navigator Boundaries",
  navMayTitle: "A navigator may:",
  navMay: [
    "Organize",
    "Make calls with permission",
    "Schedule appointments",
    "Research options",
    "Coordinate payments",
    "Track deadlines",
    "Help gather documents",
    "Explain choices",
    "Follow up",
    "Carry out person-approved tasks",
  ],
  navMayNotTitle: "A navigator may not:",
  navMayNot: [
    "Control the person’s life",
    "Force treatment",
    "Demand gratitude",
    "Threaten assistance",
    "Contact family without permission",
    "Publish private information",
    "Make medical decisions",
    "Make legal decisions",
    "Use the Reset to impose personal beliefs",
    "Retaliate because the person disagrees",
    "Treat the person’s plan as the navigator’s property",
  ],
  misuseTitle: "Misuse Policy",
  misuseIntro: "QR Resets distinguishes between:",
  misuseCategories: [
    {
      name: "Imperfect use",
      desc: "A person makes a choice others might not have made.\n\nThat is not automatically fraud.",
    },
    {
      name: "Changed circumstances",
      desc: "A planned expense is no longer the best use of the money.\n\nThe plan can change.",
    },
    {
      name: "Mistakes",
      desc: "A person misses an appointment, loses a receipt or handles something poorly during a crisis.\n\nThat is not automatic disqualification.",
    },
    {
      name: "Fraud",
      desc: "A person or organization intentionally uses material deception to obtain or divert funds.",
    },
  ],
  fraudTitle: "Fraud may result in:",
  fraudResults: [
    "A pause",
    "A plan review",
    "Recovery efforts",
    "Removal of an exploitative third party",
    "Closure in severe cases",
    "Legal reporting when legally required",
  ],
  fraudClosing:
    "Fraud controls must remain proportionate.\n\nThey must not turn every person requesting help into a suspect.",
};

// ---- TRANSPARENCY ---------------------------------------------------------

export const QR_TRANSPARENCY = {
  heading: "Trust people. Audit the fund.",
  willPublishTitle: "QR Resets will publish:",
  willPublish: [
    "Total contributions",
    "Number of contributors",
    "Administrative spending",
    "Direct Reset spending",
    "Average Reset cost",
    "Median Reset cost",
    "Spending by broad category",
    "Number of active Resets",
    "Number of closed Resets",
    "Unused funds returned to the pool",
    "Aggregate outcomes",
    "Complaints received",
    "Appeals",
    "Confirmed fraud losses",
    "Corrective actions",
  ],
  willNotTitle: "QR Resets will not publish without separate consent:",
  willNot: [
    "Names",
    "Faces",
    "Diagnoses",
    "Addresses",
    "Medical records",
    "Legal records",
    "Family information",
    "Trauma details",
    "Personally identifying case histories",
  ],
  closing: "Financial transparency does not require exposing vulnerable people.",
  outcomesTitle: "Outcome Definitions",
  outcomes: [
    { name: "Stabilized", desc: "The immediate danger or primary blocker identified by the person was addressed." },
    { name: "Housed", desc: "The person entered a housing arrangement the person recognizes as housing." },
    { name: "Independently sustained", desc: "The person reports being able to maintain the primary Reset outcome without continuing QR Resets funding." },
    { name: "Partially completed", desc: "Some approved objectives were achieved, but others remain open." },
    { name: "Redirected", desc: "The person chose a different objective or support path." },
    { name: "Withdrawn", desc: "The person voluntarily ended participation." },
    { name: "Closed by fund", desc: "QR Resets ended the plan because of exhausted funds, legal restrictions, immediate safety concerns or verified material fraud." },
  ],
  outcomesNote: "“Closed” does not automatically mean “successful” or “failed.”",
};

// ---- DEFINITIONS ----------------------------------------------------------

export const QR_DEFINITIONS = {
  heading: "Definitions",
  terms: [
    { term: "QR Resets™", def: "A community-funded system using QR codes and online access to collect small contributions and finance voluntary, person-directed stabilization plans." },
    { term: "QR code", def: "A scannable code connecting someone to the donation page, Reset request page, public dashboard or another approved QR Resets destination." },
    { term: "Reset", def: "A bounded package of flexible money, coordination and support designed to remove the connected barriers preventing a person from regaining stability and autonomy." },
    { term: "Reset request", def: "A person’s initial description of what is happening, what is blocked and what assistance may help.\n\nA request is not an agreement to participate." },
    { term: "Reset plan", def: "A flexible record of the person’s chosen objective, current barriers, approved supports, expected expenses, timing, consent boundaries, optional navigation and backup options.\n\nThe Reset plan is not a behavior contract." },
    { term: "Reset builder", def: "A person who helps translate the requester’s goals into a workable, costed plan.\n\nThe builder does not decide the person’s life goals." },
    { term: "Navigator", def: "An optional support person who helps execute the approved Reset plan.\n\nA navigator coordinates. A navigator does not control." },
    { term: "Person-directed", def: "The person receiving help retains authority over personal goals, participation, information sharing and plan changes." },
    { term: "Informed consent", def: "The person receives understandable information about the plan, risks, choices, data use and funding before agreeing." },
    { term: "Revocable consent", def: "Consent can be withdrawn.\n\nPast consent does not create permanent permission." },
    { term: "Loose rules", def: "The deliberately limited operating requirements of consent, legality, basic safety, financial transparency and protection against exploitation." },
    { term: "Presumptive trust", def: "The starting assumption that the person is describing the crisis honestly unless concrete evidence shows otherwise." },
    { term: "Load-bearing blocker", def: "A barrier that prevents several other recovery steps from working.\n\nExamples: No phone prevents callbacks, job contact and appointment confirmation. No transportation prevents work, healthcare and document retrieval. No identification prevents employment, benefits and housing. No temporary housing prevents sleep, organization, healthcare and continued work." },
    { term: "Flexible funds", def: "Money that may be used across approved categories when rigid vendor restrictions would undermine the Reset." },
    { term: "Reset Fund", def: "The pooled account holding contributions designated for QR Resets assistance and approved operating expenses." },
    { term: "Financial leakage", def: "Money that may be lost through imperfect use, error or misuse.\n\nQR Resets treats limited leakage as less harmful than creating barriers that routinely deny legitimate help." },
    { term: "Organized exploitation", def: "Coordinated deception or control by a person, vendor, employee, partner or third party designed to divert Reset funds." },
    { term: "Public story", def: "Any published case narrative, image, video, testimonial or identifying account.\n\nConsent to receive help is never consent to become a public story." },
  ],
};

// ---- EVIDENCE AND METHODOLOGY ---------------------------------------------

export const QR_EVIDENCE = {
  heading: "Evidence and Methodology",
  verifiedTitle: "What is verified",
  verifiedSections: [
    {
      title: "Phoenix population",
      value: "1,665,481",
      details: [
        "Geography: Phoenix city, Arizona",
        "Estimate date: July 1, 2025",
        "Vintage: U.S. Census Bureau Vintage 2025",
        "Publication date: May 14, 2026",
      ],
      source: "https://www.census.gov/newsroom/press-releases/2026/vintage-2025-city-town-pop-estimates.html",
    },
    {
      title: "Mathematical $1 scenario",
      value: "1,665,481 × $1 × 12 = $19,985,772",
      details: [
        "This is the gross amount generated if the fund receives one $1 monthly contribution per Phoenix resident.",
        "It is not a participation forecast.",
      ],
      source: null,
    },
    {
      title: "2026 Phoenix PIT count",
      value: "Total: 7,335",
      details: [
        "Sheltered: 4,041",
        "Unsheltered outside the Safe Outdoor Space: 3,093",
        "Safe Outdoor Space: 201",
        "Formula: 4,041 + 3,093 + 201 = 7,335",
        "Count date: January 2026",
        "Publication date: May 18, 2026",
      ],
      source: "https://www.phoenix.gov/newsroom/homeless-solutions-news/over-half-of-phoenix-s-unhoused-residents-now-sheltered-as-city-.html",
      note: "The PIT count is a one-night estimate. It is not the number of people experiencing homelessness over an entire year.",
    },
    {
      title: "Current reactive-cost comparison",
      value: "AIR study (March 2026)",
      details: [
        "The American Institutes for Research estimated identifiable annual spending of approximately:",
        "$14,650 per person served in emergency shelters",
        "$15,970 per person experiencing unsheltered homelessness",
        "Publication: The Costs Associated With Homelessness in Phoenix, Arizona",
        "Report date: March 2026",
        "Published online: June 12, 2026",
      ],
      source: "https://www.air.org/sites/default/files/2026-06/The-Costs-Associated-With-Homelessness-in-Phoenix-AZ-Brief-March-2026.pdf",
      note: "Important limitation: The AIR study did not calculate every cost of homelessness or the cost of ending homelessness. It examined identifiable spending using available city data and limited shelter coverage.\n\nQR Resets does not claim that AIR’s figures prove the cost of a Reset.\n\nThey provide local scale for comparison.",
    },
  ],
  modeledTitle: "What is modeled",
  modeledSections: [
    {
      title: "Administrative and reserve assumption",
      value: "15%",
      details: [
        "This is a planning assumption, not a verified operating result.",
        "It includes: Payment processing, Verification, Navigation, Data systems, Fraud protection, Financial reporting, Insurance, Legal compliance, Emergency overruns, General operations.",
      ],
    },
    {
      title: "Direct Reset allocation",
      value: "85%",
      details: ["Formula: $19,985,772 × 85% = $16,987,906", "Rounded to the nearest dollar."],
    },
    {
      title: "Average funded Reset",
      value: "$15,000",
      details: [
        "This is a conservative planning assumption.",
        "It is not a published government estimate.",
        "It is intentionally higher than a one-time emergency payment because a real Reset may include months of housing support, navigation, transportation, health access and an emergency buffer.",
      ],
    },
    {
      title: "Modeled annual capacity",
      value: "$16,987,906 ÷ $15,000 = 1,132.53",
      details: ["Public rounded claim: Approximately 1,100 Resets per year", "This is not a guarantee."],
    },
    {
      title: "Cost-growth scenario",
      value: "4% annual increase",
      details: [
        "After five annual increases: $15,000 × 1.04⁵ = approximately $18,250",
        "Flat net funding divided by increased cost: $16,987,906 ÷ $18,250 = approximately 931",
        "Public rounded claim: Approximately 930 Resets after five annual cost increases if revenue remains flat",
      ],
    },
  ],
  notClaimTitle: "What QR Resets does not claim",
  notClaims: [
    "That exactly 4,800 Phoenix residents fit the QR Resets model",
    "That every nonchronically homeless person needs a Reset",
    "That every person can regain independence through $15,000",
    "That $20 million would end Phoenix homelessness",
    "That a PIT count represents annual homelessness",
    "That every Phoenix resident will personally contribute",
    "That administrative costs will remain exactly 15%",
    "That costs will rise exactly 4%",
    "That every Reset will succeed",
    "That imperfect spending equals fraud",
    "That diagnoses determine personal capacity",
  ],
  notClaimClosing:
    "A reliable Phoenix-specific count of people suited to QR Resets does not currently exist.\n\nThat number must be learned through transparent operation and outcome data—not invented.",
};

// ---- FAQ ------------------------------------------------------------------

export const QR_FAQ = {
  heading: "FAQ",
  items: [
    {
      q: "Is QR Resets a homelessness program?",
      a: "Not exclusively.\n\nQR Resets may help people who are homeless, at risk of homelessness or facing another destabilizing crisis.\n\nIts focus is preventing a recoverable crisis from becoming permanent collapse.",
    },
    {
      q: "Does someone need to be homeless?",
      a: "No.\n\nPreventing housing loss may be more effective and less expensive than responding after someone becomes homeless.",
    },
    { q: "Does someone need a diagnosis?", a: "No." },
    {
      q: "Are people with mental illness excluded?",
      a: "No.\n\nA diagnosis does not determine whether someone can direct a Reset.",
    },
    {
      q: "Are people with substance-use conditions excluded?",
      a: "No.\n\nQR Resets does not use a universal sobriety requirement.\n\nImmediate safety and the person’s chosen goals still matter.",
    },
    {
      q: "Does QR Resets provide permanent supportive housing?",
      a: "No.\n\nQR Resets may help connect someone to long-term services, but it is designed primarily for flexible, time-limited stabilization.",
    },
    {
      q: "Who decides what a person needs?",
      a: "The person does.\n\nReset builders and navigators may provide information and options, but the person approves the plan.",
    },
    {
      q: "Can a person receive cash directly?",
      a: "Yes, when lawful and appropriate.\n\nDirect vendor payments may also be used when the person prefers them or when they are operationally useful.",
    },
    {
      q: "Will every expense require a receipt?",
      a: "No.\n\nSome expenses can be documented through receipts, invoices or payment records. Others may use flexible allowances.\n\nReceipt rules should not make assistance unusable.",
    },
    {
      q: "What if someone spends money imperfectly?",
      a: "Imperfect decisions are not automatically fraud.\n\nThe plan can be adjusted.",
    },
    {
      q: "What if someone lies?",
      a: "Material deception may trigger a review.\n\nThe response must remain proportionate and should not become a justification for treating every requester as dishonest.",
    },
    {
      q: "Why not screen everyone extensively first?",
      a: "Because excessive screening can block people whose crisis prevents them from completing complex applications.\n\nQR Resets uses limited verification focused on identity, payment accuracy, immediate safety and organized exploitation.",
    },
    {
      q: "Is everyone guaranteed funding?",
      a: "No.\n\nThe fund is limited.\n\nSubmission creates a request, not a guarantee.",
    },
    {
      q: "How are requests prioritized?",
      a: "Priority may consider:",
      list: [
        "Immediate physical danger",
        "Imminent housing loss",
        "Children or dependents affected",
        "Time-sensitive healthcare",
        "Time-sensitive employment",
        "Deadlines",
        "Whether a limited intervention can prevent substantial additional harm",
        "Available funds",
        "Whether another source can meet the need faster",
      ],
      closing: "Priority does not measure human worth.",
    },
    { q: "Do donors choose recipients?", a: "No." },
    {
      q: "Can donors receive private updates?",
      a: "Only when the person separately and specifically consents.",
    },
    { q: "Can someone leave the program?", a: "Yes.\n\nAt any time." },
    {
      q: "What happens to unused money?",
      a: "Unused money returns to the shared Reset Fund unless law or a restricted funding source requires another disposition.",
    },
    {
      q: "Is QR Resets currently claiming it can end homelessness?",
      a: "No.\n\nQR Resets is designed to prevent avoidable, recoverable cases from becoming deeper and more permanent.",
    },
    {
      q: "Is the “1,100 Resets” number guaranteed?",
      a: "No.\n\nIt is a planning estimate based on $19,985,772 gross annual contributions, 15% operations and reserves, and $15,000 modeled average Reset cost.\n\nActual capacity will depend on participation, real expenses, household needs and cost growth.",
    },
  ],
};

// ---- FOOTER ---------------------------------------------------------------

export const QR_FOOTER = {
  brand: "QR Resets™",
  tagline: "One scan. One dollar. One real Reset.",
  links: [
    "Request Help",
    "Give",
    "Consent Standards",
    "Financial Transparency",
    "Privacy",
    "Terms",
    "Accessibility",
    "Evidence and Methodology",
    "Report Coercion or Exploitation",
    "Contact",
  ],
  disclaimer:
    "QR Resets is not an emergency-dispatch service, healthcare provider, law firm or government agency. Funding is limited and not guaranteed. Receiving assistance does not require treatment, religious participation, publicity or surrender of personal autonomy. Public planning estimates are assumptions, not promised outcomes.",
};

// ---- SOCIAL / CARD COPY (for sharing modules) -----------------------------

export const QR_SOCIAL = {
  shortPost:
    "What if Phoenix generated one $1 monthly contribution for every resident?\n\nThat would equal nearly $20 million per year.\n\nQR Resets would use it to repair the connected barriers—housing, transportation, healthcare, communication, paperwork and real follow-through—that turn recoverable crises into permanent collapse.\n\nNo deservingness test. No forced treatment. No trauma performance. No control disguised as help.\n\nOne scan. One dollar. One real Reset.",
  launchPost:
    "QR Resets is built around one belief:\n\nThe cost of occasionally helping someone who may not have needed every dollar is lower than the cost of building another suspicious, bureaucratic charity that blocks the most vulnerable people.\n\nQR Resets funds voluntary, person-directed plans that repair the connected barriers preventing someone from regaining stability.\n\nThe person builds and approves the plan.\n\nThe rules are intentionally limited: Consent, Legality, Basic safety, Financial transparency, Protection against exploitation.\n\nNo forced treatment. No public story required. No obedience contract. No demand that someone prove moral worth before receiving practical help.\n\nOne scan. One dollar. One real Reset.",
};

export const QR_BUTTONS = [
  "Give $1 Monthly",
  "Sponsor 10 Residents",
  "Request a Reset",
  "Build My Reset",
  "See How Funds Move",
  "Read Our Rules",
  "View Public Numbers",
  "Review the Evidence",
  "Report a Problem",
  "Appeal a Decision",
  "Withdraw Consent",
  "Change My Plan",
];
