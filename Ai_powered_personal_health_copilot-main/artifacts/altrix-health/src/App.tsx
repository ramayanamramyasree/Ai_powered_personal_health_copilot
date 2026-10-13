import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity, ArrowDownToLine, ArrowRight, BadgeCheck, BarChart3, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, FileImage, FileText, HeartHandshake, Languages,
  LayoutDashboard, LockKeyhole, LogOut, MessageSquareText, Plus, Send, ShieldCheck,
  Sparkles, Stethoscope, Trash2, UploadCloud, Users, X, AlertTriangle, Menu,
} from 'lucide-react';
import { Route, Switch, Redirect, Router as WouterRouter, useLocation, Link } from 'wouter';
import {
  getHealthCheckQueryKey, getGetProfileQueryKey, getGetTranslationsQueryKey, getListLanguagesQueryKey, getListDocumentsQueryKey,
  getListMyFeedbackQueryKey, getGetAdminOverviewQueryKey, getListAdminUsersQueryKey, getGetDocumentQueryKey,
  useHealthCheck, useGetProfile, useGetTranslations, useListLanguages, useListDocuments, useGetDocument, useCreateDocument, useRequestUploadUrl,
  useAnalyzeDocument, useConfirmDocument, useDeleteDocument, useUpdateProfile,
  useListMyFeedback, useCreateFeedback, useGetAdminOverview, useListAdminUsers,
} from '@workspace/api-client-react';
import type { AdminOverview, Language, LanguageCode, ListAdminUsersParams, MedicalDocument, Profile } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const configuredClerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();
const hostname = window.location.hostname.toLowerCase();
const isLocalhost = hostname === 'localhost' || hostname.endsWith('.localhost');
const clerkPubKey = configuredClerkPubKey
  ? isLocalhost
    ? configuredClerkPubKey
    : publishableKeyFromHost(hostname, configuredClerkPubKey)
  : undefined;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#356b5d', colorForeground: '#253a35', colorMutedForeground: '#6a7771',
    colorDanger: '#a64039', colorBackground: '#fffdf8', colorInput: '#fffdf8',
    colorInputForeground: '#253a35', colorNeutral: '#ddd8cc',
    fontFamily: 'DM Sans, sans-serif', borderRadius: '14px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf8] rounded-[24px] w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#253a35] font-semibold tracking-tight',
    headerSubtitle: 'text-[#68766f]',
    socialButtonsBlockButtonText: 'text-[#253a35] font-medium',
    formFieldLabel: 'text-[#394d46] font-semibold',
    footerActionLink: 'text-[#356b5d] font-semibold',
    footerActionText: 'text-[#68766f]',
    dividerText: 'text-[#77827b]',
    identityPreviewEditButton: 'text-[#356b5d]',
    formFieldSuccessText: 'text-[#356b5d]',
    alertText: 'text-[#7a332c]',
    logoBox: 'rounded-xl overflow-hidden',
    logoImage: 'rounded-xl',
    socialButtonsBlockButton: 'border-[#e5dfd3] rounded-xl',
    formButtonPrimary: 'rounded-full font-semibold',
    formFieldInput: 'rounded-xl border-[#ddd8cc]',
    footerAction: 'text-sm',
    dividerLine: 'bg-[#e7e1d6]',
    alert: 'rounded-xl',
    otpCodeFieldInput: 'rounded-lg',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};

function Brand({ dark = false }: { dark?: boolean }) {
  return <Link href="/" className={`brand-lockup ${dark ? 'text-[#fbf7ec]' : 'text-ink'}`} data-testid="link-brand-home">
    <span className="brand-mark"><Activity size={19} strokeWidth={2.4} /></span>
    <span><b>altrix</b><small>HEALTH COPILOT</small></span>
  </Link>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/portal" /></Show><Show when="signed-out"><Landing /></Show></>;
}

function Landing() {
  return <main className="grain overflow-hidden">
    <header className="landing-nav wrap">
      <Brand />
      <nav className="landing-links"><a href="#how-it-works">How it works</a><a href="#privacy">Your privacy</a></nav>
      <div className="nav-actions"><Link className="nav-signin" href="/login">Sign in</Link><Link className="btn btn-primary nav-cta" href="/patient/register">Get started <ArrowRight size={16} /></Link></div>
    </header>
    <section className="hero wrap">
      <div className="hero-copy fade-up">
        <div className="eyebrow hero-kicker"><span className="live-dot" /> A little more clarity, care by care</div>
        <h1 className="display">Your health story,<br /><em>all in one place.</em></h1>
        <p className="hero-sub">A personal health copilot to help you make sense of your records, keep the important details close, and feel more prepared for what comes next.</p>
        <div className="hero-actions"><Link className="btn btn-primary" href="/patient/register">Create your private space <ArrowRight size={17} /></Link><span className="hero-note"><LockKeyhole size={14} /> Private to you, always</span></div>
        <div className="hero-proof"><div className="proof-avatars"><span>A</span><span>M</span><span>R</span></div><p>Built to support your care,<br /><b>not replace your clinician.</b></p></div>
      </div>
      <div className="hero-art fade-up-2">
        <div className="sun-orb" />
        <div className="art-leaf leaf-one" /><div className="art-leaf leaf-two" /><div className="art-leaf leaf-three" />
        <div className="paper-stack paper-back"><span className="paper-line long" /><span className="paper-line" /><span className="paper-line short" /></div>
        <div className="paper-stack paper-front">
          <div className="paper-label"><span className="mini-emblem"><HeartHandshake size={15} /></span> YOUR HEALTH, ORGANIZED</div>
          <div className="paper-title display">A clearer picture.</div>
          <div className="paper-row"><span className="paper-icon"><FileText size={15} /></span><span><b>Blood work</b><small>Added to your timeline</small></span><CheckCircle2 className="paper-check" size={17} /></div>
          <div className="paper-row"><span className="paper-icon coral"><Stethoscope size={15} /></span><span><b>Care summary</b><small>Ready for your review</small></span><span className="review-pill">Review</span></div>
          <div className="paper-foot"><ShieldCheck size={14} /> Nothing is confirmed until you say so.</div>
        </div>
        <div className="art-caption">A companion for the in-between moments.</div>
      </div>
      <div className="hero-scroll"><span /> MADE FOR YOUR JOURNEY</div>
    </section>
    <section className="trust-strip"><div className="wrap trust-inner"><span><ShieldCheck size={19} /> Your records stay yours</span><i /><span><BadgeCheck size={19} /> You review every extraction</span><i /><span><HeartHandshake size={19} /> Human care comes first</span></div></section>
    <section id="how-it-works" className="story-section wrap">
      <div className="story-heading"><div className="eyebrow">A steadier way to stay informed</div><h2 className="display">Less searching.<br /><em>More understanding.</em></h2></div>
      <div className="story-body"><p>Reports arrive from all directions. Altrix brings them into one calm, private place—then helps turn the paperwork into words you can take into your next conversation.</p><p className="small-note"><Sparkles size={16} /> Made for patients, with care and clarity at the center.</p></div>
      <div className="feature-rail">
        <article className="feature-panel panel-upload"><div className="feature-number">01 / COLLECT</div><div className="feature-illustration upload-illustration"><div className="file-tile"><FileText size={29} /><span>PDF</span></div><div className="upload-arrow"><ArrowDownToLine size={17} /></div><div className="mini-timeline"><i /><i /><i /></div></div><h3>Keep the whole story together.</h3><p>Add a report or prescription and find it again when you need it. Your records, in a timeline that makes sense.</p><span className="feature-foot">Documents, gently organized <ArrowRight size={15} /></span></article>
        <article className="feature-panel panel-understand"><div className="feature-number">02 / UNDERSTAND</div><div className="feature-illustration summary-illustration"><div className="summary-note"><span className="summary-spark"><Sparkles size={14} /></span><i className="summary-bar wider" /><i className="summary-bar" /><i className="summary-bar short" /><span className="summary-rule" /><i className="summary-bar" /><i className="summary-bar shorter" /></div><span className="translation-chip"><Languages size={13} /> Your language</span></div><h3>Read a summary that feels clear.</h3><p>Get help understanding what a report says, in your preferred language. Always as a starting point for a conversation.</p><span className="feature-foot">Clarity, not a diagnosis <ArrowRight size={15} /></span></article>
        <article className="feature-panel panel-confirm"><div className="feature-number">03 / CONFIRM</div><div className="feature-illustration check-illustration"><div className="confirm-circle"><Check size={24} /></div><div className="confirm-card"><b>Your review matters</b><span>Check every detail first</span></div><div className="confirm-dots"><i /><i /><i /></div></div><h3>You stay in the driver's seat.</h3><p>AI extraction is only a draft. Read it, correct it, and confirm it yourself before it becomes part of your record.</p><span className="feature-foot">Nothing assumed, ever <ArrowRight size={15} /></span></article>
      </div>
    </section>
    <section id="privacy" className="privacy-band">
      <div className="wrap privacy-layout"><div className="privacy-seal"><ShieldCheck size={35} strokeWidth={1.5} /><span>PRIVATE<br />BY DESIGN</span></div><div><div className="eyebrow">Your health is personal</div><h2 className="display">A quiet space.<br /><em>On your terms.</em></h2></div><div className="privacy-copy"><p>Your records belong to you. Altrix is here to help you organize and understand them—not to diagnose, prescribe, or make decisions on your behalf.</p><div className="privacy-points"><span><Check size={15} /> No automated medical decisions</span><span><Check size={15} /> Review before confirmation</span><span><Check size={15} /> Built around your consent</span></div></div></div>
    </section>
    <section className="closing wrap"><div className="closing-card"><div className="closing-sun" /><div className="eyebrow">You deserve to feel informed</div><h2 className="display">Take your next step<br />with a little more <em>confidence.</em></h2><Link className="btn btn-primary" href="/patient/register">Start with Altrix <ArrowRight size={16} /></Link><span className="closing-note">Free to get started · Private by design</span></div></section>
    <footer className="landing-footer wrap"><Brand /><span>Altrix Health Copilot <i>·</i> A product by Altrix Labs</span><span>For support, reach out to your care team.</span></footer>
    <EmergencyNotice />
  </main>;
}

