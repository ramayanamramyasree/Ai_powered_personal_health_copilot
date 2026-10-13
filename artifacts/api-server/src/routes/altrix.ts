import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import {
  AnalyzeDocumentBody,
  AnalyzeDocumentParams,
  ConfirmDocumentBody,
  ConfirmDocumentParams,
  CreateDocumentBody,
  CreateFeedbackBody,
  CreateFeedbackResponse,
  DeleteDocumentParams,
  GetDocumentParams,
  GetAdminOverviewResponse,
  GetDocumentResponse,
  GetProfileResponse,
  GetTranslationsParams,
  GetTranslationsResponse,
  ListAdminDocumentsResponse,
  ListAdminFeedbackResponse,
  ListAdminPatientsResponse,
  ListDocumentsResponse,
  ListMyFeedbackResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
} from "@workspace/api-zod";
import {
  db,
  medicalDocumentsTable,
  patientFeedbackTable,
  translationsTable,
  userProfilesTable,
} from "@workspace/db";
import { requireAdmin, requirePatient, requireSignedIn, type AltrixRequest } from "../lib/altrixAuth";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const medicalDocumentTypes = [
  "prescription",
  "lab_report",
  "discharge_summary",
  "diagnostic_report",
  "other",
] as const;
const locales = ["en", "hi", "ta", "te"] as const;

