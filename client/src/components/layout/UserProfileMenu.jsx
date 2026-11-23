import React, { useEffect, useRef, useState } from "react";
import Icon from "../common/Icon";
import { useAuth } from "../../context/AuthContext";

export function UserProfileMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    // Smooth transition before clearing session
    setTimeout(async () => {
      await logout();
      setIsLoggingOut(false);
      setIsOpen(false);
    }, 280);
  };

  const initial = (user?.name || user?.email || "U").slice(0, 1).toUpperCase();
  const displayName =
    user?.name || (user?.email ? user.email.split("@")[0] : "Developer");
  const isGuest = user?.isGuest || false;

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="User account menu"
        className={`group flex items-center gap-2.5 rounded-2xl border px-3 py-1.5 text-xs font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-emerald-600 ${
          isOpen
            ? "border-emerald-300 bg-emerald-50/70 text-emerald-900 shadow-sm"
            : "border-slate-200/90 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 shadow-2xs"
        }`}
      >
        {/* Animated Avatar Pill */}
        <div className="relative">
          <span className="flex h-6 w-6 items-center justify-center rounded-xl bg-linear-to-br from-emerald-600 to-teal-700 text-[11px] font-bold text-white shadow-2xs">
            {initial}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1.5 ring-white" />
        </div>

        <span className="hidden xs:inline sm:inline max-w-27.5 truncate text-slate-800 font-semibold group-hover:text-emerald-800 transition">
          {displayName}
        </span>

        <Icon
          name="chevronDown"
          size={13}
          className={`text-slate-400 transition-transform duration-200 ${
            isOpen
              ? "rotate-180 text-emerald-700"
              : "group-hover:text-slate-600"
          }`}
        />
      </button>

      {/* Modern Animated Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-72 rounded-3xl border border-slate-200/90 bg-white p-3 shadow-2xl shadow-slate-900/10 z-50 animate-dropdown-pop">
          {/* User Profile Card */}
          <div className="flex items-start gap-3 rounded-2xl bg-linear-to-br from-slate-50 to-slate-100/70 p-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-600 to-teal-700 text-sm font-bold text-white shadow-sm">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {displayName}
                </p>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    isGuest
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {isGuest ? "Guest" : "Developer"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {user?.email}
              </p>
            </div>
          </div>

          {/* Quick Details / Status */}
          <div className="my-2.5 px-3 py-1 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Workspace active</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              v1.0 (ESM)
            </span>
          </div>

          <div className="h-px bg-slate-100 my-1.5" />

          {/* Modern Interactive Logout Button with Transitions */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="group relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 transition-all duration-200 hover:bg-rose-50 hover:text-rose-700 hover:shadow-2xs active:scale-[0.98] disabled:opacity-60"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-rose-100 group-hover:text-rose-600 transition-colors duration-200">
                <Icon
                  name="logOut"
                  size={14}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </span>
              <span className="font-bold">
                {isLoggingOut ? "Signing out..." : "Sign Out"}
              </span>
            </div>

            <span className="text-[10px] font-semibold text-slate-400 group-hover:text-rose-500 transition-colors">
              End session
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default UserProfileMenu;