function EmergencyNotice() {
  return <div className="emergency-banner"><AlertTriangle size={14} /><span><b>Need urgent help?</b> Altrix is not an emergency service. Call your local emergency number or go to the nearest emergency department.</span></div>;
}

type AccountType = 'patient' | 'admin';

function LoginLanding() {
  return <main className="login-choice-screen grain">
    <header className="login-choice-nav wrap"><Brand /><Link href="/" className="login-back-link" data-testid="link-back-home"><ArrowRight size={15} className="back-arrow" /> Back to home</Link></header>
    <section className="login-choice-content wrap">
      <div className="login-choice-heading"><div className="eyebrow">ALTRIX HEALTH COPILOT</div><h1 className="display">Welcome to your<br /><em>Altrix space.</em></h1><p>Choose the secure sign-in for your account.</p></div>
      <div className="login-choice-cards">
        <article className="login-choice-card soft-card" data-testid="card-patient-login">
          <span className="login-choice-icon"><HeartHandshake size={23} /></span><div className="eyebrow">YOUR PERSONAL HEALTH SPACE</div>
          <h2 className="display">Patient login</h2><p>Open your medical records, reports, timeline, and personal settings.</p>
          <Link href="/patient/login" className="btn btn-primary" data-testid="link-patient-login">Patient login <ArrowRight size={16} /></Link>
          <span className="login-choice-foot">New to Altrix? <Link href="/patient/register" data-testid="link-patient-registration">Create a patient account</Link></span>
        </article>
        <article className="login-choice-card login-choice-admin soft-card" data-testid="card-admin-login">
          <span className="login-choice-icon"><ShieldCheck size={23} /></span><div className="eyebrow">AUTHORIZED STAFF ONLY</div>
          <h2 className="display">Administrator</h2><p>For explicitly authorized Altrix administrators managing the care workspace.</p>
          <Link href="/admin/login" className="btn btn-quiet" data-testid="link-admin-login">Administrator login <ArrowRight size={16} /></Link>
          <span className="login-choice-foot">Administrator access is assigned by Altrix. There is no public admin registration.</span>
        </article>
      </div>
      <div className="login-choice-privacy"><LockKeyhole size={14} /> Your health information is private and patient-led.</div>
    </section>
    <EmergencyNotice />
  </main>;
}

function AuthPage({ role = 'patient', signUp = false, signInPath, signUpPath }: { role?: AccountType; signUp?: boolean; signInPath: string; signUpPath: string }) {
  const isAdmin = role === 'admin';
  return <div className="auth-screen grain"><div className="auth-side"><Brand dark /><div className="auth-side-copy"><span className="eyebrow">{isAdmin ? 'Authorized access only' : signUp ? 'A little more clarity' : 'Your private health space'}</span><h1 className="display">{isAdmin ? <>Care, at a<br /><em>glance.</em></> : <>Your health story,<br /><em>in your hands.</em></>}</h1><p>{isAdmin ? 'A secure workspace for explicitly authorized Altrix administrators.' : 'A private place to bring your records together, understand them, and prepare for the conversations that matter.'}</p><div className="auth-assurance"><ShieldCheck size={18} /> {isAdmin ? 'Verified administrator access only.' : 'Patient-led. Private by design.'}</div></div><div className="auth-side-foot">ALTRIX LABS <span>·</span> HEALTH COPILOT</div></div><div className={`auth-form-zone ${isAdmin ? 'admin-auth-form-zone' : ''}`}><div className="auth-mobile-brand"><Brand /></div><div className="auth-mode-title"><span className="eyebrow">{isAdmin ? 'ADMINISTRATOR' : 'PATIENT ACCOUNT'}</span><h2 className="display">{signUp ? 'Create your private space' : isAdmin ? 'Administrator sign in' : 'Welcome back'}</h2><p>{isAdmin ? 'Sign in with an authorized administrator account.' : signUp ? 'Your health records stay private to you.' : 'Continue to your health records and timeline.'}</p></div>{signUp ? <SignUp routing="path" path={`${basePath}${signUpPath}`} signInUrl={`${basePath}${signInPath}`} forceRedirectUrl={`${basePath}/patient/dashboard`} /> : <SignIn routing="path" path={`${basePath}${signInPath}`} forceRedirectUrl={`${basePath}${isAdmin ? '/admin/dashboard' : '/patient/dashboard'}`} fallbackRedirectUrl={`${basePath}${isAdmin ? '/admin/dashboard' : '/patient/dashboard'}`} signUpUrl={isAdmin ? '' : `${basePath}${signUpPath}`} withSignUp={!isAdmin} appearance={isAdmin ? { elements: { footerAction: { display: 'none' } } } : undefined} />}<p className="auth-note"><LockKeyhole size={13} /> {isAdmin ? 'Administrator access is verified on the Altrix server.' : 'Your health information is personal. We treat it that way.'}</p>{!isAdmin && !signUp && <Link className="auth-back-link" href="/patient/register" data-testid="link-patient-registration">New patient? Create an account</Link>}{!signUp && <Link className="auth-back-link" href={isAdmin ? '/login' : '/login'} data-testid="link-auth-back">Back to sign-in choices</Link>}</div><EmergencyNotice /></div>;
}