const translationSeed: Record<(typeof locales)[number], Record<string, string>> = {
  en: {
    brand: "Altrix Labs", product: "Health Copilot", nav_home: "Home", nav_how: "How it works",
    nav_safety: "Your privacy", sign_in: "Sign in", create_account: "Create account",
    hero_eyebrow: "Your health, made clearer", hero_title: "Understand your health story.",
    hero_copy: "Bring your medical reports and prescriptions together. Get a clear, careful summary you can review and share with your care team.",
    get_started: "Get started", learn_more: "Explore how it works", trust_title: "Built around your health and privacy",
    feature_records: "One clear health timeline", feature_records_copy: "Keep reports and prescriptions organized in one place.",
    feature_summary: "Understand each report", feature_summary_copy: "Read a plain-language explanation alongside the original document.",
    feature_language: "Your language, your choice", feature_language_copy: "Switch the interface and summaries between English, Hindi, Tamil, and Telugu.",
    safety_note: "AI readings can be wrong, especially with handwriting. Review every extracted detail and confirm it with a healthcare professional.",
    portal_title: "Your health space", welcome: "Welcome back", upload: "Add a medical document",
    upload_hint: "Upload a clear photo or PDF of a medical report or prescription. Handwritten notes are supported as a reviewable draft.",
    choose_file: "Choose file", supported_files: "PDF, JPG, PNG, or WebP · up to 15 MB",
    document_type: "Document type", prescription: "Prescription", lab_report: "Lab report",
    discharge_summary: "Discharge summary", diagnostic_report: "Diagnostic report", other: "Other medical document",
    records: "Your records", timeline: "Health timeline", no_records: "Your timeline is ready for your first document.",
    health_profile: "Your health profile", reviewed_health_facts: "FROM RECORDS YOU CONFIRMED",
    health_profile_safety: "Only details from records you confirmed appear here. Lab flags are copied from the report; they are not diagnoses.",
    health_profile_empty: "Reviewed medicines, test values, and terms will appear here after you confirm an extracted record.",
    reference_range: "Reference range", source_flag: "Report flag", verify_against_source: "Please verify against the original record.",
    ai_reading_unavailable: "AI reading is not set up yet. Your uploaded file is saved; please contact the administrator.",
    analyze: "Read document", analyzing: "Reading document…", review_required: "Please review this draft",
    confirm_extraction: "Confirm details", edit_details: "Edit details", extracted_text: "Text read from document",
    plain_summary: "In simple language", medications: "Medicines", lab_values: "Test results",
    diagnoses: "Terms mentioned", document_date: "Document date", confidence: "Reading confidence",
    feedback: "Share feedback", feedback_hint: "Your feedback helps us improve the experience.",
    feedback_message: "Your message", rating: "Rating", submit_feedback: "Send feedback", feedback_sent: "Thanks for sharing.",
    language: "Language", settings: "Preferences", admin_portal: "Admin", patients: "Patients",
    analytics: "Analytics", all_documents: "All documents", patient_feedback: "Patient feedback",
    total_patients: "Total patients", active_patients: "Active this month", total_documents: "Documents",
    pending_reviews: "Awaiting review", average_rating: "Average rating", no_feedback: "No feedback yet.",
    no_patients: "No patient accounts yet.", loading: "Loading…", save: "Save", cancel: "Cancel",
    sign_out: "Sign out", back_home: "Back to home", account_error: "Could not load your account.",
    upload_error: "Upload failed. Please try again.", analyze_error: "Could not read this file. Check that it is a medical document and try again.",
    not_medical: "This file does not appear to be a medical report or prescription. Only medical documents can be processed.",
    emergency: "For urgent symptoms, call your local emergency service. Altrix is not an emergency service.",
    privacy: "Your private records are only visible to you and the one authorized administrator.",
    search: "Search", updated: "Updated", category: "Category", experience: "Experience",
    accuracy: "Reading accuracy", accessibility: "Accessibility", average: "Average", month: "Month",
    no_documents: "No documents yet", awaiting_review: "Awaiting your review", confirmed: "Confirmed by you",
    uploaded: "Uploaded", remove: "Remove", delete_confirm: "Remove this document from your records?",
    processing_note: "This is an AI-assisted reading, not a diagnosis or a prescription. Confirm medicines and doses with your clinician or pharmacist.",
    view_original: "View original document", readable: "Readable", unclear: "Unclear — please verify",
    feedback_category: "Feedback topic",
  },
  hi: {
    brand: "Altrix Labs", product: "हेल्थ कोपायलट", nav_home: "होम", nav_how: "कैसे काम करता है",
    nav_safety: "आपकी गोपनीयता", sign_in: "साइन इन करें", create_account: "खाता बनाएँ",
    hero_eyebrow: "आपका स्वास्थ्य, अब अधिक स्पष्ट", hero_title: "अपनी स्वास्थ्य यात्रा को समझें।",
    hero_copy: "अपनी मेडिकल रिपोर्ट और पर्चे एक जगह रखें। सरल सारांश पाएँ जिसे आप जाँचकर अपनी देखभाल टीम के साथ साझा कर सकते हैं।",
    get_started: "शुरू करें", learn_more: "जानें कैसे काम करता है", trust_title: "आपके स्वास्थ्य और गोपनीयता को ध्यान में रखकर",
    feature_records: "स्वास्थ्य की एक स्पष्ट समयरेखा", feature_records_copy: "रिपोर्ट और पर्चे एक ही जगह व्यवस्थित रखें।",
    feature_summary: "हर रिपोर्ट को समझें", feature_summary_copy: "मूल दस्तावेज़ के साथ सरल भाषा में विवरण पढ़ें।",
    feature_language: "अपनी पसंद की भाषा", feature_language_copy: "अंग्रेज़ी, हिंदी, तमिल और तेलुगु में बदलें।",
    safety_note: "हस्तलिखित सामग्री सहित AI की रीडिंग गलत हो सकती है। हर जानकारी जाँचें और स्वास्थ्य पेशेवर से पुष्टि करें।",
    portal_title: "आपका स्वास्थ्य केंद्र", welcome: "वापसी पर स्वागत है", upload: "मेडिकल दस्तावेज़ जोड़ें",
    upload_hint: "मेडिकल रिपोर्ट या पर्चे की साफ़ तस्वीर या PDF अपलोड करें। हस्तलिखित नोट्स भी जाँचने योग्य ड्राफ्ट के रूप में उपलब्ध हैं।",
    choose_file: "फ़ाइल चुनें", supported_files: "PDF, JPG, PNG या WebP · अधिकतम 15 MB",
    document_type: "दस्तावेज़ का प्रकार", prescription: "दवा का पर्चा", lab_report: "लैब रिपोर्ट",
    discharge_summary: "डिस्चार्ज सारांश", diagnostic_report: "जाँच रिपोर्ट", other: "अन्य मेडिकल दस्तावेज़",
    records: "आपके रिकॉर्ड", timeline: "स्वास्थ्य समयरेखा", no_records: "पहला दस्तावेज़ जोड़ने के लिए आपकी समयरेखा तैयार है।",
    health_profile: "आपकी स्वास्थ्य प्रोफ़ाइल", reviewed_health_facts: "आपके द्वारा जाँचे गए रिकॉर्ड",
    health_profile_safety: "यहाँ केवल आपके द्वारा जाँचे गए रिकॉर्ड की जानकारी है। जाँच के संकेत रिपोर्ट से लिए गए हैं; वे निदान नहीं हैं।",
    health_profile_empty: "किसी रिकॉर्ड से निकाली गई जानकारी की पुष्टि करने के बाद दवाएँ, जाँच के नतीजे और उल्लेखित शब्द यहाँ दिखेंगे।",
    reference_range: "संदर्भ सीमा", source_flag: "रिपोर्ट का संकेत", verify_against_source: "मूल रिकॉर्ड से फिर जाँचें।",
    ai_reading_unavailable: "AI से पढ़ना अभी सेट अप नहीं है। आपकी अपलोड की गई फ़ाइल सुरक्षित है; कृपया एडमिन से संपर्क करें।",
    analyze: "दस्तावेज़ पढ़ें", analyzing: "दस्तावेज़ पढ़ा जा रहा है…", review_required: "कृपया इस ड्राफ्ट की जाँच करें",
    confirm_extraction: "जानकारी की पुष्टि करें", edit_details: "जानकारी बदलें", extracted_text: "दस्तावेज़ से पढ़ा गया पाठ",
    plain_summary: "सरल भाषा में", medications: "दवाएँ", lab_values: "जाँच के नतीजे",
    diagnoses: "उल्लेखित शब्द", document_date: "दस्तावेज़ की तारीख", confidence: "रीडिंग का विश्वास",
    feedback: "सुझाव दें", feedback_hint: "आपके सुझाव से अनुभव बेहतर होगा।", feedback_message: "आपका संदेश",
    rating: "रेटिंग", submit_feedback: "सुझाव भेजें", feedback_sent: "सुझाव देने के लिए धन्यवाद।",
    language: "भाषा", settings: "पसंद", admin_portal: "एडमिन", patients: "मरीज़",
    analytics: "विश्लेषण", all_documents: "सभी दस्तावेज़", patient_feedback: "मरीज़ों के सुझाव",
    total_patients: "कुल मरीज़", active_patients: "इस महीने सक्रिय", total_documents: "दस्तावेज़",
    pending_reviews: "जाँच बाकी", average_rating: "औसत रेटिंग", no_feedback: "अभी कोई सुझाव नहीं है।",
    no_patients: "अभी कोई मरीज़ खाता नहीं है।", loading: "लोड हो रहा है…", save: "सहेजें", cancel: "रद्द करें",
    sign_out: "साइन आउट", back_home: "होम पर जाएँ", account_error: "खाता लोड नहीं हो सका।",
    upload_error: "अपलोड विफल हुआ। फिर से प्रयास करें।", analyze_error: "फ़ाइल पढ़ी नहीं जा सकी। मेडिकल दस्तावेज़ जाँचकर फिर प्रयास करें।",
    not_medical: "यह मेडिकल रिपोर्ट या पर्चा नहीं लगता। केवल मेडिकल दस्तावेज़ संसाधित किए जा सकते हैं।",
    emergency: "तत्काल लक्षणों के लिए स्थानीय आपातकालीन सेवा को कॉल करें। Altrix आपातकालीन सेवा नहीं है।",
    privacy: "आपके निजी रिकॉर्ड केवल आपको और एक अधिकृत एडमिन को दिखाई देते हैं।",
    search: "खोजें", updated: "अपडेट किया गया", category: "श्रेणी", experience: "अनुभव",
    accuracy: "रीडिंग की सटीकता", accessibility: "सुगम्यता", average: "औसत", month: "महीना",
    no_documents: "अभी कोई दस्तावेज़ नहीं है", awaiting_review: "आपकी जाँच बाकी", confirmed: "आपने पुष्टि की",
    uploaded: "अपलोड किया गया", remove: "हटाएँ", delete_confirm: "क्या इस दस्तावेज़ को रिकॉर्ड से हटाएँ?",
    processing_note: "यह AI से पढ़ी गई जानकारी है, निदान या पर्चा नहीं। दवा और खुराक की पुष्टि डॉक्टर या फ़ार्मासिस्ट से करें।",
    view_original: "मूल दस्तावेज़ देखें", readable: "पढ़ने योग्य", unclear: "अस्पष्ट — कृपया जाँचें",
    feedback_category: "सुझाव का विषय",
  },
  ta: {
    brand: "Altrix Labs", product: "ஹெல்த் கோபைலட்", nav_home: "முகப்பு", nav_how: "செயல்முறை",
    nav_safety: "உங்கள் தனியுரிமை", sign_in: "உள்நுழை", create_account: "கணக்கை உருவாக்கு",
    hero_eyebrow: "உங்கள் ஆரோக்கியம், தெளிவாக", hero_title: "உங்கள் ஆரோக்கியப் பயணத்தைப் புரிந்துகொள்ளுங்கள்.",
    hero_copy: "மருத்துவ அறிக்கைகளையும் மருந்துச் சீட்டுகளையும் ஒரே இடத்தில் ஒழுங்குபடுத்துங்கள். சரிபார்த்து பகிரக்கூடிய எளிய சுருக்கத்தைப் பெறுங்கள்.",
    get_started: "தொடங்குங்கள்", learn_more: "எப்படி செயல்படுகிறது", trust_title: "உங்கள் ஆரோக்கியத்தையும் தனியுரிமையையும் மையமாகக் கொண்டது",
    feature_records: "தெளிவான ஆரோக்கிய காலவரிசை", feature_records_copy: "அறிக்கைகளையும் மருந்துச் சீட்டுகளையும் ஒரே இடத்தில் வைத்திருங்கள்.",
    feature_summary: "ஒவ்வொரு அறிக்கையையும் புரிந்துகொள்ளுங்கள்", feature_summary_copy: "அசல் ஆவணத்துடன் எளிய விளக்கத்தையும் படியுங்கள்.",
    feature_language: "உங்கள் மொழி, உங்கள் விருப்பம்", feature_language_copy: "ஆங்கிலம், இந்தி, தமிழ், தெலுங்கு ஆகியவற்றில் மாற்றுங்கள்.",
    safety_note: "கையெழுத்து உட்பட AI வாசிப்பு தவறாக இருக்கலாம். ஒவ்வொரு விவரத்தையும் சரிபார்த்து சுகாதார நிபுணரிடம் உறுதிப்படுத்துங்கள்.",
    portal_title: "உங்கள் ஆரோக்கிய இடம்", welcome: "மீண்டும் வரவேற்கிறோம்", upload: "மருத்துவ ஆவணத்தைச் சேர்க்கவும்",
    upload_hint: "மருத்துவ அறிக்கை அல்லது மருந்துச் சீட்டின் தெளிவான புகைப்படம் அல்லது PDF-ஐ பதிவேற்றவும். கையெழுத்து குறிப்புகள் சரிபார்க்க வேண்டிய வரைவு வடிவில் வழங்கப்படும்.",
    choose_file: "கோப்பைத் தேர்ந்தெடுக்கவும்", supported_files: "PDF, JPG, PNG அல்லது WebP · அதிகபட்சம் 15 MB",
    document_type: "ஆவண வகை", prescription: "மருந்துச் சீட்டு", lab_report: "ஆய்வக அறிக்கை",
    discharge_summary: "வெளியேற்றச் சுருக்கம்", diagnostic_report: "பரிசோதனை அறிக்கை", other: "மற்ற மருத்துவ ஆவணம்",
    records: "உங்கள் பதிவுகள்", timeline: "ஆரோக்கிய காலவரிசை", no_records: "முதல் ஆவணத்திற்காக உங்கள் காலவரிசை தயாராக உள்ளது.",
    health_profile: "உங்கள் ஆரோக்கிய விவரங்கள்", reviewed_health_facts: "நீங்கள் உறுதிப்படுத்திய பதிவுகள்",
    health_profile_safety: "நீங்கள் சரிபார்த்து உறுதிப்படுத்திய பதிவுகளின் விவரங்கள் மட்டுமே இங்கே இருக்கும். ஆய்வகக் குறிகள் அறிக்கையிலிருந்து எடுக்கப்பட்டவை; அவை நோயறிதல் அல்ல.",
    health_profile_empty: "பிரித்தெடுக்கப்பட்ட விவரங்களை நீங்கள் உறுதிப்படுத்திய பிறகு மருந்துகள், பரிசோதனை மதிப்புகள் மற்றும் குறிப்பிடப்பட்ட சொற்கள் இங்கே தோன்றும்.",
    reference_range: "குறிப்பு வரம்பு", source_flag: "அறிக்கை குறி", verify_against_source: "அசல் பதிவுடன் மீண்டும் சரிபார்க்கவும்.",
    ai_reading_unavailable: "AI வாசிப்பு இன்னும் அமைக்கப்படவில்லை. நீங்கள் பதிவேற்றிய கோப்பு சேமிக்கப்பட்டுள்ளது; நிர்வாகியைத் தொடர்புகொள்ளவும்.",
    analyze: "ஆவணத்தைப் படிக்கவும்", analyzing: "ஆவணம் படிக்கப்படுகிறது…", review_required: "இந்த வரைவைக் சரிபார்க்கவும்",
    confirm_extraction: "விவரங்களை உறுதிப்படுத்தவும்", edit_details: "விவரங்களைத் திருத்தவும்", extracted_text: "ஆவணத்திலிருந்து வாசித்த உரை",
    plain_summary: "எளிய மொழியில்", medications: "மருந்துகள்", lab_values: "பரிசோதனை முடிவுகள்",
    diagnoses: "குறிப்பிடப்பட்ட சொற்கள்", document_date: "ஆவண தேதி", confidence: "வாசிப்பு நம்பகத்தன்மை",
    feedback: "கருத்து தெரிவிக்கவும்", feedback_hint: "உங்கள் கருத்து அனுபவத்தை மேம்படுத்தும்.", feedback_message: "உங்கள் செய்தி",
    rating: "மதிப்பீடு", submit_feedback: "கருத்தை அனுப்பவும்", feedback_sent: "பகிர்ந்ததற்கு நன்றி.",
    language: "மொழி", settings: "விருப்பங்கள்", admin_portal: "நிர்வாகி", patients: "நோயாளிகள்",
    analytics: "புள்ளிவிவரங்கள்", all_documents: "அனைத்து ஆவணங்கள்", patient_feedback: "நோயாளிகளின் கருத்துகள்",
    total_patients: "மொத்த நோயாளிகள்", active_patients: "இந்த மாதம் செயலில்", total_documents: "ஆவணங்கள்",
    pending_reviews: "சரிபார்ப்பு நிலுவையில்", average_rating: "சராசரி மதிப்பீடு", no_feedback: "இன்னும் கருத்துகள் இல்லை.",
    no_patients: "இன்னும் நோயாளர் கணக்குகள் இல்லை.", loading: "ஏற்றப்படுகிறது…", save: "சேமி", cancel: "ரத்து செய்",
    sign_out: "வெளியேறு", back_home: "முகப்புக்குச் செல்லவும்", account_error: "உங்கள் கணக்கை ஏற்ற முடியவில்லை.",
    upload_error: "பதிவேற்றம் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.", analyze_error: "இந்தக் கோப்பைப் படிக்க முடியவில்லை. மருத்துவ ஆவணமா எனச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.",
    not_medical: "இது மருத்துவ அறிக்கை அல்லது மருந்துச் சீட்டாகத் தெரியவில்லை. மருத்துவ ஆவணங்களை மட்டுமே செயலாக்க முடியும்.",
    emergency: "அவசர அறிகுறிகளுக்கு உள்ளூர் அவசர சேவையை அழைக்கவும். Altrix அவசர சேவை அல்ல.",
    privacy: "உங்கள் தனிப்பட்ட பதிவுகளை நீங்கள் மற்றும் அங்கீகரிக்கப்பட்ட ஒரே நிர்வாகி மட்டுமே பார்க்கலாம்.",
    search: "தேடு", updated: "புதுப்பிக்கப்பட்டது", category: "வகை", experience: "அனுபவம்",
    accuracy: "வாசிப்பு துல்லியம்", accessibility: "அணுகல்தன்மை", average: "சராசரி", month: "மாதம்",
    no_documents: "இன்னும் ஆவணங்கள் இல்லை", awaiting_review: "உங்கள் சரிபார்ப்பு நிலுவையில்", confirmed: "நீங்கள் உறுதிப்படுத்தியது",
    uploaded: "பதிவேற்றப்பட்டது", remove: "நீக்கு", delete_confirm: "இந்த ஆவணத்தைப் பதிவுகளிலிருந்து நீக்கவா?",
    processing_note: "இது AI உதவியுடன் வாசிக்கப்பட்ட தகவல்; நோயறிதல் அல்லது மருந்துச் சீட்டு அல்ல. மருந்துகளையும் அளவுகளையும் மருத்துவர் அல்லது மருந்தாளரிடம் உறுதிப்படுத்துங்கள்.",
    view_original: "அசல் ஆவணத்தைப் பார்க்கவும்", readable: "படிக்கக்கூடியது", unclear: "தெளிவில்லை — சரிபார்க்கவும்",
    feedback_category: "கருத்தின் வகை",
  },
  te: {
    brand: "Altrix Labs", product: "హెల్త్ కోపైలట్", nav_home: "హోమ్", nav_how: "ఎలా పనిచేస్తుంది",
    nav_safety: "మీ గోప్యత", sign_in: "సైన్ ఇన్", create_account: "ఖాతా సృష్టించండి",
    hero_eyebrow: "మీ ఆరోగ్యం, మరింత స్పష్టంగా", hero_title: "మీ ఆరోగ్య ప్రయాణాన్ని అర్థం చేసుకోండి.",
    hero_copy: "మీ వైద్య నివేదికలు, ప్రిస్క్రిప్షన్‌లను ఒకేచోట క్రమబద్ధీకరించండి. తనిఖీ చేసి మీ సంరక్షణ బృందంతో పంచుకోగల సులభమైన సారాంశాన్ని పొందండి.",
    get_started: "ప్రారంభించండి", learn_more: "ఇది ఎలా పనిచేస్తుంది", trust_title: "మీ ఆరోగ్యం, గోప్యత కోసం రూపొందించబడింది",
    feature_records: "స్పష్టమైన ఆరోగ్య కాలక్రమం", feature_records_copy: "నివేదికలు, ప్రిస్క్రిప్షన్‌లను ఒకేచోట ఉంచండి.",
    feature_summary: "ప్రతి నివేదికను అర్థం చేసుకోండి", feature_summary_copy: "అసలు పత్రంతో పాటు సరళమైన వివరణను చదవండి.",
    feature_language: "మీ భాష, మీ ఎంపిక", feature_language_copy: "ఇంగ్లీష్, హిందీ, తమిళం, తెలుగులో మార్చుకోండి.",
    safety_note: "చేతిరాతతో సహా AI చదివిన వివరాలు తప్పవచ్చు. ప్రతి అంశాన్ని తనిఖీ చేసి ఆరోగ్య నిపుణుడితో నిర్ధారించండి.",
    portal_title: "మీ ఆరోగ్య స్థలం", welcome: "తిరిగి స్వాగతం", upload: "వైద్య పత్రాన్ని జోడించండి",
    upload_hint: "వైద్య నివేదిక లేదా ప్రిస్క్రిప్షన్ యొక్క స్పష్టమైన ఫోటో లేదా PDFను అప్‌లోడ్ చేయండి. చేతిరాత నోట్స్ తనిఖీ చేయగల డ్రాఫ్ట్‌గా అందించబడతాయి.",
    choose_file: "ఫైల్ ఎంచుకోండి", supported_files: "PDF, JPG, PNG లేదా WebP · గరిష్ఠం 15 MB",
    document_type: "పత్రం రకం", prescription: "ప్రిస్క్రిప్షన్", lab_report: "ల్యాబ్ నివేదిక",
    discharge_summary: "డిశ్చార్జ్ సారాంశం", diagnostic_report: "పరీక్ష నివేదిక", other: "ఇతర వైద్య పత్రం",
    records: "మీ రికార్డులు", timeline: "ఆరోగ్య కాలక్రమం", no_records: "మీ మొదటి పత్రం కోసం కాలక్రమం సిద్ధంగా ఉంది.",
    health_profile: "మీ ఆరోగ్య ప్రొఫైల్", reviewed_health_facts: "మీరు నిర్ధారించిన రికార్డుల నుంచి",
    health_profile_safety: "మీరు తనిఖీ చేసి నిర్ధారించిన రికార్డుల వివరాలే ఇక్కడ కనిపిస్తాయి. ల్యాబ్ సూచనలు అసలు నివేదికలో ఉన్నవే; అవి నిర్ధారణలు కావు.",
    health_profile_empty: "సేకరించిన వివరాలను మీరు నిర్ధారించిన తర్వాత మందులు, పరీక్ష విలువలు, ప్రస్తావించిన పదాలు ఇక్కడ కనిపిస్తాయి.",
    reference_range: "సూచన పరిధి", source_flag: "నివేదిక సూచన", verify_against_source: "అసలు రికార్డుతో మళ్లీ తనిఖీ చేయండి.",
    ai_reading_unavailable: "AI రీడింగ్ ఇంకా సెటప్ కాలేదు. మీరు అప్‌లోడ్ చేసిన ఫైల్ సేవ్ అయింది; నిర్వాహకుడిని సంప్రదించండి.",
    analyze: "పత్రాన్ని చదవండి", analyzing: "పత్రాన్ని చదువుతోంది…", review_required: "ఈ డ్రాఫ్ట్‌ను తనిఖీ చేయండి",
    confirm_extraction: "వివరాలను నిర్ధారించండి", edit_details: "వివరాలను సవరించండి", extracted_text: "పత్రం నుంచి చదివిన వచనం",
    plain_summary: "సరళమైన భాషలో", medications: "మందులు", lab_values: "పరీక్ష ఫలితాలు",
    diagnoses: "ప్రస్తావించిన పదాలు", document_date: "పత్రం తేదీ", confidence: "చదివిన విశ్వాస స్థాయి",
    feedback: "అభిప్రాయం ఇవ్వండి", feedback_hint: "మీ అభిప్రాయం అనుభవాన్ని మెరుగుపరుస్తుంది.", feedback_message: "మీ సందేశం",
    rating: "రేటింగ్", submit_feedback: "అభిప్రాయం పంపండి", feedback_sent: "పంచుకున్నందుకు ధన్యవాదాలు.",
    language: "భాష", settings: "ప్రాధాన్యతలు", admin_portal: "అడ్మిన్", patients: "రోగులు",
    analytics: "విశ్లేషణలు", all_documents: "అన్ని పత్రాలు", patient_feedback: "రోగుల అభిప్రాయాలు",
    total_patients: "మొత్తం రోగులు", active_patients: "ఈ నెలలో యాక్టివ్", total_documents: "పత్రాలు",
    pending_reviews: "తనిఖీ చేయాల్సినవి", average_rating: "సగటు రేటింగ్", no_feedback: "ఇంకా అభిప్రాయాలు లేవు.",
    no_patients: "ఇంకా రోగి ఖాతాలు లేవు.", loading: "లోడ్ అవుతోంది…", save: "సేవ్ చేయండి", cancel: "రద్దు చేయండి",
    sign_out: "సైన్ అవుట్", back_home: "హోమ్‌కు తిరిగి వెళ్ళండి", account_error: "మీ ఖాతాను లోడ్ చేయలేకపోయాము.",
    upload_error: "అప్‌లోడ్ విఫలమైంది. మళ్లీ ప్రయత్నించండి.", analyze_error: "ఈ ఫైల్‌ను చదవలేకపోయాము. ఇది వైద్య పత్రమో తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.",
    not_medical: "ఇది వైద్య నివేదిక లేదా ప్రిస్క్రిప్షన్‌గా కనిపించడం లేదు. వైద్య పత్రాలను మాత్రమే ప్రాసెస్ చేయగలం.",
    emergency: "అత్యవసర లక్షణాలు ఉంటే స్థానిక అత్యవసర సేవలకు కాల్ చేయండి. Altrix అత్యవసర సేవ కాదు.",
    privacy: "మీ ప్రైవేట్ రికార్డులను మీరు మరియు ఒక అధీకృత అడ్మిన్ మాత్రమే చూడగలరు.",
    search: "వెతకండి", updated: "నవీకరించబడింది", category: "వర్గం", experience: "అనుభవం",
    accuracy: "చదివిన ఖచ్చితత్వం", accessibility: "అందుబాటు", average: "సగటు", month: "నెల",
    no_documents: "ఇంకా పత్రాలు లేవు", awaiting_review: "మీ తనిఖీ కోసం వేచి ఉంది", confirmed: "మీరు నిర్ధారించారు",
    uploaded: "అప్‌లోడ్ చేయబడింది", remove: "తొలగించండి", delete_confirm: "ఈ పత్రాన్ని మీ రికార్డుల నుంచి తొలగించాలా?",
    processing_note: "ఇది AI సహాయంతో చదివిన సమాచారం మాత్రమే; నిర్ధారణ లేదా ప్రిస్క్రిప్షన్ కాదు. మందులు, మోతాదులను వైద్యుడు లేదా ఫార్మసిస్ట్‌తో నిర్ధారించండి.",
    view_original: "అసలు పత్రాన్ని చూడండి", readable: "చదవగలిగేలా ఉంది", unclear: "స్పష్టంగా లేదు — తనిఖీ చేయండి",
    feedback_category: "అభిప్రాయం అంశం",
  },
};

