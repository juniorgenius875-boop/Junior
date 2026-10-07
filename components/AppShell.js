"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Icon from "@/components/Icons";

const studentNav = [
  { href: "/dashboard", label: "Overview", mobile: "Home", icon: "home", group: "Study" },
  { href: "/timetable", label: "Study Plan", mobile: "Plan", icon: "calendar", group: "Study" },
  { href: "/subjects", label: "Subjects", mobile: "Subjects", icon: "book", group: "Study" },
  { href: "/words", label: "Words & Meanings", mobile: "Words", icon: "words", group: "Study" },
  { href: "/mock-tests", label: "Board Mock Tests", mobile: "Mocks", icon: "clipboard", group: "Practice" },
  { href: "/skills", label: "Skill Tracker", mobile: "Skills", icon: "target", group: "Practice" },
  { href: "/prediction", label: "Performance AI", mobile: "Predict", icon: "chart", group: "Junior AI" },
  { href: "/test-corner", label: "Adaptive Tests", mobile: "Tests", icon: "brain", group: "Junior AI" },
  { href: "/ai-tutor", label: "AI Tutor", mobile: "Tutor", icon: "chat", group: "Junior AI" },
  { href: "/profile", label: "Profile & Report", mobile: "Profile", icon: "user", group: "Account" },
];

const adminNav = [
  { href: "/admin", label: "Dashboard", mobile: "Dashboard", icon: "home", group: "Management" },
  { href: "/admin/planner", label: "Work Planner", mobile: "Planner", icon: "calendar", group: "Management" },
  { href: "/admin/learning", label: "Learning Insights", mobile: "Insights", icon: "brain", group: "Analytics" },
];

const studentBottomNav = [studentNav[0], studentNav[1], studentNav[2], studentNav[8]];
const adminBottomNav = [adminNav[0], adminNav[1], adminNav[2]];

function isActive(pathname, href) {
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/users/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(profile) {
  const source = String(profile?.name || profile?.email || "U").trim();
  const pieces = source.split(/\s+/).filter(Boolean);
  return (pieces.slice(0, 2).map((x) => x[0]).join("") || "U").toUpperCase();
}

function NavItems({ nav, pathname, onNavigate, profile, admin }) {
  const groups = [...new Set(nav.map((item) => item.group))];
  return groups.map((group) => (
    <div className="nav-group" key={group}>
      <span className="nav-group-label">{group}</span>
      <nav className="side-links">
        {nav.filter((item) => item.group === group).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={isActive(pathname, item.href) ? "nav-link active" : "nav-link"}
          >
            <span className="nav-icon"><Icon name={item.icon} size={18}/></span>
            <span className="nav-text">{item.label}</span>
            <span className="nav-chevron"><Icon name="chevron" size={14}/></span>
          </Link>
        ))}
        {group === "Account" && profile?.role === "admin" && !admin && (
          <Link href="/admin" onClick={onNavigate} className="nav-link">
            <span className="nav-icon"><Icon name="shield" size={18}/></span>
            <span className="nav-text">Admin Console</span>
            <span className="nav-chevron"><Icon name="chevron" size={14}/></span>
          </Link>
        )}
      </nav>
    </div>
  ));
}