function AccessDeniedPage() {
  return <div className="auth-screen grain"><div className="auth-side"><Brand dark /><div className="auth-side-copy"><span className="eyebrow">Private by design</span><h1 className="display">Your health story,<br /><em>in your hands.</em></h1><p>Access to each Altrix workspace is limited to its intended account type.</p><div className="auth-assurance"><ShieldCheck size={18} /> Patient-led. Private by design.</div></div><div className="auth-side-foot">ALTRIX LABS <span>·</span> HEALTH COPILOT</div></div><div className="auth-form-zone"><div className="auth-mobile-brand"><Brand /></div><section className="auth-denied soft-card" role="alert" data-testid="status-admin-access-denied"><span className="login-choice-icon"><LockKeyhole size={22} /></span><div className="eyebrow">ACCESS NOT AVAILABLE</div><h1 className="display">We can’t open this workspace.</h1><p>These sign-in details are not authorized for this workspace. Use the correct account type or contact your administrator.</p><Link className="btn btn-primary" href="/patient/dashboard" data-testid="link-return-patient-dashboard">Continue to patient space <ArrowRight size={16} /></Link><Link className="auth-back-link" href="/login" data-testid="link-back-login-choices">Back to sign-in choices</Link></section></div><EmergencyNotice /></div>;
}

function LoadingShell({ label = 'Getting your space ready' }: { label?: string }) {
  return <div className="loading-page"><div className="skeleton-brand" /><div className="loading-content"><span className="skeleton-block" /><span className="skeleton-title" /><span className="skeleton-block wide" /><div className="skeleton-cards"><i /><i /><i /></div><p>{label}</p></div></div>;
}

function ErrorState({ retry, message = 'We couldn’t load this just now.' }: { retry?: () => void; message?: string }) {
  return <div className="error-state"><span className="error-icon"><CircleHelp size={21} /></span><b>Let’s try that again</b><p>{message}</p>{retry && <button className="btn btn-quiet" onClick={retry} data-testid="button-retry">Try again</button>}</div>;
}

