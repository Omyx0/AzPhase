import React, { useState } from 'react';
import { auth, db, googleProvider } from '../firebase';
import { signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import logo from '../assets/4.png';

const StudentLogin = ({ onLogin, onSwitchToSignup, onSwitchToTeacherLogin, onSwitchToLanding }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleGoogleLogin = async () => {
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role !== "student") {
          await signOut(auth);
          setError("Access Denied: You are registered as a Teacher. Please use Teacher Login.");
          return;
        }
        console.log('Student logged in via Google successfully');
        onLogin();
      } else {
        await signOut(auth);
        setError("Account not found. Please click 'Sign Up' to create a new account.");
      }
    } catch (err) {
      console.error("Google Login Error:", err.message);
      setError("Google Sign-In failed. Please try again.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role !== "student") {
          await signOut(auth);
          setError("Access Denied: This account is for Teachers only.");
          return;
        }
        console.log('Student logged in successfully');
        onLogin();
      } else {
        await signOut(auth);
        setError("User profile not found in database.");
      }

    } catch (err) {
      console.error('Login error:', err.message);
      setError('Invalid email or password. Please try again.');
    }
  };

  return (
    <div className="bg-white w-[380px] max-w-[95%] px-8 py-10 rounded-xl shadow-lg text-center">

      <div className="flex justify-center items-center mb-6">
        <img src={logo} alt="UniTime" className="h-14 object-contain rounded-lg" />
      </div>

      <h2 className="text-xl font-bold text-gray-600 mb-1.25">Student Login</h2>
      <p className="text-gray-600 text-sm mb-6.25">Log in to manage your tasks and optimize your time</p>

      {/* --- FORM MOVED TO TOP --- */}
      <form id="studentLoginForm" onSubmit={handleSubmit}>
        <div className="text-left mb-3.75">
          <label htmlFor="email" className="block text-sm font-semibold text-gray-800 mb-1.5">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3.5 py-2.75 border-2 border-gray-200 rounded-lg text-sm transition-all focus:border-blue-600 focus:outline-none focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
          />
        </div>

        <div className="text-left mb-3.75 relative">
          <label htmlFor="password" className="block text-sm font-semibold text-gray-800 mb-1.5">Password</label>
          <div className="relative">
            <input
              type={formData.showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-3.5 py-2.75 border-2 border-gray-200 rounded-lg text-sm transition-all focus:border-blue-600 focus:outline-none focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] pr-10"
            />
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, showPassword: !prev.showPassword }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              {formData.showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          </div>
        </div>

        {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

        <div className="flex items-center justify-between mt-2.5 mb-3 text-sm text-gray-600">
          <label className="flex items-center gap-1.5 whitespace-nowrap font-normal">
            <input
              type="checkbox"
              name="remember"
              checked={formData.remember}
              onChange={handleChange}
              className="m-0 w-auto"
            /> Remember me
          </label>
          <a href="#" className="text-[#7457d8] hover:underline">Forgot password?</a>
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-[#012f7b] border-none text-white rounded-lg font-semibold text-base cursor-pointer transition-all hover:bg-[#01235a] hover:shadow-[0_6px_15px_rgba(1,47,123,0.2)]"
        >
          Login
        </button>
      </form>

      {/* --- DIVIDER MOVED DOWN --- */}
      <div className="relative flex py-2 items-center mt-4 mb-4">
        <div className="flex-grow border-t border-gray-300"></div>
        <span className="flex-shrink mx-4 text-gray-400 text-xs">OR</span>
        <div className="flex-grow border-t border-gray-300"></div>
      </div>

      {/* --- GOOGLE BUTTON MOVED DOWN --- */}
      <button
        onClick={handleGoogleLogin}
        type="button"
        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-all shadow-sm"
      >
        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
        Sign in with Google
      </button>

      {/* --- FOOTER LINKS --- */}
      <div className="mt-6.25 text-sm text-gray-800 pt-5 border-t border-gray-200 mt-5">
        Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToSignup(); }} className="text-[#7457d8] font-semibold no-underline hover:underline">Sign Up</a>
      </div>

      <div className="mt-3 text-sm text-gray-800">
        Are you a Teacher? <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToTeacherLogin(); }} className="text-blue-600 font-semibold no-underline mx-1.25 hover:text-[#7457d8]">Login as Teacher</a>
      </div>
    </div>
  );
};

export default StudentLogin;