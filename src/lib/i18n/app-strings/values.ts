import { defineStrings } from "./define";

// Display labels for common stored option values (the stored value itself never changes).
// Keys are the stored English value; anything not listed is shown as stored.
export const VALUE_LABELS = defineStrings("common.values", {
  Male: ["Male", "पुरुष", "مرد", "ذكر", "مرد"],
  Female: ["Female", "महिला", "عورت", "أنثى", "زن"],
  Other: ["Other", "अन्य", "دیگر", "آخر", "دیگر"],
  "Prefer not to say": ["Prefer not to say", "बताना नहीं चाहते", "بتانا نہیں چاہتے", "أفضّل عدم الإفصاح", "ترجیح می‌دهم نگویم"],
  Single: ["Single", "अविवाहित", "غیر شادی شدہ", "أعزب", "مجرد"],
  Married: ["Married", "विवाहित", "شادی شدہ", "متزوج", "متأهل"],
  Divorced: ["Divorced", "तलाक़शुदा", "طلاق یافتہ", "مطلّق", "مطلقه"],
  Widowed: ["Widowed", "विधवा/विधुर", "بیوہ/رنڈوا", "أرمل", "بیوه"],
  Separated: ["Separated", "अलग रह रहे", "علیحدہ", "منفصل", "جدا شده"],
  Self: ["Self", "स्वयं", "خود", "نفسه", "خود"],
  Spouse: ["Spouse", "पति/पत्नी", "شریکِ حیات", "الزوج/الزوجة", "همسر"],
  Father: ["Father", "पिता", "والد", "الأب", "پدر"],
  Mother: ["Mother", "माता", "والدہ", "الأم", "مادر"],
  Son: ["Son", "बेटा", "بیٹا", "الابن", "پسر"],
  Daughter: ["Daughter", "बेटी", "بیٹی", "الابنة", "دختر"],
  Brother: ["Brother", "भाई", "بھائی", "الأخ", "برادر"],
  Sister: ["Sister", "बहन", "بہن", "الأخت", "خواهر"],
  Guardian: ["Guardian", "अभिभावक", "سرپرست", "الوصي", "سرپرست"],
  Friend: ["Friend", "मित्र", "دوست", "صديق", "دوست"],
  Relative: ["Relative", "रिश्तेदार", "رشتہ دار", "قريب", "خویشاوند"],
  Cash: ["Cash", "नक़द", "نقد", "نقدًا", "نقد"],
  UPI: ["UPI", "UPI", "UPI", "UPI", "UPI"],
  Card: ["Card", "कार्ड", "کارڈ", "بطاقة", "کارت"],
  "Bank transfer": ["Bank transfer", "बैंक ट्रांसफ़र", "بینک ٹرانسفر", "تحويل بنكي", "انتقال بانکی"],
  Cheque: ["Cheque", "चेक", "چیک", "شيك", "چک"],
});
