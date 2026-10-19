import { defineStrings } from "./define";

// Patient app frame: side menu and top bar.
export const PATIENT_SHELL = defineStrings("patient.shell", {
  nav_dashboard: ["Dashboard", "डैशबोर्ड", "ڈیش بورڈ", "لوحة التحكم", "داشبورد"],
  nav_records: ["My Records", "मेरे रिकॉर्ड", "میرے ریکارڈز", "سجلاتي", "پرونده‌های من"],
  nav_profile: ["Medical Profile", "चिकित्सा प्रोफ़ाइल", "طبی پروفائل", "الملف الطبي", "نمایهٔ پزشکی"],
  nav_appointments: ["Appointments", "अपॉइंटमेंट", "اپوائنٹمنٹس", "المواعيد", "نوبت‌ها"],
  nav_messages: ["Messages", "संदेश", "پیغامات", "الرسائل", "پیام‌ها"],
  nav_prescriptions: ["Prescriptions", "नुस्ख़े", "نسخے", "الوصفات", "نسخه‌ها"],
  book: ["Book Appointment", "अपॉइंटमेंट बुक करें", "اپوائنٹمنٹ بک کریں", "احجز موعدًا", "رزرو نوبت"],
  patient: ["Patient", "मरीज़", "مریض", "مريض", "بیمار"],
  hello: ["Hello, {name}", "नमस्ते, {name}", "السلام علیکم، {name}", "مرحبًا، {name}", "سلام، {name}"],
  mizaj: ["Mizaj:", "मिज़ाज:", "مزاج:", "المزاج:", "مزاج:"],
  blood: ["Blood {group}", "रक्त समूह {group}", "بلڈ گروپ {group}", "فصيلة الدم {group}", "گروه خونی {group}"],
  tagline: ["Your healing journey, harmonised.", "आपकी स्वास्थ्य यात्रा, संतुलित।", "آپ کا شفا کا سفر، ہم آہنگ۔", "رحلة شفائك، في انسجام.", "سفر درمان شما، در هماهنگی."],
  open_menu: ["Open menu", "मेन्यू खोलें", "مینو کھولیں", "فتح القائمة", "باز کردن منو"],
  messages: ["Messages", "संदेश", "پیغامات", "الرسائل", "پیام‌ها"],
});
