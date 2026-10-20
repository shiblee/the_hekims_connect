/**
 * Meta list behind the "Why won't the family go for the referral?" dropdown in the
 * referral-decline pop-up. Admins manage it in Admin → Meta; these are only the starting options.
 */
export const REFERRAL_DECLINE_SECTION = {
  key: "referral_decline_reason",
  label: "Referral Decline Reasons",
  category: "Clinical",
  options: [
    "Cannot afford the referral / treatment cost",
    "Hospital is too far / no transport",
    "No one available to accompany the patient",
    "Prefers to continue Unani treatment here",
    "Fear or distrust of hospital treatment",
    "Feels the problem is not serious",
    "Wants to consult family elders first",
    "Previous bad experience at a hospital",
    "Other",
  ],
};
