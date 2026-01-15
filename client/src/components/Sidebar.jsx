import React from 'react';
import { NavLink, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  User,
  LogOut,
  X,
  Sun,
  Moon,
  Calendar,
  BookOpen
} from "lucide-react";

// IMPORT IMAGES HERE
import logoLight from '../assets/2.png'; // White background logo for Light Mode
import logoDark from '../assets/3.png';  // Dark background logo for Dark Mode

export default function Sidebar({ onLogout, isDark, setIsDark, sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive
      ? "bg-blue-600 text-white"
      : isDark
        ? "text-gray-300 hover:bg-gray-700"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  // Updated logout handler to terminate real-time session
  const handleLogout = async () => {
    try {
      await signOut(auth); // Terminates Firebase session
      onLogout(); // Clears local state in App.jsx
      navigate("/"); // Redirects to login view
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {!sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(true)}
        />
      )}

      <aside className={`sticky top-0 h-screen overflow-y-auto w-64 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } border-r p-4 flex flex-col shadow-lg`}>

        {/* Header with close button */}
        <div className="flex items-center justify-between mb-8">

          {/* LOGO REPLACEMENT - Adjusted height to fix "tiny" issue */}
          <div className="flex items-center gap-2">
            <img
              src={isDark ? logoDark : logoLight}
              alt="UniTime Logo"
              className="h-10 w-auto object-contain"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-yellow-400' : 'hover:bg-gray-100 text-gray-600'
                }`}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className={`p-2 rounded-lg lg:hidden transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                }`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          <NavLink to="/" className={linkClass}>
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>

          <NavLink to="/analytics" className={linkClass}>
            <BarChart3 size={18} /> Analytics
          </NavLink>

          <NavLink to="/timetable" className={linkClass}>
            <BookOpen size={18} /> Academic Documents
          </NavLink>

          <NavLink to="/profile" className={linkClass}>
            <User size={18} /> Profile
          </NavLink>

          <NavLink to="/settings" className={linkClass}>
            <Settings size={18} /> Settings
          </NavLink>
        </nav>

        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isDark
            ? 'text-red-400 hover:bg-gray-700'
            : 'text-red-600 hover:bg-red-50'
            }`}
        >
          <LogOut size={18} /> Logout
        </button>
      </aside>
    </>
  );
}