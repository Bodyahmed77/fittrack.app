// ============================================================
// FitTrack — Privacy Policy & Legal Content
// ============================================================
// Centralized legal text so it can be edited in one place without
// touching the app UI.
// ============================================================

export const APP_INFO = {
  name: "FitTrack",
  version: "1.0.0",
  developer: "FitTrack",
  email: "sumoslmer47@gmail.com",
  whatsapp: "201108178493",
  website: "https://bodyahmed77.github.io/fittrack.app/",
};

export const PRIVACY_POLICY_SECTIONS = [
  {
    title: "Effective Date",
    body: "This Privacy Policy is effective as of August 11, 2026 and applies to users of FitTrack.",
  },
  {
    title: "1. Introduction",
    body: 'FitTrack ("we", "our", "us") respects your privacy. This Privacy Policy explains what information we collect when you use our mobile application (the "App"), why we collect it, how it is used, and how you can request deletion of your account and associated data.',
  },
  {
    title: "2. Information We Collect",
    body: "We handle the following categories of information to provide and improve the App:\n\n• Account Information: name, email address, Google sign-in information, and an optional phone number if you choose to provide one for support.\n\n• Personal & Fitness Data: age, gender, height, weight, fitness goals, activity level, and preferred workout days that you provide.\n\n• Workout History: exercises completed, weights, repetitions, sets, and training dates.\n\n• Weight Logs: body-weight entries and their dates.\n\n• Nutrition Data: foods you log and your daily calorie and macro targets.\n\n• Subscription Status: active Pro entitlements and expiration information needed to provide paid features.\n\n• AI Coach Requests: information from your current FitTrack context and your message that is sent to Google's Gemini API to generate an answer. FitTrack does not store a chat-history database. If you report an AI answer, the reported answer snippet and your report reason are stored in Supabase so we can review safety and quality issues.\n\n• Device & Usage Data: limited technical information needed to operate and troubleshoot the App.",
  },
  {
    title: "3. How We Use Your Information",
    body: "We use information to:\n\n• Create and manage your account.\n• Generate personalized workout and nutrition plans.\n• Track workouts, weight, and meals.\n• Provide and manage Pro subscription features.\n• Provide AI Coach responses when you request them.\n• Send local reminders and notifications you have enabled.\n• Provide support through email or WhatsApp when you contact us.\n• Improve reliability, security, and performance.\n\nWe do not sell your personal information.",
  },
  {
    title: "4. How We Store & Protect Your Data",
    body: "Account and app data are stored using Google Firebase (Authentication and Cloud Firestore). Subscription entitlement and AI usage records are stored in Supabase. We use authenticated requests, HTTPS, server-side authorization checks, and database security controls. No method of transmission or storage is completely risk-free, but we apply reasonable safeguards appropriate to the service.",
  },
  {
    title: "5. AI Coach & Google Gemini",
    body: "AI Coach sends the information necessary to answer your request to Google's Gemini API. FitTrack does not store conversations in a chat-history table or permanent chat log. Google's handling of Gemini API prompts, responses, abuse-monitoring logs, and related technical data is governed by Google's applicable Gemini API terms and policies. We do not use Google Search or Maps grounding in AI Coach.",
  },
  {
    title: "6. Payments & Subscriptions",
    body: "Pro subscriptions are processed through Google Play Billing. FitTrack does not collect or store your payment card details. Google Play manages payment processing and subscription management. You can manage or cancel a Google Play subscription through Google Play's subscription center. Deleting your FitTrack account does not automatically cancel a Google Play subscription.",
  },
  {
    title: "7. Notifications",
    body: "With your permission, FitTrack may schedule local workout reminders on your device. These notifications are generated locally and are not a separate server-side messaging history.",
  },
  {
    title: "8. Data Sharing & Third Parties",
    body: "We do not sell or rent your personal information. We use trusted service providers necessary to operate the App, including Google Firebase, Google Play Billing, Supabase, and Google Gemini API. Each service processes information according to its applicable terms and policies.",
  },
  {
    title: "9. Analytics & Crash Reporting",
    body: "FitTrack does not currently use a separate third-party analytics or crash-reporting SDK that stores a personal analytics profile. If this changes, this policy will be updated to describe the relevant data handling.",
  },
  {
    title: "10. Your Rights & Account Deletion",
    body: "You can update your information through the App. You can request deletion of your account and associated FitTrack data from Settings → Delete Account while signed in. The deletion flow removes the Firebase account, Firestore profile, and server-side Supabase records associated with the account, including entitlement, purchase-token-claim, and AI-usage records.\n\nIf you no longer have the App installed, use the external deletion resource at https://bodyahmed77.github.io/fittrack.app/account-deletion.html.\n\nGoogle Play may retain transaction records required for its own payment, legal, fraud-prevention, or accounting purposes. Google Play subscription cancellation is separate and must be performed through Google Play.",
  },
  {
    title: "11. Children's Privacy",
    body: "The App is not directed at children under 13, and we do not knowingly collect personal information from children under 13.",
  },
  {
    title: "12. Changes to This Policy",
    body: "We may update this Privacy Policy when our data practices change. Material changes will be reflected in the published policy and, where appropriate, in the App.",
  },
  {
    title: "13. Contact Us",
    body: "For privacy or deletion requests:\n\nEmail: sumoslmer47@gmail.com\nWhatsApp: +20 110 817 8493\nWebsite: https://bodyahmed77.github.io/fittrack.app/",
  },
];

export const TERMS_SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: 'By downloading, accessing, or using FitTrack (the "App"), you agree to these Terms of Service. If you do not agree, please do not use the App.',
  },
  {
    title: "2. Use of the App",
    body: "FitTrack provides fitness tracking, workout plans, nutrition information, and an AI Coach for general informational and educational purposes. The App is not medical advice, diagnosis, or treatment. AI Coach is for general fitness and nutrition guidance only and should not be used for diagnosis, treatment, or emergency decisions. Consult a qualified health professional before starting an exercise or nutrition program, especially if you have a medical condition.",
  },
  {
    title: "3. Accounts",
    body: "You are responsible for maintaining access to your account and for providing accurate information. You may request account deletion at any time through the App or the external deletion resource.",
  },
  {
    title: "4. Subscriptions & Payments",
    body: "Pro features are provided through Google Play Billing subscriptions. Subscriptions may renew automatically according to the selected Google Play base plan. You can manage or cancel them through Google Play. Refunds are handled according to applicable law and Google Play's refund policies.",
  },
  {
    title: "5. Intellectual Property",
    body: "FitTrack's original app content, illustrations, text, graphics, and design are protected by applicable intellectual property laws. Third-party names, services, and media remain the property of their respective owners.",
  },
  {
    title: "6. Limitation of Liability",
    body: 'The App is provided "as is" without warranties of any kind. To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from use of the App.',
  },
  {
    title: "7. Termination",
    body: "You may stop using FitTrack and request account deletion at any time. We may suspend access for abuse, fraud, or material violations of these Terms.",
  },
  {
    title: "8. Contact",
    body: "For questions about these Terms, contact us at sumoslmer47@gmail.com.",
  },
];
