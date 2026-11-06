import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Flag,
  Heart,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Menu,
  Plus,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { children, fixtures as initialFixtures, notices } from "./lib/demo";
import {
  canManageFixtures,
  canPublishSquad,
  matchDate,
  matchTime,
} from "./lib/contracts";
import type {
  AvailabilityResponse,
  FixtureSummary,
  Role,
} from "./lib/contracts";

const nav = [
  { path: "/preview", label: "Overview", icon: LayoutDashboard },
  { path: "/preview/children", label: "My children", icon: Users },
  { path: "/preview/fixtures", label: "Fixtures", icon: CalendarDays },
  { path: "/preview/announcements", label: "Club news", icon: Megaphone },
  { path: "/preview/notifications", label: "Notifications", icon: Bell },
];
const roles: Role[] = ["guardian", "coach", "manager", "admin"];
function Modal({
  title,
  children: content,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    d.showModal();
    return () => {
      d.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {content}
    </dialog>
  );
}
function Pitch() {
  return (
    <div className="pitch-art" aria-hidden="true">
      <svg viewBox="0 0 360 240">
        <rect x="20" y="20" width="320" height="200" rx="4" />
        <path d="M180 20v200M20 65h55v110H20M340 65h-55v110h55" />
        <circle cx="180" cy="120" r="42" />
        <circle cx="180" cy="120" r="3" className="pitch-dot" />
      </svg>
      <span className="pitch-player p1">7</span>
      <span className="pitch-player p2">14</span>
      <span className="pitch-player p3">9</span>
      <span className="pitch-ball">✦</span>
    </div>
  );
}

function FixtureCard({
  fixture: f,
  staff,
  response,
  canSelect,
  onView,
  onRespond,
  onReview,
}: {
  fixture: FixtureSummary;
  staff: boolean;
  response?: AvailabilityResponse;
  canSelect: boolean;
  onView: () => void;
  onRespond: (response: AvailabilityResponse) => void;
  onReview: () => void;
}) {
  const player = children.find((c) => c.teamId === f.teamId);
  return (
    <article className="fixture-card">
      <div className="fixture-top">
        <span className="eyebrow">
          <span className={`dot ${f.teamId === "u10" ? "orange" : ""}`} />
          {player?.team ?? "Under 12"} <span className="muted">/</span>{" "}
          {staff ? "League fixture" : `${player?.name}’s team`}
        </span>
        <span className={`badge ${f.homeAway === "away" ? "neutral" : ""}`}>
          {f.homeAway === "home" ? "Home" : "Away"}
        </span>
      </div>
      <div className="matchup">
        <div className="club-crest">
          <Zap size={23} />
        </div>
        <div>
          <span className="small muted">Green Point FC</span>
          <h3>vs {f.opponent}</h3>
        </div>
        <button
          className="icon-button fixture-arrow"
          aria-label={`View ${f.opponent} fixture`}
          onClick={onView}
        >
          <ArrowRight size={19} />
        </button>
      </div>
      <div className="fixture-meta">
        <span>
          <CalendarDays size={15} />
          {matchDate(f.kickoffAt)}
        </span>
        <span>
          <Clock3 size={15} />
          {matchTime(f.kickoffAt)} SAST
        </span>
      </div>
      <div className="venue">
        <MapPin size={15} />
        {f.venue}
      </div>
      {staff ? (
        <button className="text-button staff-action" onClick={onReview}>
          {canSelect ? "Review matchday squad" : "View fixture details"}
          <ArrowRight size={16} />
        </button>
      ) : (
        <div className="availability">
          <div className="response-heading">
            <span>
              {response ? "Your response" : `Can ${player?.name} make it?`}
            </span>
            {response ? (
              <span className="saved">
                <Check size={13} /> Demo saved
              </span>
            ) : (
              <span className="small muted">
                Reply by {matchDate(f.responseDeadlineAt)}
              </span>
            )}
          </div>
          <div className="response-buttons">
            {(["available", "unavailable", "unsure"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={response === value}
                className={response === value ? `chosen ${value}` : ""}
                onClick={() => onRespond(value)}
              >
                {value === "available" ? (
                  <Check size={15} />
                ) : value === "unavailable" ? (
                  <X size={15} />
                ) : (
                  <CircleHelp size={15} />
                )}
                <span>
                  {value === "available"
                    ? "Available"
                    : value === "unavailable"
                      ? "Can’t make it"
                      : "Unsure"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default function App() {
  const [role, setRole] = useState<Role>("guardian");
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const sidebar = document.querySelector<HTMLElement>(".sidebar")!;
    sidebar.querySelector<HTMLElement>("a")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        requestAnimationFrame(() =>
          document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus(),
        );
      }
      if (e.key === "Tab") {
        const links = Array.from(
          sidebar.querySelectorAll<HTMLElement>("a, button:not(:disabled)"),
        );
        const target = e.shiftKey ? links.at(-1)! : links[0];
        if (
          (e.shiftKey && document.activeElement === links[0]) ||
          (!e.shiftKey && document.activeElement === links.at(-1))
        ) {
          e.preventDefault();
          target.focus();
        }
      }
    };
    const resize = () => {
      if (window.innerWidth > 650) setMenuOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", resize);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);
  const [childId, setChildId] = useState("all");
  const [responses, setResponses] = useState<
    Record<string, AvailabilityResponse>
  >({});
  const [read, setRead] = useState<string[]>([]);
  const [fixtureList, setFixtureList] = useState(initialFixtures);
  const [modal, setModal] = useState<
    "help" | "add" | "fixture" | "notice" | "squad" | null
  >(null);
  const [activeFixture, setActiveFixture] = useState<FixtureSummary>(
    initialFixtures[0],
  );
  const [noticeId, setNoticeId] = useState("kit");
  const [toast, setToast] = useState("");
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [publishedSelection, setPublishedSelection] = useState<
    Record<string, string>
  >({});
  const [approved, setApproved] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const staff = role !== "guardian";
  const path = location.pathname;
  const page =
    path === "/preview" || path === "/" ? "overview" : path.split("/")[2];
  const child = children.find((c) => c.id === childId);
  const filtered = fixtureList.filter((f) =>
    role === "guardian"
      ? !child || f.teamId === child.teamId
      : role === "admin" || f.teamId === "u12",
  );
  const unread = notices.length - read.length;
  const currentNotice = notices.find((n) => n.id === noticeId)!;
  const announce = (message: string) => setToast(message);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const switchRole = (next: Role) => {
    setRole(next);
    setChildId("all");
    setMenuOpen(false);
    setModal(null);
    navigate("/preview");
  };
  const responseKey = (f: FixtureSummary) =>
    `${f.id}:${children.find((c) => c.teamId === f.teamId)?.id ?? "demo-player"}`;
  const fixtureCard = (f: FixtureSummary) => (
    <FixtureCard
      key={f.id}
      fixture={f}
      staff={staff}
      response={responses[responseKey(f)]}
      canSelect={canPublishSquad(role)}
      onView={() => navigate(`/preview/fixtures/${f.id}`)}
      onReview={() => {
        setActiveFixture(f);
        if (canPublishSquad(role)) setModal("squad");
        else navigate(`/preview/fixtures/${f.id}`);
      }}
      onRespond={(value) => {
        setResponses((old) => ({ ...old, [responseKey(f)]: value }));
        announce(
          `${children.find((c) => c.teamId === f.teamId)?.name}: ${value}. Demo response updated.`,
        );
      }}
    />
  );
  const sectionHead = (title: string, subtitle: string, action?: ReactNode) => (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
  const newsCards = (
    <div className="news-grid">
      {notices.map((n) => (
        <button
          key={n.id}
          className="news-card"
          onClick={() => {
            setNoticeId(n.id);
            setModal("notice");
          }}
        >
          <div className={`news-icon ${n.colour}`}>
            {n.id === "kit" ? (
              <Flag />
            ) : n.id === "weekend" ? (
              <Trophy />
            ) : (
              <Heart />
            )}
          </div>
          <div>
            <span className="eyebrow">
              {n.category}
              <span className="news-date">{n.date}</span>
            </span>
            <h3>{n.title}</h3>
            <p>{n.body}</p>
            <span className="read-story">
              Read update <ArrowRight size={14} />
            </span>
          </div>
        </button>
      ))}
    </div>
  );
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="app-shell">
        {menuOpen && (
          <button
            className="nav-scrim"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
          <NavLink to="/preview" className="brand">
            <span className="brand-mark">
              <Zap size={25} fill="currentColor" />
            </span>
            <span>
              stat<span className="brand-light">edge</span>
              <small>CLUB MANAGER</small>
            </span>
          </NavLink>
          <div className="club-switch">
            <div className="mini-crest">
              <Zap size={17} />
            </div>
            <div>
              <strong>Green Point FC</strong>
              <span>Cape Town, South Africa</span>
            </div>
            <Shield size={16} />
          </div>
          <p className="nav-caption">YOUR CLUB</p>
          <nav aria-label="Main navigation">
            {nav.map((item) => {
              const Icon = item.icon;
              const isChildren = item.path.endsWith("children");
              return (
                <NavLink
                  key={item.path}
                  to={isChildren && staff ? "/preview/teams" : item.path}
                  end={item.path === "/preview"}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                >
                  <Icon size={19} />
                  <span>{isChildren && staff ? "My teams" : item.label}</span>
                  {item.path.endsWith("notifications") && unread > 0 && (
                    <span className="nav-count">{unread}</span>
                  )}
                </NavLink>
              );
            })}
            {role === "admin" && (
              <NavLink
                className="nav-link"
                onClick={() => setMenuOpen(false)}
                to="/preview/registrations"
              >
                <Shield size={19} />
                Registrations
              </NavLink>
            )}
          </nav>
          <div className="sidebar-bottom">
            <div className="team-note">
              <span className="mini-stars">✦</span>
              <strong>More than a game.</strong>
              <p>
                A little teamwork.
                <br />A whole lot of belonging.
              </p>
              <span className="note-line" />
            </div>
            <button
              className="nav-link"
              onClick={() => {
                setMenuOpen(false);
                setModal("help");
              }}
            >
              <CircleHelp size={19} />
              Help & support
              <ArrowDownLeft size={15} />
            </button>
            <NavLink
              className="profile"
              onClick={() => setMenuOpen(false)}
              to="/preview/account"
            >
              <span className="avatar">{staff ? "TS" : "SM"}</span>
              <span>
                <strong>{staff ? "Thabo Smith" : "Sam Mokoena"}</strong>
                <small>{role[0].toUpperCase() + role.slice(1)}</small>
              </span>
              <Settings size={17} />
            </NavLink>
          </div>
        </aside>
        <div className="workspace" inert={menuOpen}>
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMenuOpen(true)}
              >
                <Menu />
              </button>
              <span>My club</span>
              <ChevronRight size={14} />
              <strong>
                {(
                  {
                    overview: "Overview",
                    children: "My children",
                    fixtures: "Fixtures",
                    announcements: "Club news",
                    notifications: "Notifications",
                    teams: "My teams",
                    account: "Account",
                    registrations: "Registrations",
                  } as Record<string, string>
                )[page] ?? "Page not found"}
              </strong>
            </div>
            <div className="top-actions">
              <span className="season">
                <span className="dot" />
                2026 season
              </span>
              <button
                className="icon-button notification-bell"
                aria-label={`${unread} unread notifications`}
                onClick={() => navigate("/preview/notifications")}
              >
                <Bell size={20} />
                {unread > 0 && <i />}
              </button>
              <NavLink
                to="/preview/account"
                className="avatar small-avatar"
                aria-label="Your account"
              >
                {staff ? "TS" : "SM"}
              </NavLink>
            </div>
          </header>
          <div className="demo-bar">
            <span>
              <Sparkles size={14} />
              <strong>Club preview</strong>
              <span className="demo-description">
                Synthetic data · changes reset on refresh
              </span>
            </span>
            <label>
              View as{" "}
              <select
                aria-label="Preview role"
                value={role}
                onChange={(e) => switchRole(e.target.value as Role)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r[0].toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <main id="main" key={path + role} className="main-content">
            {page === "overview" && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow greeting">
                      A GOOD DAY FOR FOOTBALL
                    </div>
                    <h1>
                      {staff
                        ? "Let’s get matchday ready."
                        : "Hey Sam, welcome back."}
                      <span className="greeting-dot">●</span>
                    </h1>
                    <p>
                      {staff
                        ? "Your team, your fixtures. Everything in one place."
                        : "Little moments. Big matchdays. Here’s what’s coming up for your family."}
                    </p>
                  </div>
                  <span className="date-chip">
                    <CalendarDays size={16} />6 November 2026{" "}
                    <span className="small">Demo</span>
                  </span>
                </div>
                <section className="hero">
                  <div className="hero-copy">
                    <div className="hero-label">
                      <span className="live-dot" />
                      THE WEEKEND IS CALLING
                    </div>
                    <h2>
                      Boots on.
                      <br />
                      Game faces ready.
                    </h2>
                    <p>
                      Another chance to play, grow and cheer together.
                      <br className="desktop-break" /> Let’s make the next
                      matchday a great one.
                    </p>
                    <button
                      className="button lime-button"
                      onClick={() => navigate("/preview/fixtures")}
                    >
                      View upcoming fixtures
                      <ArrowRight size={17} />
                    </button>
                  </div>
                  <Pitch />
                  <div className="hero-bottom">
                    <span>GREEN POINT FC</span>
                    <span>ONE CLUB. EVERY FAMILY.</span>
                  </div>
                </section>
                <div className="stats-grid">
                  <div className="stat-card">
                    <span className="stat-icon lime">
                      <Users size={21} />
                    </span>
                    <div>
                      <span className="stat-label">
                        {staff ? "Your teams" : "Your young players"}
                      </span>
                      <div className="stat-number">
                        {staff ? (role === "admin" ? "5" : "1") : "02"}
                        <span>
                          {staff ? "This season" : "A whole lot of potential"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon peach">
                      <CalendarDays size={21} />
                    </span>
                    <div>
                      <span className="stat-label">Upcoming fixtures</span>
                      <div className="stat-number">
                        {String(filtered.length).padStart(2, "0")}
                        <span>Let’s get matchday ready</span>
                      </div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon lavender">
                      <Bell size={21} />
                    </span>
                    <div>
                      <span className="stat-label">New club updates</span>
                      <div className="stat-number">
                        {String(unread).padStart(2, "0")}
                        <button
                          className="inline-link"
                          onClick={() => navigate("/preview/notifications")}
                        >
                          Catch up <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                {sectionHead(
                  "Next on the pitch",
                  "A quick check-in now. A smoother matchday later.",
                  <NavLink to="/preview/fixtures" className="text-button">
                    All fixtures
                    <ArrowRight size={15} />
                  </NavLink>,
                )}
                {!staff && (
                  <div className="child-filters" aria-label="Filter by child">
                    {[{ id: "all", name: "All children" }, ...children].map(
                      (c) => (
                        <button
                          key={c.id}
                          className={childId === c.id ? "selected" : ""}
                          aria-pressed={childId === c.id}
                          onClick={() => setChildId(c.id)}
                        >
                          {c.name}
                          {c.id !== "all" && (
                            <span
                              className={`tiny-avatar ${c.id === "demo-leo" ? "peach" : "lime"}`}
                            >
                              {c.name[0]}
                            </span>
                          )}
                        </button>
                      ),
                    )}
                  </div>
                )}
                <div className="fixture-grid">
                  {filtered.slice(0, 2).map((f) => fixtureCard(f))}
                </div>
                {sectionHead(
                  "Around the club",
                  "The latest from our little football community.",
                  <NavLink to="/preview/announcements" className="text-button">
                    All updates
                    <ArrowRight size={15} />
                  </NavLink>,
                )}
                {newsCards}
                <div className="community-strip">
                  <Heart size={20} />
                  <p>
                    Behind every young player is a great team.{" "}
                    <strong>Thanks for being part of ours.</strong>
                  </p>
                  <span>⚽</span>
                </div>
              </>
            )}
            {page === "fixtures" && (
              <>
                {sectionHead(
                  "Every matchday starts here.",
                  "Fixtures, meeting times and a little forward planning. All times are SAST.",
                  canManageFixtures(role) && (
                    <button
                      className="button primary-button"
                      onClick={() => setModal("add")}
                    >
                      <Plus size={17} />
                      Preview a fixture
                    </button>
                  ),
                )}
                {path.split("/")[3] ? (
                  (() => {
                    const f = filtered.find((f) => f.id === path.split("/")[3]);
                    return f ? (
                      <>
                        <button
                          className="text-button back-button"
                          onClick={() => navigate("/preview/fixtures")}
                        >
                          <ChevronLeft size={17} />
                          All fixtures
                        </button>
                        <div className="detail-layout">
                          {fixtureCard(f)}
                          <aside className="detail-note">
                            <h3>A little matchday checklist</h3>
                            <p>
                              <Clock3 size={17} />
                              Meet at {matchTime(f.meetingAt)} SAST
                            </p>
                            <p>
                              <Check size={17} />
                              Boots & shin pads
                            </p>
                            <p>
                              <Check size={17} />
                              Water bottle & team kit
                            </p>
                            <div className="notice-box">
                              {publishedSelection[f.id]
                                ? `Demo squad outcome: ${publishedSelection[f.id].replace("_", " ")}`
                                : "Squad announcement coming soon."}
                            </div>
                          </aside>
                        </div>
                      </>
                    ) : (
                      <div className="empty-state">
                        <Shield />
                        <h2>Fixture unavailable</h2>
                        <p>This fixture is not part of your preview team.</p>
                      </div>
                    );
                  })()
                ) : (
                  <div className="fixture-grid">
                    {filtered.map((f) => fixtureCard(f))}
                  </div>
                )}
              </>
            )}
            {page === "children" &&
              (staff ? (
                <div className="empty-state">
                  <Shield />
                  <h2>Switch to guardian preview</h2>
                  <p>Child cards belong to the guardian view.</p>
                </div>
              ) : (
                <>
                  {sectionHead(
                    "Small boots. Big dreams.",
                    "Your children and their place in the club.",
                  )}
                  <div className="children-grid">
                    {children.map((c) => (
                      <article className="child-card" key={c.id}>
                        <div
                          className={`player-art ${c.colour}`}
                          aria-hidden="true"
                        >
                          <span>{c.number}</span>
                          <Shield size={84} />
                          <span className="jersey-name">
                            {c.name.toUpperCase()}
                          </span>
                        </div>
                        <div className="child-card-body">
                          <span className="badge">Approved · demo</span>
                          <h2>
                            {c.name} {c.surname}
                          </h2>
                          <p>{c.team} · Green Point FC</p>
                          <button
                            className="button secondary-button"
                            onClick={() => {
                              setChildId(c.id);
                              navigate("/preview");
                            }}
                          >
                            View {c.name}’s fixtures
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="notice-box">
                    Child registration and verified guardian linking arrive in
                    P2. This preview contains fictional players only.
                  </div>
                </>
              ))}
            {page === "teams" &&
              (staff ? (
                <>
                  {sectionHead(
                    "Together, we’re a team.",
                    "Your authorised team preview. Roster permissions arrive in P1–P3.",
                  )}
                  <div className="team-grid">
                    {(role === "admin"
                      ? ["u8", "u10", "u12", "u14", "u16"]
                      : ["u12"]
                    ).map((t) => (
                      <article className="team-card" key={t}>
                        <div className="club-crest">
                          <Shield />
                        </div>
                        <h2>Under {t.slice(1)}</h2>
                        <p>Green Point FC · 2026 season</p>
                        <span className="badge">
                          {children.filter((c) => c.teamId === t).length} sample
                          players
                        </span>
                        <button
                          className="text-button"
                          onClick={() => navigate("/preview/fixtures")}
                        >
                          View fixtures
                          <ArrowRight size={16} />
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <Shield />
                  <h2>Staff preview only</h2>
                  <p>Use My children to view your family’s teams.</p>
                </div>
              ))}
            {page === "announcements" && (
              <>
                {sectionHead(
                  "Good things happen together.",
                  "News, useful reminders and a little club spirit.",
                )}
                {newsCards}
              </>
            )}
            {page === "notifications" && (
              <>
                {sectionHead(
                  "You’re in the loop.",
                  `${unread} unread club updates.`,
                  <button
                    className="text-button"
                    onClick={() => {
                      setRead(notices.map((n) => n.id));
                      announce("All updates marked as read.");
                    }}
                  >
                    <CheckCheck size={17} />
                    Mark all read
                  </button>,
                )}
                <div className="notification-list">
                  {notices.map((n) => (
                    <button
                      className={`notification-item ${read.includes(n.id) ? "is-read" : ""}`}
                      key={n.id}
                      onClick={() => {
                        setRead((old) => [...new Set([...old, n.id])]);
                        setNoticeId(n.id);
                        setModal("notice");
                      }}
                    >
                      <span className={`stat-icon ${n.colour}`}>
                        <Megaphone size={20} />
                      </span>
                      <span>
                        <strong>{n.title}</strong>
                        <span>{n.body}</span>
                        <small>{n.date} · Club update</small>
                      </span>
                      {!read.includes(n.id) && <span className="dot" />}
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {page === "registrations" &&
              (role === "admin" ? (
                <>
                  {sectionHead(
                    "A place in the team.",
                    "Preview the registration review experience.",
                  )}
                  <article className="review-card">
                    <span className="avatar">TN</span>
                    <div>
                      <h3>Tumi Nkosi</h3>
                      <p>Under 8 requested · synthetic application</p>
                    </div>
                    <span className="badge">
                      {approved ? "Approved · demo" : "Pending review"}
                    </span>
                    <button
                      className="button primary-button"
                      disabled={approved}
                      onClick={() => {
                        setApproved(true);
                        announce(
                          "Demo application approved. No real registration was changed.",
                        );
                      }}
                    >
                      {approved ? (
                        <>
                          <Check size={16} />
                          Approved
                        </>
                      ) : (
                        "Preview approval"
                      )}
                    </button>
                  </article>
                </>
              ) : (
                <div className="empty-state">
                  <Shield />
                  <h2>Admin preview only</h2>
                  <p>Registration reviews belong to the club administrator.</p>
                </div>
              ))}
            {page === "account" && (
              <>
                {sectionHead(
                  "Your corner of the club.",
                  "A simple account preview. Secure sign-in arrives in P1.",
                )}
                <div className="account-card">
                  <span className="avatar large-avatar">
                    {staff ? "TS" : "SM"}
                  </span>
                  <h2>{staff ? "Thabo Smith" : "Sam Mokoena"}</h2>
                  <p>{staff ? "staff" : "sam"}@example.test</p>
                  <span className="badge">{role} preview</span>
                  <hr />
                  <p>
                    <MapPin size={17} />
                    South Africa · Africa/Johannesburg
                  </p>
                  <p>
                    <Shield size={17} />
                    Only synthetic data is used in this preview.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setModal("help")}
                  >
                    Privacy & support
                    <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}
            {![
              "overview",
              "fixtures",
              "children",
              "teams",
              "announcements",
              "notifications",
              "registrations",
              "account",
            ].includes(page) && (
              <div className="empty-state">
                <Flag />
                <h2>That page is off the pitch.</h2>
                <p>Let’s get you back to your club.</p>
                <NavLink className="button primary-button" to="/preview">
                  Back to overview
                  <ArrowRight size={16} />
                </NavLink>
              </div>
            )}
            <footer>
              <span>
                stat<strong>edge</strong>
                <span className="footer-divider">/</span>Built for the beautiful
                game.
              </span>
              <span>
                Cape Town, ZA <span className="dot" />
              </span>
            </footer>
          </main>
        </div>
      </div>
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          {toast}
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {modal === "help" && (
        <Modal
          title="A little help from your club"
          onClose={() => setModal(null)}
        >
          <p>
            This is the StatEdge P0 interactive preview. All names, fixtures and
            responses are fictional. Your changes last until you refresh.
          </p>
          <div className="help-steps">
            <p>
              <Shield size={20} />
              <span>
                <strong>Private by design</strong>Verified adult accounts and
                server-enforced permissions are planned for P1.
              </span>
            </p>
            <p>
              <Activity size={20} />
              <span>
                <strong>Easy on your phone</strong>Use the menu to explore,
                choose a child and try a fixture response.
              </span>
            </p>
            <p>
              <Heart size={20} />
              <span>
                <strong>Need club support?</strong>A club contact and privacy
                request workflow will be added before real registrations.
              </span>
            </p>
          </div>
          <button
            className="button primary-button full-width"
            onClick={() => setModal(null)}
          >
            Got it
            <Check size={16} />
          </button>
        </Modal>
      )}
      {modal === "notice" && (
        <Modal title={currentNotice.title} onClose={() => setModal(null)}>
          <span className="eyebrow">
            {currentNotice.category} · {currentNotice.date}
          </span>
          <p className="notice-body">{currentNotice.body}</p>
          <div className="notice-box">
            From your Green Point FC team · synthetic club update
          </div>
          <button
            className="button primary-button full-width"
            onClick={() => {
              setRead((old) => [...new Set([...old, noticeId])]);
              setModal(null);
            }}
          >
            Mark as read
            <Check size={16} />
          </button>
        </Modal>
      )}
      {modal === "squad" && (
        <Modal title="Matchday squad preview" onClose={() => setModal(null)}>
          <p>
            Green Point FC vs {activeFixture.opponent}. Explore a draft outcome
            for Ayo.
          </p>
          <label className="form-label">
            Draft selection
            <select
              value={selection[activeFixture.id] ?? "selected"}
              onChange={(e) =>
                setSelection((old) => ({
                  ...old,
                  [activeFixture.id]: e.target.value,
                }))
              }
            >
              <option value="selected">Selected</option>
              <option value="reserve">Reserve</option>
              <option value="not_selected">Not selected</option>
            </select>
          </label>
          <div className="notice-box">
            Published preview:{" "}
            {publishedSelection[activeFixture.id]?.replace("_", " ") ??
              "Not announced"}
            . Draft edits do not change this until you publish.
          </div>
          <button
            className="button primary-button full-width"
            onClick={() => {
              setPublishedSelection((old) => ({
                ...old,
                [activeFixture.id]: selection[activeFixture.id] ?? "selected",
              }));
              announce(
                "Synthetic squad preview published. No notifications were sent.",
              );
              setModal(null);
            }}
          >
            Publish preview
            <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {modal === "add" && (
        <Modal title="Preview a new fixture" onClose={() => setModal(null)}>
          <p>
            Try the fixture form with fictional details. This adds a card to
            this browser session only.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              const kickoff = new Date(
                `${d.get("date")}T${d.get("time")}:00+02:00`,
              );
              if (
                !String(d.get("opponent")).trim() ||
                !String(d.get("venue")).trim()
              )
                return;
              setFixtureList((old) => [
                ...old,
                {
                  id: `demo-${crypto.randomUUID()}`,
                  teamId: "u12",
                  opponent: String(d.get("opponent")).trim(),
                  venue: String(d.get("venue")).trim(),
                  kickoffAt: kickoff.toISOString(),
                  meetingAt: new Date(+kickoff - 2700000).toISOString(),
                  responseDeadlineAt: new Date(
                    +kickoff - 86400000,
                  ).toISOString(),
                  status: "published",
                  revision: 1,
                  homeAway: "home",
                },
              ]);
              setModal(null);
              announce("Preview fixture added. No real fixture was published.");
            }}
          >
            <label className="form-label">
              Opponent
              <input
                name="opponent"
                placeholder="e.g. Seaside Juniors"
                required
                maxLength={80}
              />
            </label>
            <div className="form-row">
              <label className="form-label">
                Match date
                <input
                  name="date"
                  type="date"
                  defaultValue="2026-11-28"
                  required
                />
              </label>
              <label className="form-label">
                Kick-off (SAST)
                <input name="time" type="time" defaultValue="10:00" required />
              </label>
            </div>
            <label className="form-label">
              Venue
              <input
                name="venue"
                placeholder="e.g. Green Point Sports Ground"
                required
                maxLength={120}
              />
            </label>
            <button className="button primary-button full-width" type="submit">
              Add preview fixture
              <Plus size={16} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