export default function AppShell({ children, title, subtitle, admin = false, actions = null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = admin ? adminNav : studentNav;
  const bottomNav = admin ? adminBottomNav : studentBottomNav;

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobileOpen]);

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  const displayName = profile?.name || "Student";
  const roleLabel = profile?.role === "admin" ? "Administrator" : (profile?.grade || "Student");

  return <div className="app-frame ui-v2-frame">
    <aside className="side-nav ui-v2-sidebar">
      <Link href={admin ? "/admin" : "/dashboard"} className="brand-block ui-v2-brand" aria-label="BoardTrack home">
        <span className="brand-logo"><Icon name="bolt" size={19}/></span>
        <span className="brand-copy"><strong>BoardTrack</strong><small>Study Tracker + Junior AI</small></span>
      </Link>

      <div className="sidebar-scroll ui-v2-nav-scroll">
        <NavItems nav={nav} pathname={pathname} profile={profile} admin={admin}/>
      </div>

      <div className="sidebar-profile ui-v2-sidebar-profile">
        {admin ? (
          <div className="sidebar-user admin-account-chip">
            <span className="avatar avatar-soft">{initials(profile)}</span>
            <span className="sidebar-user-copy"><strong>{displayName}</strong><small>{profile?.email || roleLabel}</small></span>
          </div>
        ) : (
          <Link href="/profile" className="sidebar-user">
            <span className="avatar avatar-soft">{initials(profile)}</span>
            <span className="sidebar-user-copy"><strong>{displayName}</strong><small>{profile?.email || roleLabel}</small></span>
          </Link>
        )}
        <button className="sidebar-logout" onClick={onLogout} aria-label="Sign out" title="Sign out"><Icon name="logout" size={18}/></button>
      </div>
    </aside>

    <main className="app-main ui-v2-main">
      <header className="top-bar ui-v2-topbar">
        <div className="top-title-wrap">
          <button className="mobile-menu-trigger" type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Icon name="menu" size={21}/>
          </button>
          <div className="top-title-copy">
            <span className="page-kicker">{admin ? "Admin workspace" : "Student workspace"}</span>
            <h1>{title}</h1>
            {subtitle && <p className="muted top-subtitle">{subtitle}</p>}
          </div>
        </div>
        <div className="top-actions">
          {actions}
          {admin ? (
            <div className="top-profile-chip ui-v2-profile-chip admin-profile-chip">
              <span className="avatar">{initials(profile)}</span>
              <span className="top-profile-copy"><strong>{displayName}</strong><small>{roleLabel}</small></span>
            </div>
          ) : (
            <Link href="/profile" className="top-profile-chip ui-v2-profile-chip" aria-label="Open profile">
              <span className="avatar">{initials(profile)}</span>
              <span className="top-profile-copy"><strong>{displayName}</strong><small>{roleLabel}</small></span>
            </Link>
          )}
        </div>
      </header>
      <div className="page-content ui-v2-content">{children}</div>
    </main>

    <nav className="bottom-nav ui-v2-bottom-nav" aria-label="Primary navigation">
      {bottomNav.map((item) => <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "bottom-link active" : "bottom-link"}>
        <Icon name={item.icon} size={19}/><span>{item.mobile || item.label}</span>
      </Link>)}
      <button className={mobileOpen ? "bottom-link active" : "bottom-link"} type="button" onClick={() => setMobileOpen(true)}>
        <Icon name="menu" size={19}/><span>More</span>
      </button>
    </nav>

    <div className={mobileOpen ? "mobile-drawer-layer open" : "mobile-drawer-layer"} aria-hidden={!mobileOpen}>
      <button className="mobile-drawer-backdrop" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"/>
      <aside className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu">
        <div className="mobile-drawer-head">
          <Link href={admin ? "/admin" : "/dashboard"} className="brand-block ui-v2-brand" onClick={() => setMobileOpen(false)}>
            <span className="brand-logo"><Icon name="bolt" size={18}/></span>
            <span className="brand-copy"><strong>BoardTrack</strong><small>Study Tracker + Junior AI</small></span>
          </Link>
          <button className="drawer-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><Icon name="close" size={20}/></button>
        </div>
        <div className="mobile-drawer-user">
          <span className="avatar avatar-soft">{initials(profile)}</span>
          <div><strong>{displayName}</strong><small>{profile?.email || roleLabel}</small></div>
        </div>
        <div className="mobile-drawer-nav">
          <NavItems nav={nav} pathname={pathname} profile={profile} admin={admin} onNavigate={() => setMobileOpen(false)}/>
        </div>
        <button className="mobile-signout" type="button" onClick={onLogout}><Icon name="logout" size={18}/> Sign out</button>
      </aside>
    </div>
  </div>;
}
