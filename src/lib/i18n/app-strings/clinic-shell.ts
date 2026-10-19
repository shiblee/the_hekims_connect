import { defineStrings } from "./define";

// Clinic app frame: side menu, top bar, account area.
export const CLINIC_SHELL = defineStrings("clinic.shell", {
  nav_dashboard: ["Dashboard", "डैशबोर्ड", "ڈیش بورڈ", "لوحة التحكم", "داشبورد"],
  nav_reception: ["Reception desk", "रिसेप्शन डेस्क", "ریسیپشن ڈیسک", "مكتب الاستقبال", "میز پذیرش"],
  nav_patients: ["Patients", "मरीज़", "مریض", "المرضى", "بیماران"],
  nav_payments: ["Payments", "भुगतान", "ادائیگیاں", "المدفوعات", "پرداخت‌ها"],
  nav_mizaj: ["Mizaj Assessment", "मिज़ाज आकलन", "مزاج کا جائزہ", "تقييم المزاج", "ارزیابی مزاج"],
  nav_pharmacy: ["Pharmacy", "फ़ार्मेसी", "فارمیسی", "الصيدلية", "داروخانه"],
  nav_appointments: ["Appointments", "अपॉइंटमेंट", "اپوائنٹمنٹس", "المواعيد", "نوبت‌ها"],
  nav_messages: ["Messages", "संदेश", "پیغامات", "الرسائل", "پیام‌ها"],
  nav_prescriptions: ["Prescriptions", "नुस्ख़े", "نسخے", "الوصفات", "نسخه‌ها"],
  start_consultation: ["Start Consultation", "परामर्श शुरू करें", "مشاورت شروع کریں", "بدء الاستشارة", "شروع مشاوره"],
  hello: ["Hello, {name}", "नमस्ते, {name}", "السلام علیکم، {name}", "مرحبًا، {name}", "سلام، {name}"],
  staff: ["Staff", "स्टाफ़", "عملہ", "موظف", "کارمند"],
  rating: ["Rating {rating}★", "रेटिंग {rating}★", "ریٹنگ {rating}★", "التقييم {rating}★", "امتیاز {rating}★"],
  search_patients: ["Search patients…", "मरीज़ खोजें…", "مریض تلاش کریں…", "ابحث عن المرضى…", "جست‌وجوی بیماران…"],
  open_menu: ["Open menu", "मेन्यू खोलें", "مینو کھولیں", "فتح القائمة", "باز کردن منو"],
  notifications: ["Notifications", "सूचनाएँ", "اطلاعات", "الإشعارات", "اعلان‌ها"],
});
