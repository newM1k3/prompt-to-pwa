import { Link, useNavigate } from "react-router-dom";
import { Sparkles, LayoutDashboard, Settings, LogIn, LogOut, User } from "lucide-react";
import { useAuth } from "../hooks/usePocketBase";
import CreditBadge from "./CreditBadge";

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-neutral-200">
      <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 text-neutral-900 hover:text-primary transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-h5 font-bold">App Genie</span>
        </Link>

        {/* Right: Navigation + Auth */}
        <div className="flex items-center gap-3">
          {/* Dashboard link */}
          {user && (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-body-sm text-neutral-600 hover:text-neutral-900 transition-colors px-3 py-2 rounded-lg hover:bg-neutral-100"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          )}

          {/* Settings link */}
          {user && (
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 text-body-sm text-neutral-600 hover:text-neutral-900 transition-colors px-3 py-2 rounded-lg hover:bg-neutral-100"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          )}

          {/* Credit badge (authenticated only) */}
          {user && <CreditBadge />}

          {/* Auth section */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-3 py-2">
                <User className="w-4 h-4 text-neutral-400" />
                <span className="text-body-sm text-neutral-700 truncate max-w-[160px]">
                  {(user.email as string) || "User"}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-body-sm text-neutral-500 hover:text-neutral-700 transition-colors rounded-lg hover:bg-neutral-100"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors text-body-sm shadow-button hover:shadow-lg"
            >
              <LogIn className="w-4 h-4" />
              Login
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