function asRequest(req: Parameters<typeof requirePatient>[0]) {
  return req as AltrixRequest;
}

function documentDto(doc: typeof medicalDocumentsTable.$inferSelect) {
  return {
    id: doc.id,
    fileName: doc.fileName,
    documentType: doc.documentType,
    status: doc.status,
    createdAt: doc.createdAt,
    extractedText: doc.extractedText,
    summary: doc.summary,
    translatedSummary: doc.translatedSummary,
    summaryLocale: doc.summaryLocale,
    extraction: doc.extraction,
    confidence: doc.confidence,
    requiresReview: doc.requiresReview,
  };
}

function feedbackDto(item: typeof patientFeedbackTable.$inferSelect) {
  return {
    id: item.id,
    category: item.category,
    rating: item.rating,
    message: item.message,
    createdAt: item.createdAt,
  };
}

function supportedMedicalObjectPath(value: string): boolean {
  return /^\/objects\/[A-Za-z0-9/_-]+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isOptionalString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isMedicineExtractionList(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every((item) =>
    isRecord(item) &&
    typeof item.name === "string" && item.name.trim().length > 0 &&
    isOptionalString(item.dose) &&
    isOptionalString(item.frequency) &&
    isOptionalString(item.duration) &&
    isConfidence(item.confidence) &&
    typeof item.uncertain === "boolean"
  );
}

function isLabValueExtractionList(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every((item) =>
    isRecord(item) &&
    typeof item.name === "string" && item.name.trim().length > 0 &&
    ((typeof item.value === "string" && item.value.trim().length > 0) ||
      (typeof item.value === "number" && Number.isFinite(item.value))) &&
    isOptionalString(item.unit) &&
    isOptionalString(item.referenceRange) &&
    isOptionalString(item.flag) &&
    isConfidence(item.confidence)
  );
}

function normalizeDocumentDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

router.get("/profile", requireSignedIn, async (req, res): Promise<void> => {
  const profile = asRequest(req).altrixProfile!;
  res.json(
    GetProfileResponse.parse({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      locale: profile.locale,
      role: profile.role,
      createdAt: profile.createdAt,
    }),
  );
});

router.put("/profile", requirePatient, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid language preference" });
    return;
  }
  const userId = asRequest(req).altrixUserId!;
  const [profile] = await db
    .update(userProfilesTable)
    .set({ locale: parsed.data.locale })
    .where(eq(userProfilesTable.id, userId))
    .returning();
  res.json(UpdateProfileResponse.parse(profile));
});

