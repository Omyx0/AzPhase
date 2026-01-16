import React, { useEffect, useState } from "react";
import {
  Calendar,
  ArrowRight,
  Layout,
  CheckCircle,
  Users,
  Shield,
  Clock,
  BookOpen,
  LogIn,
  School,
  Mail,
  Phone,
  Instagram,
  MapPin
} from "lucide-react";

// IMPORT IMAGES
import logoScrolled from '../assets/2.png'; // White background optimized (Photo 2)
import logoHero from '../assets/3.png';     // Dark background optimized (Photo 3)

const LandingPage = ({ onSwitchToStudentLogin, onSwitchToTeacherLogin, onSwitchToSignup }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="font-sans text-slate-900 bg-white min-h-screen w-full overflow-x-hidden flex flex-col">

      {/* ================= NAVBAR ================= */}
      <nav
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled ? "bg-white shadow-md py-3" : "bg-transparent py-5"
          }`}
      >
        <div className="container mx-auto px-6 flex justify-between items-center">
          {/* LOGO IMAGE LOGIC */}
          <div className="flex items-center gap-2">
            <img
              src={scrolled ? logoScrolled : logoHero}
              alt="UniTime"
              className="h-10 w-auto object-contain transition-all duration-300"
            />
          </div>

          {/* DESKTOP LINKS */}
          <div
            className={`hidden md:flex gap-8 font-medium transition-colors ${scrolled ? "text-slate-700" : "text-slate-200"
              }`}
          >
            <button onClick={() => scrollTo("features")} className="hover:text-indigo-500 transition">Features</button>
            <button onClick={() => scrollTo("about")} className="hover:text-indigo-500 transition">About</button>
            <button onClick={() => scrollTo("contact")} className="hover:text-indigo-500 transition">Contact Us</button>
          </div>

          {/* AUTH BUTTONS (Fixed Visibility) */}
          <div className="flex items-center gap-4">
            <button
              onClick={onSwitchToStudentLogin}
              className={`flex items-center gap-2 font-medium transition-colors ${scrolled ? "text-slate-700 hover:text-indigo-600" : "text-white hover:text-indigo-200"
                }`}
            >
              <LogIn className="w-4 h-4" /> Login
            </button>

            <button
              onClick={onSwitchToSignup}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-full font-semibold transition-transform hover:scale-105 shadow-lg"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ================= HERO (Fixed Full Screen) ================= */}
      <section className="relative w-full min-h-screen flex items-center justify-center bg-slate-900 pt-20">
        {/* Background Gradients */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative z-10 container mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
            Organize Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              University Life
            </span>
          </h1>
          <p className="text-slate-300 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            UniTime helps students manage classes, assignments, and deadlines -
            all in one powerful dashboard.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={onSwitchToSignup}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all hover:shadow-indigo-600/30 hover:shadow-lg"
            >
              Start Free <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={onSwitchToStudentLogin}
              className="border border-white/30 hover:bg-white/10 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all"
            >
              Student Login
            </button>
          </div>

          <div className="mt-8">
            <button
              onClick={onSwitchToTeacherLogin}
              className="text-slate-400 hover:text-white text-sm flex items-center justify-center gap-2 mx-auto transition-colors underline decoration-slate-600 underline-offset-4 hover:decoration-white"
            >
              <School className="w-4 h-4" /> Are you a Faculty Member? Login here
            </button>
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="features" className="py-24 bg-white w-full">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Everything you need to succeed
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              We've packed UniTime with features designed specifically for the modern academic environment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Layout, title: "Unified Dashboard", desc: "View your entire week at a glance." },
              { icon: CheckCircle, title: "Task Tracking", desc: "Never miss a deadline again." },
              { icon: Users, title: "Collaboration", desc: "Connect with peers easily." },
              { icon: Shield, title: "Secure Data", desc: "Your academic data is private." },
              { icon: Clock, title: "Real-time Updates", desc: "Instant notifications for changes." },
              { icon: BookOpen, title: "Resource Library", desc: "Keep all your notes organized." }
            ].map((feature, i) => (
              <div
                key={i}
                className="p-8 bg-slate-50 border border-slate-100 rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <feature.icon className="text-indigo-600 w-10 h-10 mb-5" />
                <h3 className="font-bold text-xl text-slate-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            )
            )}
          </div>
        </div>
      </section>

      {/* ================= ABOUT ================= */}
      <section id="about" className="py-24 bg-slate-50 w-full border-t border-slate-200">
        <div className="container mx-auto px-6 max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900">Why UniTime?</h2>
          <p className="text-slate-600 text-lg leading-relaxed mb-8">
            UniTime was created to solve real problems faced by university
            students - missed deadlines, poor time management, and scattered
            tools. Our mission is simple: give students clarity, control, and
            confidence.
          </p>
        </div>
      </section>

      {/* ================= DETAILED FOOTER (Contact Us) ================= */}
      <footer id="contact" className="bg-slate-900 text-slate-300 py-16 w-full mt-auto">
        <div className="container mx-auto px-6 grid md:grid-cols-3 gap-10">

          {/* Column 1: Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logoHero} alt="UniTime" className="h-8" />
            </div>
            <p className="text-slate-400 mb-6">
              Empowering students to organize, plan, and succeed in their academic journey.
            </p>
            <div className="flex gap-4">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="bg-slate-800 p-2 rounded-full hover:bg-indigo-600 transition">
                <Instagram className="w-5 h-5 text-white" />
              </a>
              <a href="mailto:support@unitime.com" className="bg-slate-800 p-2 rounded-full hover:bg-indigo-600 transition">
                <Mail className="w-5 h-5 text-white" />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><button onClick={() => scrollTo("features")} className="hover:text-indigo-400 transition">Features</button></li>
              <li><button onClick={() => scrollTo("about")} className="hover:text-indigo-400 transition">About Us</button></li>
              <li><button onClick={onSwitchToStudentLogin} className="hover:text-indigo-400 transition">Login</button></li>
              <li><button onClick={onSwitchToSignup} className="hover:text-indigo-400 transition">Sign Up</button></li>
            </ul>
          </div>

          {/* Column 3: Contact Info */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-indigo-500 mt-1" />
                <span>MITS Gwalior, Race Course Road,<br />Gwalior, MP 474005</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-indigo-500" />
                <a href="mailto:support@unitime.com" className="hover:text-white transition">support@unitime.com</a>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-indigo-500" />
                <a href="tel:+911234567890" className="hover:text-white transition">+91 123 456 7890</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-12 pt-8 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} UniTime. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;