type Locale = LanguageCode;
type Translate = (key: string, fallback?: string) => string;
const fallbackLanguages: Language[] = [
  { id: 'en', code: 'en', name: 'English', nativeName: 'English', enabled: true },
  { id: 'hi', code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', enabled: true },
  { id: 'ta', code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', enabled: true },
  { id: 'te', code: 'te', name: 'Telugu', nativeName: 'తెలుగు', enabled: true },
  { id: 'kn', code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', enabled: true },
];
const languages: Record<Locale, string> = { en: 'English', hi: 'हिन्दी', ta: 'தமிழ்', te: 'తెలుగు', kn: 'ಕನ್ನಡ' };
const labels: Record<string, string> = {
  greeting: 'Good to see you', documents: 'My health records', timeline: 'Your timeline',
  upload: 'Add a record', summary: 'A clearer summary', review: 'Needs your review',
  confirm: 'Confirm this draft', language: 'Language', feedback: 'Share feedback',
  emptyTitle: 'Your story starts here', emptyBody: 'Add a health record to begin building your private timeline.',
  noSummary: 'Ask Altrix to read this document and prepare a draft summary for you.',
  urgent: 'For urgent or emergency care, contact your local emergency services. Altrix is not an emergency service.',
};

function AppShell({ children, profile, active = 'portal', translate = (_key, fallback) => fallback || _key }: { children: ReactNode; profile: Profile; active?: string; translate?: Translate }) {
  const { signOut } = useClerk();
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), enabled: profile.role === 'patient' } });
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="app-layout">
    <aside className={`app-sidebar ${menuOpen ? 'mobile-open' : ''}`}><div className="side-brand"><Brand dark /><button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19} /></button></div>
      {profile.role === 'admin' ? <>
        <div className="side-caption">USER MANAGEMENT</div>
        <a href="#user-analytics" className="side-link" onClick={() => setMenuOpen(false)}><BarChart3 size={18} /> User Analytics</a>
        <a href="#user-records" className="side-link" onClick={() => setMenuOpen(false)}><Users size={18} /> User Records</a>
      </> : <>
        <div className="side-caption">{translate('your_space', 'YOUR SPACE')}</div>
        <Link href="/portal" className={`side-link ${active === 'portal' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}><LayoutDashboard size={18} /> {translate('overview', 'Overview')}</Link>
        <Link href="/patient/dashboard#settings" className="side-link" onClick={() => setMenuOpen(false)}><Languages size={18} /> {translate('settings', 'Settings')}</Link>
      </>}
      <div className="side-bottom">{profile.role === 'patient' && <div className="side-security"><ShieldCheck size={17} /><span><b>{translate('privacy_ownership', 'Your information stays yours')}</b><small>{translate('private_patient_led', 'Private and patient-led')}</small></span></div>}
        <button className="profile-switch" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><span className="profile-avatar">{(profile.name || profile.email || 'A')[0].toUpperCase()}</span><span className="profile-meta"><b>{profile.name || 'Your account'}</b><small>{profile.email}</small></span><LogOut size={16} /></button>
      </div>
    </aside>
    {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="app-main"><header className="app-topbar"><button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div><span className="topbar-kicker">ALTRIX HEALTH COPILOT</span><span className="topbar-date">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span></div><div className="topbar-right">{profile.role === 'patient' && <span className="topbar-private"><span className="live-dot" /> {health.isError ? translate('connection_unavailable', 'Connection unavailable') : health.data ? translate('private_space_connected', 'Private space · connected') : translate('private_space', 'Private space')}</span>}<span className="topbar-initial">{(profile.name || 'A')[0].toUpperCase()}</span></div></header><main className="app-content">{children}</main></div>
  </div>;
}

function PortalPage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile } = useGetProfile();
  const [localeDraft, setLocaleDraft] = useState<Locale | null>(null);
  const locale = localeDraft ?? (profile?.locale as Locale | undefined) ?? 'en';
  const languageList = useListLanguages({ query: { queryKey: getListLanguagesQueryKey(), enabled: !!profile } });
  const translations = useGetTranslations(locale, { query: { queryKey: getGetTranslationsQueryKey(locale), enabled: !!profile } });
  const tr: Translate = (key, fallback) => translations.data?.[key] || fallback || labels[key] || key.replace(/[_-]+/g, ' ');
  const docs = useListDocuments({ query: { queryKey: getListDocumentsQueryKey(), enabled: !!profile } });
  const feedback = useListMyFeedback({ query: { queryKey: getListMyFeedbackQueryKey(), enabled: !!profile } });
  const uploadUrl = useRequestUploadUrl();
  const createDoc = useCreateDocument();
  const analyze = useAnalyzeDocument();
  const confirm = useConfirmDocument();
  const remove = useDeleteDocument();
  const updateProfile = useUpdateProfile();
  const createFeedback = useCreateFeedback();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<'prescription' | 'lab_report' | 'discharge_summary' | 'diagnostic_report' | 'other'>('lab_report');
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadFailed, setUploadFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [extractionDraft, setExtractionDraft] = useState('{}');
  const [reviewed, setReviewed] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('experience');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (profile) setLocaleDraft(profile.locale as Locale); }, [profile?.locale]);
  const isArray = <T>(value: unknown): value is T[] => Array.isArray(value);

  useEffect(() => {
    if (isArray(docs.data) && docs.data.length) {
      if (!selectedId || !docs.data.some((d) => d.id === selectedId)) {
        setSelectedId(docs.data[0].id);
      }
    }
  }, [docs.data, selectedId]);

  const selectedDetail = useGetDocument(selectedId || '', {
    query: { enabled: !!selectedId, queryKey: getGetDocumentQueryKey(selectedId || '') },
  });
  const selected = selectedDetail.data ?? (isArray(docs.data) ? docs.data.find((doc) => doc.id === selectedId) : undefined);
  useEffect(() => {
    if (selected) {
      setSummaryDraft(selected.translatedSummary && selected.summaryLocale === locale ? selected.translatedSummary : selected.summary || '');
      setExtractionDraft(JSON.stringify(selected.extraction || {}, null, 2));
      setReviewed(false);
    }
  }, [selected?.id, selected?.extraction, selected?.summary, selected?.translatedSummary, selected?.summaryLocale, locale]);

  const invalidateDocuments = () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
  const onLocaleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as Locale;
    setLocaleDraft(value);
    updateProfile.mutate({ data: { locale: value } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() }),
      onError: () => setLocaleDraft((profile?.locale as Locale | undefined) || 'en'),
    });
  };
  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadMessage('');
    setUploadFailed(false);
    if (file.size > 15_000_000) { setUploadMessage('This file is larger than 15 MB. Please choose a smaller one.'); setUploadFailed(true); event.target.value = ''; return; }
    setUploading(true);
    try {
      const contentType = await detectMedicalFileType(file);
      const { uploadURL, objectPath } = await uploadUrl.mutateAsync({ data: { name: file.name, size: file.size, contentType } });
      const response = await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
      if (!response.ok) throw new Error('The file could not be uploaded.');
      const created = await createDoc.mutateAsync({ data: { fileName: file.name, objectPath, documentType } });
      await invalidateDocuments();
      setSelectedId(created.id);
      setUploadMessage('Your record is safely added. You can ask Altrix to prepare a draft summary.');
    } catch (error) { setUploadMessage(error instanceof Error ? error.message : 'Upload didn’t work. Please try again.'); setUploadFailed(true); }
    finally { setUploading(false); event.target.value = ''; }
  };
  const analyzeSelected = () => {
    if (!selected) return;
    analyze.mutate({ id: selected.id, data: { locale } }, { onSuccess: (doc) => {
      queryClient.setQueryData(getGetDocumentQueryKey(doc.id), doc);
      invalidateDocuments();
      setSummaryDraft(doc.translatedSummary || doc.summary || '');
      setExtractionDraft(JSON.stringify(doc.extraction || {}, null, 2));
      setReviewed(false);
    }, onError: () => {
      invalidateDocuments();
      queryClient.invalidateQueries({ queryKey: getGetDocumentQueryKey(selected.id) });
    } });
  };
  const confirmSelected = () => {
    if (!selected || !reviewed) return;
    let extraction: Record<string, unknown>;
    try { extraction = JSON.parse(extractionDraft) as Record<string, unknown>; }
    catch { setUploadMessage('Please correct the extraction format before confirming.'); setUploadFailed(true); return; }
    if (!summaryDraft.trim()) { setUploadMessage('Add or review the summary before confirming.'); setUploadFailed(true); return; }
    confirm.mutate({ id: selected.id, data: { extraction, summary: summaryDraft, summaryLocale: locale } }, {
      onSuccess: (doc) => {
        queryClient.setQueryData(getGetDocumentQueryKey(doc.id), doc);
        invalidateDocuments();
        setReviewed(false);
        setUploadFailed(false);
        setUploadMessage('Your review has been saved.');
      },
    });
  };
  const removeSelected = () => {
    if (!selected || !window.confirm(`Remove “${selected.fileName}” from your records?`)) return;
    remove.mutate({ id: selected.id }, { onSuccess: () => { setSelectedId(null); invalidateDocuments(); } });
  };
  const timelineDocuments = sortDocumentsByEventDate(docs.data || []);
  const pending = docs.data?.filter((d) => d.requiresReview || d.status === 'review_required').length || 0;
  const pageLoading = profileLoading || (!!profile && docs.isLoading);
  if (profileLoading) return <LoadingShell />;
  if (profileError || !profile) return <ErrorState retry={() => refetchProfile()} message="We couldn’t open your private space. Check your connection and try again." />;
  if (pageLoading) return <LoadingShell />;

  return <AppShell profile={profile} translate={tr}>
    <div className="welcome-row fade-up"><div><div className="eyebrow">{tr('personal_health_space', 'YOUR PERSONAL HEALTH SPACE')}</div><h1 className="display">{tr('greeting')}{profile.name ? `, ${profile.name.split(' ')[0]}` : ''}.</h1><p>{tr('records_together', 'Everything you’ve shared, together in one place.')}</p></div><label className="locale-control" id="settings"><Languages size={17} /><span className="sr-only">{tr('language')}</span><select aria-label={tr('language')} value={locale} onChange={onLocaleChange} disabled={languageList.isLoading || languageList.isError || updateProfile.isPending} data-testid="select-language">{(languageList.data?.length ? languageList.data : fallbackLanguages).map((language) => <option key={language.code} value={language.code}>{language.nativeName === language.name ? language.name : `${language.nativeName} (${language.name})`}</option>)}</select><ChevronDown size={15} /></label></div>
    {languageList.isError && <p className="error-text" role="alert">{tr('language_list_error', 'Available languages could not be loaded. Please refresh and try again.')}</p>}
    {updateProfile.isError && <p className="error-text" role="alert">{tr('language_save_error', 'Your language preference could not be saved. Please try again.')}</p>}
    <div className="urgent-callout"><span className="urgent-icon"><HeartHandshake size={17} /></span><div><b>{tr('gentle_reminder', 'A gentle reminder')}</b><p>{tr('urgent')}</p></div><button onClick={() => setFeedbackOpen(true)} data-testid="button-contact-support"><MessageSquareText size={15} /> {tr('feedback', 'Feedback')}</button></div>
    {docs.isError && <ErrorState retry={() => docs.refetch()} message="Your records couldn’t be loaded. They’re still safe—please try again." />}
    <section className="portal-grid">
      <div className="portal-primary">
        <section className="upload-card soft-card">
          <div className="upload-card-head"><div><div className="eyebrow">{tr('start_with_record', 'START WITH A RECORD')}</div><h2 className="display">{tr('upload')}</h2><p>{tr('upload_explanation', 'Bring a report, prescription, or discharge summary into your timeline.')}</p></div><span className="upload-emblem"><UploadCloud size={23} /></span></div>
          <div className="upload-controls"><label className="type-select"><span className="label">{tr('document_type', 'What kind of record?')}</span><select className="field" value={documentType} onChange={(e) => setDocumentType(e.target.value as typeof documentType)} data-testid="select-document-type"><option value="lab_report">{tr('lab_report', 'Lab report')}</option><option value="prescription">{tr('prescription', 'Prescription')}</option><option value="discharge_summary">{tr('discharge_summary', 'Discharge summary')}</option><option value="diagnostic_report">{tr('diagnostic_report', 'Diagnostic report')}</option><option value="other">{tr('other', 'Other')}</option></select></label><input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={onUpload} className="sr-only" data-testid="input-medical-file" /><button onClick={() => fileRef.current?.click()} disabled={uploading || uploadUrl.isPending || createDoc.isPending} className="btn btn-primary upload-button" data-testid="button-upload-record">{uploading || uploadUrl.isPending || createDoc.isPending ? <span className="tiny-loader" /> : <Plus size={17} />}{uploading || uploadUrl.isPending || createDoc.isPending ? tr('adding_record', 'Adding record…') : tr('choose_file', 'Choose a file')}</button></div>
          <div className="upload-meta"><span><LockKeyhole size={13} /> {tr('private_secure', 'Private and secure')}</span><span>{tr('supported_file_types', 'PDF, JPG, PNG or WEBP · up to 15 MB')}</span></div>
          {uploadMessage && <div className={`inline-message ${uploadFailed ? 'message-error' : ''}`} role="status">{uploadMessage}</div>}
        </section>
        <section className="timeline-card soft-card">
          <div className="section-title-row"><div><div className="eyebrow">{tr('records_in_order', 'YOUR RECORDS, IN ORDER')}</div><h2 className="display">{tr('timeline')}</h2></div><span className="record-count">{docs.data?.length || 0} {docs.data?.length === 1 ? tr('record', 'record') : tr('records', 'records')}</span></div>
          {docs.isLoading ? <div className="document-skeleton"><i /><i /><i /></div> : docs.data?.length ? <div className="timeline-list">{timelineDocuments.map((doc) => <DocumentTimelineItem translate={tr} locale={locale} key={doc.id} doc={doc} active={doc.id === selectedId} onClick={() => { setSelectedId(doc.id); setUploadMessage(''); }} />)}</div> : <div className="empty-records"><span className="empty-art"><FileImage size={25} /></span><h3>{tr('emptyTitle')}</h3><p>{tr('emptyBody')}</p><button className="text-action" onClick={() => fileRef.current?.click()} data-testid="button-add-first-record">{tr('add_first_record', 'Add your first record')} <ArrowRight size={15} /></button></div>}
        </section>
        {!!docs.data?.length && <HealthProfileCard translate={tr} locale={locale} documents={timelineDocuments} />}
      </div>
      <div className="portal-secondary">
        <section className="review-card">
          <div className="review-head"><div><div className="eyebrow">{tr('patient_review', 'PATIENT REVIEW')}</div><h2 className="display">{tr('summary')}</h2></div><span className="review-count">{pending}<small>{tr('to_review', 'to review')}</small></span></div>
          {selected ? <ReviewPanel translate={tr} doc={selected} locale={locale} summary={summaryDraft} onSummary={setSummaryDraft} extraction={extractionDraft} onExtraction={setExtractionDraft} reviewed={reviewed} onReviewed={setReviewed} onAnalyze={analyzeSelected} onConfirm={confirmSelected} analyzing={analyze.isPending} confirming={confirm.isPending} onDelete={removeSelected} deleting={remove.isPending} /> : <div className="review-empty"><span className="review-empty-icon"><Sparkles size={19} /></span><b>{tr('understanding_terms', 'Understanding, on your terms.')}</b><p>{tr('choose_record_prompt', 'Choose a record from your timeline, or ask Altrix to prepare a draft summary after you upload one.')}</p></div>}
          {analyze.isError && <div className="inline-message message-error" role="alert">{getAnalysisErrorMessage(analyze.error, tr)}</div>}
          {(confirm.isError || remove.isError) && <div className="inline-message message-error" role="alert">That didn’t save. Your record is unchanged—please try again.</div>}
          {uploadMessage === 'Your review has been saved.' && <div className="inline-message" role="status">{uploadMessage}</div>}
        </section>
        <FeedbackCard translate={tr} open={feedbackOpen} setOpen={setFeedbackOpen} items={feedback.data || []} loading={feedback.isLoading} failed={feedback.isError} message={feedbackText} setMessage={setFeedbackText} category={feedbackCategory} setCategory={setFeedbackCategory} rating={feedbackRating} setRating={setFeedbackRating} pending={createFeedback.isPending} success={createFeedback.isSuccess} onSubmit={() => {
          if (feedbackText.trim().length < 2) return;
          createFeedback.mutate({ data: { message: feedbackText.trim(), category: feedbackCategory as 'experience' | 'accuracy' | 'accessibility' | 'other', rating: feedbackRating } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMyFeedbackQueryKey() }); setFeedbackText(''); } });
        }} />
      </div>
    </section>
    <div className="portal-footer-note"><ShieldCheck size={15} /> Altrix helps organize information. It does not diagnose conditions or recommend treatment.</div>
  </AppShell>;
}

function DocumentTimelineItem({ translate, locale, doc, active, onClick }: { translate: Translate; locale: Locale; doc: MedicalDocument; active: boolean; onClick: () => void }) {
  const name: Record<string, string> = { prescription: translate('prescription', 'Prescription'), lab_report: translate('lab_report', 'Lab report'), discharge_summary: translate('discharge_summary', 'Discharge summary'), diagnostic_report: translate('diagnostic_report', 'Diagnostic report'), other: translate('health_record', 'Health record') };
  const status: Record<string, string> = { uploaded: translate('added', 'Added'), processing: translate('preparing_draft', 'Preparing draft'), review_required: translate('review_required', 'Needs your review'), confirmed: translate('patient_confirmed', 'Patient confirmed'), failed: translate('could_not_process', 'Could not process') };
  const documentDate = parseDocumentDate(doc);
  const shownDate = documentDate || new Date(doc.createdAt);
  const dateLabel = documentDate ? translate('document_date', 'Report date') : translate('uploaded', 'Uploaded');
  return <button className={`timeline-item ${active ? 'selected' : ''}`} onClick={onClick} data-testid={`button-record-${doc.id}`}><span className="timeline-marker">{doc.status === 'confirmed' ? <Check size={13} /> : <FileText size={13} />}</span><span className="timeline-info"><b>{doc.fileName}</b><small>{name[doc.documentType] || 'Health record'} <i>·</i> {dateLabel}: {shownDate.toLocaleDateString(localeTag[locale], { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</small></span><span className={`status-chip ${doc.requiresReview || doc.status === 'review_required' ? 'status-review' : doc.status === 'confirmed' ? 'status-confirmed' : ''}`}><i />{status[doc.status] || doc.status}</span></button>;
}

type HealthProfileFact = {
  id: string;
  title: string;
  details: string[];
  date: Date;
  uncertain?: boolean;
};

function HealthProfileCard({ translate, locale, documents }: { translate: Translate; locale: Locale; documents: MedicalDocument[] }) {
  const confirmedDocuments = documents.filter((doc) => doc.status === 'confirmed');
  const groups = [
    { key: 'medications', title: translate('medications', 'Medicines'), facts: [] as HealthProfileFact[] },
    { key: 'lab_values', title: translate('lab_values', 'Test results'), facts: [] as HealthProfileFact[] },
    { key: 'diagnoses', title: translate('diagnoses', 'Terms mentioned'), facts: [] as HealthProfileFact[] },
  ];

  for (const doc of confirmedDocuments) {
    const extraction = asRecord(doc.extraction);
    if (!extraction) continue;
    const date = parseDocumentDate(doc) || new Date(doc.createdAt);
    const medicines = Array.isArray(extraction.medicines) ? extraction.medicines : [];
    for (const [index, value] of medicines.entries()) {
      const medicine = asRecord(value);
      const title = readFactText(medicine?.name);
      if (!title) continue;
      const details = [medicine?.dose, medicine?.frequency, medicine?.duration]
        .map(readFactText)
        .filter((detail): detail is string => !!detail);
      if (medicine?.uncertain === true) details.push(translate('unclear', 'Unclear — check the original'));
      groups[0].facts.push({ id: `${doc.id}-medicine-${index}`, title, details, date, uncertain: medicine?.uncertain === true });
    }

    const labValues = Array.isArray(extraction.labValues) ? extraction.labValues : [];
    for (const [index, value] of labValues.entries()) {
      const lab = asRecord(value);
      const title = readFactText(lab?.name);
      const result = readFactText(lab?.value);
      if (!title || !result) continue;
      const details = [
        [result, readFactText(lab?.unit)].filter(Boolean).join(' '),
        readFactText(lab?.referenceRange) ? `${translate('reference_range', 'Reference range')}: ${readFactText(lab?.referenceRange)}` : '',
        readFactText(lab?.flag) ? `${translate('source_flag', 'Report flag')}: ${readFactText(lab?.flag)}` : '',
      ].filter(Boolean);
      groups[1].facts.push({ id: `${doc.id}-lab-${index}`, title, details, date, uncertain: lab?.uncertain === true });
    }

    const terms = Array.isArray(extraction.diagnosesOrTerms) ? extraction.diagnosesOrTerms : [];
    for (const [index, value] of terms.entries()) {
      const title = readFactText(value);
      if (title) groups[2].facts.push({ id: `${doc.id}-term-${index}`, title, details: [], date });
    }
  }

  const visibleGroups = groups.filter((group) => group.facts.length);
  return <section className="health-profile-card soft-card" data-testid="health-profile">
    <div className="section-title-row"><div><div className="eyebrow">{translate('reviewed_health_facts', 'FROM RECORDS YOU CONFIRMED')}</div><h2 className="display">{translate('health_profile', 'Your health profile')}</h2></div></div>
    <p className="health-profile-note">{translate('health_profile_safety', 'Only details from records you confirmed appear here. Lab flags are copied from the report; they are not diagnoses.')}</p>
    {visibleGroups.length ? <div className="health-profile-groups">{visibleGroups.map((group) => <section className="health-profile-group" key={group.key}>
      <h3>{group.title}</h3>
      <ul>{group.facts.sort((a, b) => b.date.getTime() - a.date.getTime()).map((fact) => <li className="health-profile-fact" key={fact.id}>
        <span><b>{fact.title}</b>{fact.details.length > 0 && <small>{fact.details.join(' · ')}</small>}{fact.uncertain && <em>{translate('verify_against_source', 'Please verify against the original record.')}</em>}</span>
        <time dateTime={fact.date.toISOString()}>{fact.date.toLocaleDateString(localeTag[locale], { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</time>
      </li>)}</ul>
    </section>)}</div> : <p className="health-profile-empty">{translate('health_profile_empty', 'Reviewed medicines, test values, and terms will appear here after you confirm an extracted record.')}</p>}
  </section>;
}

const localeTag: Record<Locale, string> = { en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN' };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readFactText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function parseDocumentDate(doc: MedicalDocument): Date | null {
  const raw = readFactText(asRecord(doc.extraction)?.documentDate);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw ? null : parsed;
}

function sortDocumentsByEventDate(documents: MedicalDocument[]): MedicalDocument[] {
  return [...documents].sort((a, b) => {
    const eventDifference = (parseDocumentDate(b)?.getTime() ?? Date.parse(b.createdAt)) - (parseDocumentDate(a)?.getTime() ?? Date.parse(a.createdAt));
    return eventDifference || Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

function getAnalysisErrorMessage(error: unknown, translate: Translate): string {
  const payload = asRecord(asRecord(error)?.data);
  if (payload?.error === 'AI document reading is not configured') {
    return translate('ai_reading_unavailable', 'AI reading is not set up yet. Your uploaded file is saved; please contact the administrator.');
  }
  if (payload?.error === 'The uploaded file is not a supported medical document') {
    return translate('unsupported_document', 'This file is not a valid PDF, JPG, PNG, or WebP document.');
  }
  return translate('analyze_error', 'We could not read this file. Please try again later.');
}

type MedicalFileType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

async function detectMedicalFileType(file: File): Promise<MedicalFileType> {
  const bytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const header = new TextDecoder().decode(bytes);
  let detected: MedicalFileType | null = null;
  if (/^%PDF-/m.test(header)) detected = 'application/pdf';
  else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) detected = 'image/jpeg';
  else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) detected = 'image/png';
  else if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') detected = 'image/webp';
  if (!detected) throw new Error('This file could not be verified as a PDF, JPG, PNG, or WebP image.');
  const declared = file.type.toLowerCase();
  const normalizedDeclared = declared === 'image/jpg' || declared === 'image/pjpeg' ? 'image/jpeg' : declared;
  if (normalizedDeclared && normalizedDeclared !== 'application/octet-stream' && normalizedDeclared !== detected) {
    throw new Error('The selected file contents do not match its declared file type.');
  }
  return detected;
}

function ReviewPanel({ translate, doc, locale, summary, onSummary, extraction, onExtraction, reviewed, onReviewed, onAnalyze, onConfirm, analyzing, confirming, onDelete, deleting }: {
  translate: Translate;
  doc: MedicalDocument; locale: Locale; summary: string; onSummary: (value: string) => void; extraction: string; onExtraction: (value: string) => void;
  reviewed: boolean; onReviewed: (value: boolean) => void; onAnalyze: () => void; onConfirm: () => void;
  analyzing: boolean; confirming: boolean; onDelete: () => void; deleting: boolean;
}) {
  const needsReview = doc.status === 'review_required';
  const translatedSummary = doc.translatedSummary && doc.summaryLocale === locale ? doc.translatedSummary : doc.summary;
  return <div className="review-content">
    <div className="selected-file"><span className="selected-file-icon"><FileText size={16} /></span><span><b>{doc.fileName}</b><small>{doc.status === 'confirmed' ? translate('patient_confirmed_record', 'Patient-confirmed record') : translate('ai_draft', 'AI extraction is a draft')}</small></span><button aria-label={translate('remove_record', 'Remove this record')} onClick={onDelete} disabled={deleting} className="icon-button" data-testid={`button-delete-${doc.id}`}><Trash2 size={15} /></button></div>
    <div className="draft-alert"><AlertTriangle size={15} /><span><b>{translate('draft_disclaimer', 'Draft only — not a diagnosis or instruction.')}</b><small>{translate('prescription_review_disclaimer', 'Please compare every detail with your original record. Prescription names and doses are not definitive until verified by you and your clinician.')}</small></span></div>
    {doc.status === 'failed' && <div className="inline-message message-error" role="alert"><p>{translate('document_read_failed', 'This document could not be read reliably. No verified information was saved.')}</p><button className="btn btn-quiet" onClick={onAnalyze} disabled={analyzing} data-testid="button-retry-analysis">{analyzing ? translate('preparing_draft', 'Retrying…') : translate('retry_analysis', 'Try reading it again')}</button></div>}
    {doc.extractedText && <><label className="label review-label" htmlFor="extracted-source-text">{translate('extracted_text', 'Text read from document')}</label><textarea id="extracted-source-text" className="field extraction-editor" value={doc.extractedText} readOnly aria-label={translate('extracted_text', 'Text read from document')} data-testid="textarea-extracted-source-text" /></>}
    {doc.extraction || doc.summary || doc.translatedSummary ? <>
      {needsReview && doc.summary && doc.summaryLocale !== locale && <div className="language-draft-note"><Languages size={14} /><span>This summary is in a different language.</span><button onClick={onAnalyze} disabled={analyzing} data-testid="button-translate-summary">{analyzing ? 'Preparing…' : `Prepare in ${languages[locale]}`}</button></div>}
      <label className="label review-label" htmlFor="summary-draft">{translate('summary_draft', locale === 'en' ? 'Summary draft' : `${languages[locale]} summary draft`)}</label>
      <textarea id="summary-draft" className="field summary-editor" value={summary || translatedSummary || ''} onChange={(e) => onSummary(e.target.value)} readOnly={!needsReview} placeholder="A patient-friendly draft summary will appear here." data-testid="textarea-summary-draft" />
      <label className="label review-label" htmlFor="extraction-draft">{translate('extracted_details', 'Extracted details')} <span>({translate('editable', 'editable')})</span></label>
      <textarea id="extraction-draft" className="field extraction-editor" value={extraction} onChange={(e) => onExtraction(e.target.value)} readOnly={!needsReview} spellCheck={false} data-testid="textarea-extraction-draft" />
      {needsReview && <label className="patient-check"><input type="checkbox" checked={reviewed} onChange={(e) => onReviewed(e.target.checked)} data-testid="checkbox-patient-reviewed" /><span><b>{translate('reviewed_original', 'I have reviewed this draft against my original document.')}</b><small>{translate('ai_may_mistake', 'I understand AI can make mistakes, especially with medicine names and doses.')}</small></span></label>}
      {needsReview && <button className="btn btn-primary confirm-button" onClick={onConfirm} disabled={!reviewed || confirming} data-testid="button-confirm-draft">{confirming ? <span className="tiny-loader" /> : <CheckCircle2 size={17} />}{confirming ? translate('saving_review', 'Saving your review…') : translate('confirm_draft', 'Confirm my reviewed draft')}</button>}
      {doc.status === 'confirmed' && <div className="confirmed-note"><BadgeCheck size={16} /> {translate('record_confirmed', 'This record was reviewed and confirmed by you.')}</div>}
      {needsReview && <p className="review-verification-note">{translate('verify_uncertain_details', 'Check every uncertain or unclear value against the original document before confirming.')}</p>}
    </> : <div className="not-analyzed"><span className="summary-preview-icon"><Sparkles size={17} /></span><p>{translate('no_summary', labels.noSummary)}</p><button className="btn btn-quiet" onClick={onAnalyze} disabled={analyzing} data-testid="button-analyze-record">{analyzing ? <span className="tiny-loader" /> : <Sparkles size={16} />}{analyzing ? translate('preparing_draft', 'Preparing a draft…') : translate('prepare_summary', 'Prepare draft summary')}</button></div>}
    {doc.confidence !== null && doc.confidence !== undefined && <div className="confidence-note">{translate('extraction_confidence', 'Extraction confidence')}: {Math.round(doc.confidence * 100)}% <span>{translate('confidence_disclaimer', 'Confidence is not verification.')}</span></div>}
  </div>;
}

function FeedbackCard({ translate, open, setOpen, items, loading, failed, message, setMessage, category, setCategory, rating, setRating, pending, success, onSubmit }: {
  translate: Translate;
  open: boolean; setOpen: (value: boolean) => void; items: { id: string; category: string; message: string; createdAt: string }[]; loading: boolean; failed: boolean;
  message: string; setMessage: (value: string) => void; category: string; setCategory: (value: string) => void;
  rating: number; setRating: (value: number) => void; pending: boolean; success: boolean; onSubmit: () => void;
}) {
  return <section className="feedback-card soft-card"><div className="feedback-head"><span className="feedback-icon"><MessageSquareText size={18} /></span><div><b>{translate('feedback', 'Your voice helps')}</b><small>{translate('feedback_subtitle', 'Tell us how we’re doing')}</small></div><button className="expand-feedback" onClick={() => setOpen(!open)} aria-label={open ? translate('close_feedback', 'Close feedback form') : translate('open_feedback', 'Open feedback form')} data-testid="button-toggle-feedback">{open ? <X size={17} /> : <Plus size={17} />}</button></div>
    {open && <div className="feedback-form"><label className="label" htmlFor="feedback-topic">{translate('feedback_category', 'What’s this about?')}</label><select id="feedback-topic" className="field" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="select-feedback-category"><option value="experience">{translate('experience', 'My experience')}</option><option value="accuracy">{translate('accuracy', 'Accuracy')}</option><option value="accessibility">{translate('accessibility', 'Accessibility')}</option><option value="other">{translate('other', 'Something else')}</option></select><label className="label rating-label">{translate('rating_prompt', 'How was it?')}</label><div className="rating-choices">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={n === rating ? 'rating-choice chosen' : 'rating-choice'} onClick={() => setRating(n)} aria-label={`${n} ${translate('out_of_five', 'out of 5')}`} data-testid={`button-rating-${n}`}>{n}</button>)}</div><label className="label" htmlFor="feedback-message">{translate('feedback_message_prompt', 'Anything you’d like us to know?')}</label><textarea id="feedback-message" className="field feedback-textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={translate('feedback_placeholder', 'Your feedback goes directly to our team.')} data-testid="textarea-feedback-message" /><button className="btn btn-primary feedback-submit" onClick={onSubmit} disabled={pending || message.trim().length < 2} data-testid="button-submit-feedback">{pending ? <span className="tiny-loader" /> : <Send size={15} />}{pending ? translate('sending', 'Sending…') : translate('send_feedback', 'Send feedback')}</button>{success && <div className="feedback-success" role="status"><CheckCircle2 size={15} /> {translate('feedback_thanks', 'Thank you. Your note is with our team.')}</div>}</div>}
    {!open && <div className="feedback-latest">{loading ? <span className="muted-skeleton" /> : failed ? <span>{translate('feedback_unavailable', 'Feedback history is unavailable.')}</span> : items.length ? <span>{translate('last_shared', 'Last shared')}: {items[0].category.replace('_', ' ')}</span> : <span>{translate('feedback_welcome', 'Your feedback is always welcome.')}</span>}<button onClick={() => setOpen(true)} data-testid="button-share-feedback">{translate('share_thought', 'Share a thought')} <ArrowRight size={14} /></button></div>}
  </section>;
}

function AdminPage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading, isError, refetch } = useGetProfile();
  const admin = profile?.role === 'admin';
  const overview = useGetAdminOverview({ query: { queryKey: getGetAdminOverviewQueryKey(), enabled: !!admin } });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const userParams: ListAdminUsersParams = {
    page,
    pageSize: 10,
    search: search.trim() || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };
  const users = useListAdminUsers(userParams, { query: { queryKey: getListAdminUsersQueryKey(userParams), enabled: !!admin } });
  if (profileLoading) return <LoadingShell label="Verifying your access" />;
  if (isError || !profile) return <ErrorState retry={() => refetch()} message="We couldn’t verify your account. Please try again." />;
  if (!admin) return <AppShell profile={profile}><div className="access-denied soft-card"><span><LockKeyhole size={23} /></span><h1 className="display">This space is for Altrix staff.</h1><p>Your account doesn’t have access to this workspace. If you think this is a mistake, please contact your administrator.</p><Link href="/portal" className="btn btn-primary">Return to your records <ArrowRight size={16} /></Link></div></AppShell>;
  const retry = () => {
    queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey(userParams) });
  };
  return <AppShell profile={profile} active="admin">
    <section id="user-analytics" className="admin-analytics-section" aria-labelledby="user-analytics-heading">
      <h1 id="user-analytics-heading" className="display">User Analytics</h1>
      {overview.isLoading && <AdminSkeleton />}
      {overview.isError && <ErrorState retry={retry} message="User analytics couldn’t be loaded. Check your access or try again." />}
      {overview.data && <AdminOverviewView data={overview.data} />}
    </section>
    <section id="user-records" className="user-records-card soft-card" aria-labelledby="user-records-heading">
      <div className="user-records-heading"><div><h2 id="user-records-heading" className="display">User Records</h2></div>
        {users.data && <span className="user-total">{users.data.total.toLocaleString()} total</span>}
      </div>
      <label className="user-search-label">Search users<input className="field" type="search" maxLength={200} placeholder="Name, email, or user ID" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} data-testid="input-admin-search" /></label>
      {users.isLoading && <p role="status">Loading user records…</p>}
      {users.isError && <ErrorState retry={retry} message="User records couldn’t be loaded. Check your access or try again." />}
      {users.data && <>
        <div className="table-scroll"><table className="user-records-table"><thead><tr><th>User ID</th><th>Name</th><th>Email address</th><th>Role</th><th>Registration date</th></tr></thead><tbody>
          {users.data.users.map((user) => <tr key={user.id}><td className="user-id-cell">{user.id}</td><td><b>{user.name || '—'}</b></td><td>{user.email}</td><td><span className={`user-role-badge ${user.role === 'admin' ? 'admin' : ''}`}>{user.role === 'admin' ? 'Admin' : 'Patient'}</span></td><td>{new Date(user.createdAt).toLocaleDateString()}</td></tr>)}
        </tbody></table>{users.data.users.length === 0 && <AdminEmpty />}</div>
        <div className="user-pagination"><span>Showing {users.data.total ? (page - 1) * users.data.pageSize + 1 : 0}–{Math.min(page * users.data.pageSize, users.data.total)} of {users.data.total.toLocaleString()} users</span><div><button className="btn btn-outline" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} data-testid="button-admin-previous">Previous</button><span>Page {users.data.page} of {users.data.totalPages}</span><button className="btn btn-outline" type="button" onClick={() => setPage((current) => Math.min(users.data!.totalPages, current + 1))} disabled={page >= users.data.totalPages} data-testid="button-admin-next">Next</button></div></div>
      </>}
    </section>
  </AppShell>;
}

function AdminOverviewView({ data }: { data: AdminOverview }) {
  return <div className="admin-overview">
    <div className="user-analytics-grid">
      <MetricCard label="Registered users" value={data.totalUsers} sub="All account profiles" icon={<Users size={18} />} tone="mint" />
      <MetricCard label="Registered patients" value={data.totalPatients} sub="Patient accounts" icon={<HeartHandshake size={18} />} tone="peach" />
      <MetricCard label="Registered admins" value={data.totalAdmins} sub="Administrator accounts" icon={<ShieldCheck size={18} />} tone="gold" />
      <MetricCard label="Registered today" value={data.registrationsToday} sub="UTC calendar day" icon={<Clock3 size={18} />} tone="sage" />
      <MetricCard label="Registered this week" value={data.registrationsThisWeek} sub="Week starts Monday (UTC)" icon={<Activity size={18} />} tone="mint" />
      <MetricCard label="Registered this month" value={data.registrationsThisMonth} sub="UTC calendar month" icon={<BarChart3 size={18} />} tone="peach" />
    </div>
  </div>;
}

function MetricCard({ label, value, sub, icon, tone }: { label: string; value: number | string; sub: string; icon: ReactNode; tone: string }) {
  return <article className="metric-card soft-card"><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-label">{label}</span><b className="metric-value">{value}</b><small>{sub}</small></article>;
}
function AdminSkeleton() { return <div className="user-analytics-grid">{Array.from({ length: 6 }, (_, n) => <div className="metric-card soft-card" key={n}><i className="muted-skeleton" /><i className="muted-skeleton" /><i className="muted-skeleton" /></div>)}</div>; }
function AdminEmpty() { return <div className="admin-empty"><span><Users size={19} /></span><b>No matching users</b><p>Try changing your search or filters.</p></div>; }

function RequirePatient() {
  const auth = useAuth();
  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey(), enabled: auth.isLoaded && !!auth.isSignedIn } });
  if (!auth.isLoaded) return <LoadingShell label="Checking your account" />;
  if (!auth.isSignedIn) return <Redirect to="/patient/login" />;
  if (profile.isLoading) return <LoadingShell label="Verifying your patient account" />;
  if (profile.isError || !profile.data) return <ErrorState message="We couldn’t verify your account. Please try again." />;
  if (profile.data.role === 'admin') return <Redirect to="/admin/dashboard" />;
  return <PortalPage />;
}
function RequireAdmin() {
  const auth = useAuth();
  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey(), enabled: auth.isLoaded && !!auth.isSignedIn } });
  if (!auth.isLoaded) return <LoadingShell label="Checking your account" />;
  if (!auth.isSignedIn) return <Redirect to="/admin/login" />;
  if (profile.isLoading) return <LoadingShell label="Verifying administrator access" />;
  if (profile.isError || !profile.data) return <ErrorState message="We couldn’t verify your account. Please try again." />;
  if (profile.data.role !== 'admin') return <Redirect to="/patient/login?access=denied" />;
  return <AdminPage />;
}

function RoleAuthRoute({ role, signUp = false, signInPath, signUpPath }: { role: AccountType; signUp?: boolean; signInPath: string; signUpPath: string }) {
  const auth = useAuth();
  const [location] = useLocation();
  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey(), enabled: auth.isLoaded && !!auth.isSignedIn } });
  if (!auth.isLoaded) return <LoadingShell label="Checking your account" />;
  if (auth.isSignedIn) {
    if (profile.isLoading) return <LoadingShell label="Verifying your account" />;
    if (profile.isError || !profile.data) return <ErrorState message="We couldn’t verify your account. Please try again." />;
    if (role === 'admin' && profile.data.role !== 'admin') return <AccessDeniedPage />;
    if (role === 'patient' && location.includes('access=denied')) return <AccessDeniedPage />;
    return <Redirect to={profile.data.role === 'admin' ? '/admin/dashboard' : '/patient/dashboard'} />;
  }
  return <AuthPage role={role} signUp={signUp} signInPath={signInPath} signUpPath={signUpPath} />;
}

function PatientLoginRoute() { return <RoleAuthRoute role="patient" signInPath="/patient/login" signUpPath="/patient/register" />; }
function AdminLoginRoute() { return <RoleAuthRoute role="admin" signInPath="/admin/login" signUpPath="/patient/register" />; }
function PatientRegisterRoute() { return <RoleAuthRoute role="patient" signUp signInPath="/patient/login" signUpPath="/patient/register" />; }
function LegacySignInRoute() { return <RoleAuthRoute role="patient" signInPath="/sign-in" signUpPath="/patient/register" />; }
function LegacySignUpRoute() { return <RoleAuthRoute role="patient" signUp signInPath="/patient/login" signUpPath="/sign-up" />; }
function AppRouter() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/login" component={LoginLanding} />
    <Route path="/patient/login/*?" component={PatientLoginRoute} />
    <Route path="/admin/login/*?" component={AdminLoginRoute} />
    <Route path="/patient/register/*?" component={PatientRegisterRoute} />
    <Route path="/patient/dashboard" component={RequirePatient} />
    <Route path="/admin/dashboard" component={RequireAdmin} />
    <Route path="/portal" component={() => <Redirect to="/patient/dashboard" />} />
    <Route path="/admin" component={() => <Redirect to="/admin/dashboard" />} />
    <Route path="/sign-in/*?" component={LegacySignInRoute} />
    <Route path="/sign-up/*?" component={LegacySignUpRoute} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function ClerkApp() {
  const [, setLocation] = useLocation();
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={import.meta.env.VITE_CLERK_PROXY_URL} appearance={clerkAppearance}
    signInUrl={`${basePath}/patient/login`} signUpUrl={`${basePath}/patient/register`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Your health story is right where you left it.' } }, signUp: { start: { title: 'Make space for your health', subtitle: 'Create your private Altrix account.' } } }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <IdentityScopedApp />
  </ClerkProvider>;
}

function IdentityScopedApp() {
  const { isLoaded, userId } = useAuth();
  const queryClient = useMemo(() => new QueryClient(), [isLoaded, userId]);
  return <QueryClientProvider client={queryClient}><TooltipProvider><AppRouter /><Toaster /></TooltipProvider></QueryClientProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkApp /></WouterRouter>;
}

export default App;