router.get("/translations/:locale", async (req, res): Promise<void> => {
  const params = GetTranslationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Unsupported language" });
    return;
  }
  const seedRows = locales.flatMap((locale) =>
    Object.entries(translationSeed[locale]).map(([translationKey, value]) => ({
      id: `${locale}:${translationKey}`,
      locale,
      translationKey,
      value,
    })),
  );
  await db.insert(translationsTable).values(seedRows).onConflictDoNothing();
  const rows = await db
    .select({
      key: translationsTable.translationKey,
      value: translationsTable.value,
    })
    .from(translationsTable)
    .where(eq(translationsTable.locale, params.data.locale));
  res.json(GetTranslationsResponse.parse(Object.fromEntries(rows.map((row) => [row.key, row.value]))));
});

router.get("/documents", requirePatient, async (req, res): Promise<void> => {
  const userId = asRequest(req).altrixUserId!;
  const documents = await db
    .select()
    .from(medicalDocumentsTable)
    .where(eq(medicalDocumentsTable.ownerId, userId))
    .orderBy(desc(medicalDocumentsTable.createdAt));
  res.json(ListDocumentsResponse.parse(documents.map(documentDto)));
});

router.post("/documents", requirePatient, async (req, res): Promise<void> => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid medical document details" });
    return;
  }
  if (!supportedMedicalObjectPath(parsed.data.objectPath)) {
    res.status(400).json({ error: "Only private uploaded medical documents are accepted" });
    return;
  }
  const userId = asRequest(req).altrixUserId!;
  try {
    const file = await storage.getObjectEntityFile(parsed.data.objectPath);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(400).json({ error: "Uploaded file was not found" });
      return;
    }
    const [document] = await db
      .insert(medicalDocumentsTable)
      .values({
        id: randomUUID(),
        ownerId: userId,
        fileName: parsed.data.fileName,
        objectPath: parsed.data.objectPath,
        documentType: parsed.data.documentType,
        status: "uploaded",
      })
      .returning();
    res.status(201).json(GetDocumentResponse.parse(documentDto(document)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to save uploaded medical document");
    res.status(400).json({ error: "Could not save uploaded document" });
  }
});

