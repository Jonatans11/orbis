import { Outlet, NavLink } from "react-router-dom";

const TABS = [
  { to: "/", label: "Home", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 10a1 1 0 0 1 .4-.8l8-6a1 1 0 0 1 1.2 0l8 6a1 1 0 0 1 .4.8v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21V12h6v9"/></svg> },
  { to: "/credentials", label: "Credentials", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7z"/><path d="M9 12 11 14 15 10"/></svg> },
  { to: "/messages", label: "Messages", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { to: "/settings", label: "Settings", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
];

export default function Layout() {
  return (
    <div id="root-inner">
      <main className="page"><Outlet /></main>
      <nav className="tab-bar">
        {TABS.map(tab => (
          <NavLink key={tab.to} to={tab.to} end={tab.to === "/"} className={({ isActive }) => `tab-item${isActive ? " active" : ""}`}>
            {tab.icon}
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}