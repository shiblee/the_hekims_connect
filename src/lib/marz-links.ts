// Links from Amraz catalogue entries to the history conditions the diet (Ghiza) rules already
// understand, so a confirmed diagnosis shapes the diet as well as the temperament does.
import type { ConditionKey } from "@/lib/ghiza-conditions";

export const MARZ_CONDITIONS: Record<string, ConditionKey[]> = {
  humuzat_e_meda: ["acidity"], waram_e_meda: ["acidity"], qurha_e_meda: ["acidity"],
  qabz: ["constipation"], bawaseer: ["piles", "constipation"], ishal: ["ibs"], zaheer: ["ibs"],
  yarqan: ["liver"], zof_e_kabid: ["liver"], waram_e_kabid: ["liver"], hasat_e_marara: ["liver", "cholesterol"],
  rabv: ["asthma"], suaal_ratb: ["asthma"],
  waja_ul_mafasil_barid: ["arthritis"], waja_ul_mafasil_haar: ["arthritis"], khushunat_e_mafasil: ["arthritis", "obesity"], niqras: ["gout"],
  shaqeeqa: ["migraine"],
  nar_e_farsi: ["skin"], da_us_sadaf: ["skin"], busoor_dammal: ["skin"], shara: ["skin"],
  hasat_e_kulya: ["kidney_stones"], ziabetus: ["diabetes"],
  faqr_ud_dam: ["anaemia"], saman_e_mufrit: ["obesity"], zaght_ud_dam_qawi: ["hypertension"],
  ehtebas_e_tams: ["pcos"],
};