router.get("/documents/:id", requirePatient, async (req, res): Promise<void> => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  const userId = asRequest(req).altrixUserId!;
  const [document] = await db
    .select()
    .from(medicalDocumentsTable)
    .where(and(eq(medicalDocumentsTable.id, params.data.id), eq(medicalDocumentsTable.ownerId, userId)))
    .limit(1);
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(GetDocumentResponse.parse(documentDto(document)));
});

router.post("/documents/:id/analyze", requirePatient, async (req, res): Promise<void> => {
  const params = AnalyzeDocumentParams.safeParse(req.params);
  const body = AnalyzeDocumentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid analysis request" });
    return;
  }
  const userId = asRequest(req).altrixUserId!;
  const [document] = await db
    .select()
    .from(medicalDocumentsTable)
    .where(and(eq(medicalDocumentsTable.id, params.data.id), eq(medicalDocumentsTable.ownerId, userId)))
    .limit(1);
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ error: "AI document reading is not configured" });
    return;
  }
  if (!supportedMedicalObjectPath(document.objectPath)) {
    res.status(400).json({ error: "Invalid stored document path" });
    return;
  }

  await db
    .update(medicalDocumentsTable)
    .set({ status: "processing" })
    .where(eq(medicalDocumentsTable.id, document.id));
  try {
    const file = await storage.getObjectEntityFile(document.objectPath);
    const [bytes] = await file.download();
    const base64 = bytes.toString("base64");
    const suffix = document.fileName.toLowerCase().split(".").pop();
    const mimeType =
      suffix === "pdf"
        ? "application/pdf"
        : suffix === "png"
          ? "image/png"
          : suffix === "webp"
            ? "image/webp"
            : "image/jpeg";
    const targetLanguage = {
      en: "English",
      hi: "Hindi",
      ta: "Tamil",
      te: "Telugu",
    }[body.data.locale];
    const instructions = `You are a careful medical-document reader. Read only the supplied medical report or prescription; do not infer missing facts, diagnose the patient, recommend treatment, or change medication instructions. Never guess a medicine name, dose, date, lab value, unit, or reference range. Use null when a field is not stated or not legible. For handwriting, mark the affected medicine as uncertain=true, lower its confidence, and plainly say when text is unclear. Return one JSON object with exactly these keys: extractedText (string), documentType, documentDate (ISO date YYYY-MM-DD or null), medicines (array of objects with name, dose, frequency, duration, confidence from 0 to 1, uncertain boolean), labValues (array of objects with name, value, unit, referenceRange, flag, confidence from 0 to 1), diagnosesOrTerms (array of terms copied from the source, not inferred diagnoses), overallConfidence (0 to 1), and summary. Write a short, simple-language summary in ${targetLanguage}. For a result explicitly flagged by the document or clearly outside a printed reference range, explain only that it is above or below the range shown, repeat the source value, unit, and range accurately, and say that a result alone is not a diagnosis and should be interpreted by a clinician. Do not guess why a value is outside range or label it abnormal without source support. If a range or flag is unclear, say it needs review.`;
    const prompt = `Read this ${document.documentType.replaceAll("_", " ")}. Extract only legible information, preserve the source wording and values, and use null for missing or unreadable details. If this is not a medical report or prescription, return JSON with extractedText set to an empty string, empty medicines/labValues/diagnosesOrTerms arrays, overallConfidence 0, documentDate null, and summary exactly "This file does not appear to be a medical report or prescription."`;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const content =
      mimeType === "application/pdf"
        ? [
            {
              type: "input_file" as const,
              filename: document.fileName,
              file_data: `data:${mimeType};base64,${base64}`,
            },
            { type: "input_text" as const, text: prompt },
          ]
        : [
            {
              type: "input_image" as const,
              image_url: `data:${mimeType};base64,${base64}`,
              detail: "high" as const,
            },
            { type: "input_text" as const, text: prompt },
          ];
    const result = await client.responses.create({
      model: "gpt-4.1",
      instructions,
      input: [{ role: "user", content }],
      text: { format: { type: "json_object" } },
      max_output_tokens: 8192,
    });
    const responseText = result.output_text;
    const extracted = JSON.parse(responseText) as Record<string, unknown>;
    if (
      typeof extracted.summary !== "string" ||
      extracted.summary.trim().length === 0 ||
      typeof extracted.extractedText !== "string" ||
      !isConfidence(extracted.overallConfidence) ||
      !isMedicineExtractionList(extracted.medicines) ||
      !isLabValueExtractionList(extracted.labValues) ||
      !Array.isArray(extracted.diagnosesOrTerms) ||
      !extracted.diagnosesOrTerms.every((term) => typeof term === "string")
    ) {
      throw new Error("The analysis response did not match the expected structure");
    }
    const confidence = extracted.overallConfidence;
    const isMedical = extracted.extractedText.trim().length > 0;
    const extraction = {
      documentType: medicalDocumentTypes.includes(extracted.documentType as (typeof medicalDocumentTypes)[number])
        ? extracted.documentType
        : document.documentType,
      documentDate: normalizeDocumentDate(extracted.documentDate),
      medicines: extracted.medicines,
      labValues: extracted.labValues,
      diagnosesOrTerms: extracted.diagnosesOrTerms,
      overallConfidence: confidence,
    };
    const [updated] = await db
      .update(medicalDocumentsTable)
      .set({
        extractedText: extracted.extractedText,
        summary: extracted.summary,
        summaryLocale: body.data.locale,
        extraction,
        confidence,
        requiresReview: true,
        status: isMedical ? "review_required" : "failed",
      })
      .where(eq(medicalDocumentsTable.id, document.id))
      .returning();
    res.json(GetDocumentResponse.parse(documentDto(updated)));
  } catch (error) {
    req.log.error({ err: error, documentId: document.id }, "Medical document analysis failed");
    await db
      .update(medicalDocumentsTable)
      .set({ status: "failed" })
      .where(eq(medicalDocumentsTable.id, document.id));
    res.status(502).json({ error: "Document analysis failed. Please try again." });
  }
});

