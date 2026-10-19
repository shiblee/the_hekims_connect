/** The question shown above each specializations / services group — same wording in profile setup and Facility Profile → Services. */
export const GROUP_QUESTION: Record<string, string> = {
  specialization: "Which medical specializations are available?",
  service_diagnostic: "Which diagnostic & examination services do you offer?",
  service_emergency: "Which emergency services do you offer?",
  service_maternal_child: "Which maternal & child health services do you offer?",
  service_other: "Which other Unani services do you offer?",
};

export const groupQuestion = (key: string, label: string) => GROUP_QUESTION[key] ?? `Which ${label.toLowerCase()} do you offer?`;

export const EMERGENCY_QUESTION = "Do you provide emergency care or an ambulance?";