router.patch("/documents/:id/confirm", requirePatient, async (req, res): Promise<void> => {
  const params = ConfirmDocumentParams.safeParse(req.params);
  const body = ConfirmDocumentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid confirmation" });
    return;
  }
  const userId = asRequest(req).altrixUserId!;
  const [document] = await db
    .update(medicalDocumentsTable)
    .set({
      extraction: body.data.extraction,
      summary: body.data.summary,
      summaryLocale: body.data.summaryLocale,
      requiresReview: false,
      status: "confirmed",
    })
    .where(and(eq(medicalDocumentsTable.id, params.data.id), eq(medicalDocumentsTable.ownerId, userId)))
    .returning();
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(GetDocumentResponse.parse(documentDto(document)));
});

router.delete("/documents/:id", requirePatient, async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  const userId = asRequest(req).altrixUserId!;
  const [document] = await db
    .select()
    .from(medicalDocumentsTable)
    .where(and(eq(medicalDocumentsTable.id, params.data.id), eq(medicalDocumentsTable.ownerId, userId)))
    .limit(1);
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  try {
    const file = await storage.getObjectEntityFile(document.objectPath);
    const [exists] = await file.exists();
    if (exists) await file.delete();
  } catch (error) {
    req.log.warn({ err: error, documentId: document.id }, "Document object deletion failed");
  }
  await db.delete(medicalDocumentsTable).where(eq(medicalDocumentsTable.id, document.id));
  res.sendStatus(204);
});

router.get("/feedback", requirePatient, async (req, res): Promise<void> => {
  const userId = asRequest(req).altrixUserId!;
  const feedback = await db
    .select()
    .from(patientFeedbackTable)
    .where(eq(patientFeedbackTable.ownerId, userId))
    .orderBy(desc(patientFeedbackTable.createdAt));
  res.json(ListMyFeedbackResponse.parse(feedback.map(feedbackDto)));
});

router.post("/feedback", requirePatient, async (req, res): Promise<void> => {
  const parsed = CreateFeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid feedback" });
    return;
  }
  const userId = asRequest(req).altrixUserId!;
  const [feedback] = await db
    .insert(patientFeedbackTable)
    .values({
      id: randomUUID(),
      ownerId: userId,
      category: parsed.data.category ?? "other",
      rating: parsed.data.rating ?? null,
      message: parsed.data.message,
    })
    .returning();
  res.status(201).json(CreateFeedbackResponse.parse(feedbackDto(feedback)));
});

router.get("/admin/overview", requireAdmin, async (req, res): Promise<void> => {
  const [patients] = await db.select({ value: count() }).from(userProfilesTable).where(eq(userProfilesTable.role, "patient"));
  const [documents] = await db.select({ value: count() }).from(medicalDocumentsTable);
  const [reviews] = await db.select({ value: count() }).from(medicalDocumentsTable).where(eq(medicalDocumentsTable.status, "review_required"));
  const [feedbackCount] = await db.select({ value: count() }).from(patientFeedbackTable);
  const [active] = await db
    .select({ value: count() })
    .from(userProfilesTable)
    .where(gte(userProfilesTable.lastSeenAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [rating] = await db
    .select({ value: sql<number>`coalesce(avg(${patientFeedbackTable.rating}), 0)` })
    .from(patientFeedbackTable)
    .where(isNotNull(patientFeedbackTable.rating));
  const allProfiles = await db
    .select({ createdAt: userProfilesTable.createdAt })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.role, "patient"));
  const monthlyUsers: Array<{ month: string; count: number }> = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyUsers.push({
      month: key,
      count: allProfiles.filter((profile) => {
        const created = profile.createdAt;
        return `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}` === key;
      }).length,
    });
  }
  const grouped = await db
    .select({ type: medicalDocumentsTable.documentType, value: count() })
    .from(medicalDocumentsTable)
    .groupBy(medicalDocumentsTable.documentType);
  res.json(
    GetAdminOverviewResponse.parse({
      totalPatients: patients.value,
      activeThisMonth: active.value,
      totalDocuments: documents.value,
      pendingReviews: reviews.value,
      averageRating: Number(rating.value ?? 0),
      feedbackCount: feedbackCount.value,
      monthlyUsers,
      documentTypes: grouped.map((row) => ({ type: row.type, count: row.value })),
    }),
  );
});

router.get("/admin/patients", requireAdmin, async (_req, res): Promise<void> => {
  const profiles = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.role, "patient"))
    .orderBy(desc(userProfilesTable.createdAt));
  const counts = await db
    .select({ ownerId: medicalDocumentsTable.ownerId, value: count() })
    .from(medicalDocumentsTable)
    .groupBy(medicalDocumentsTable.ownerId);
  const countMap = new Map(counts.map((item) => [item.ownerId, item.value]));
  res.json(
    ListAdminPatientsResponse.parse(
      profiles.map((profile) => ({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        locale: profile.locale,
        createdAt: profile.createdAt,
        documentCount: countMap.get(profile.id) ?? 0,
      })),
    ),
  );
});

router.get("/admin/documents", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({ document: medicalDocumentsTable, patientName: userProfilesTable.name, patientEmail: userProfilesTable.email })
    .from(medicalDocumentsTable)
    .innerJoin(userProfilesTable, eq(medicalDocumentsTable.ownerId, userProfilesTable.id))
    .orderBy(desc(medicalDocumentsTable.createdAt));
  res.json(
    ListAdminDocumentsResponse.parse(
      rows.map(({ document, patientName, patientEmail }) => ({
        ...documentDto(document),
        patientName,
        patientEmail,
        objectPath: document.objectPath,
      })),
    ),
  );
});

router.get("/admin/feedback", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({ feedback: patientFeedbackTable, patientName: userProfilesTable.name, patientEmail: userProfilesTable.email })
    .from(patientFeedbackTable)
    .innerJoin(userProfilesTable, eq(patientFeedbackTable.ownerId, userProfilesTable.id))
    .orderBy(desc(patientFeedbackTable.createdAt));
  res.json(
    ListAdminFeedbackResponse.parse(
      rows.map(({ feedback, patientName, patientEmail }) => ({
        ...feedbackDto(feedback),
        patientName,
        patientEmail,
      })),
    ),
  );
});

export default router;
