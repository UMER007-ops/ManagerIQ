import { Link } from "react-router-dom";
import {
  QrCode,
  ClipboardList,
  Wrench,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

export default function LandingPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-500">
            Maintain<span className="text-white">IQ</span>
          </h1>

          <div className="hidden md:flex items-center gap-8">
            <a href="#home" className="hover:text-blue-400">
              Home
            </a>
            <a href="#about" className="hover:text-blue-400">
              About
            </a>
            <a href="#contact" className="hover:text-blue-400">
              Contact
            </a>
          </div>

          <div className="hidden md:flex gap-3">
            <Link
              to="/login"
              className="px-4 py-2 rounded-lg border border-blue-500 hover:bg-blue-500 transition"
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition"
            >
              Sign Up
            </Link>
          </div>

          <button
            className="md:hidden"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {open && (
          <div className="md:hidden bg-slate-900 px-6 pb-5 space-y-4">
            <a href="#home" className="block">
              Home
            </a>
            <a href="#about" className="block">
              About
            </a>
            <a href="#contact" className="block">
              Contact
            </a>

            <Link to="/login" className="block text-blue-400">
              Login
            </Link>

            <Link to="/signup" className="block text-blue-400">
              Sign Up
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section
        id="home"
        className="max-w-7xl mx-auto px-6 py-24 flex flex-col lg:flex-row items-center gap-12"
      >
        <div className="flex-1">
          <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-sm">
            AI Powered Asset Maintenance
          </span>

          <h1 className="text-5xl font-bold mt-6 leading-tight">
            Smart QR Based
            <span className="text-blue-500"> Asset Management</span>
          </h1>

          <p className="text-slate-400 mt-6 text-lg">
            Digitize your assets, report issues instantly, track maintenance
            history, and simplify maintenance workflows from one platform.
          </p>

          <div className="mt-8 flex gap-4">
            <Link
              to="/signup"
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
            >
              Get Started
            </Link>

            <Link
              to="/login"
              className="border border-slate-700 hover:border-blue-500 px-6 py-3 rounded-lg"
            >
              Login
            </Link>
          </div>
        </div>

        <div className="flex-1">
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-xl p-5">
                <QrCode className="text-blue-500 mb-3" />
                <h3 className="font-semibold">QR Assets</h3>
              </div>

              <div className="bg-slate-800 rounded-xl p-5">
                <ClipboardList className="text-blue-500 mb-3" />
                <h3 className="font-semibold">Issue Reports</h3>
              </div>

              <div className="bg-slate-800 rounded-xl p-5 col-span-2">
                <Wrench className="text-blue-500 mb-3" />
                <h3 className="font-semibold">
                  Maintenance Dashboard
                </h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Core Features
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-blue-500 transition">
            <QrCode className="text-blue-500 mb-4" size={36} />
            <h3 className="text-xl font-semibold mb-2">
              QR Asset Access
            </h3>
            <p className="text-slate-400">
              Every asset has its own QR code for quick issue reporting.
            </p>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-blue-500 transition">
            <ClipboardList className="text-blue-500 mb-4" size={36} />
            <h3 className="text-xl font-semibold mb-2">
              Issue Tracking
            </h3>
            <p className="text-slate-400">
              Monitor reported issues and their maintenance status.
            </p>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-blue-500 transition">
            <Wrench className="text-blue-500 mb-4" size={36} />
            <h3 className="text-xl font-semibold mb-2">
              Maintenance History
            </h3>
            <p className="text-slate-400">
              Keep a complete history of inspections and repairs.
            </p>
          </div>
        </div>
      </section>

      {/* About */}
      <section
        id="about"
        className="max-w-5xl mx-auto px-6 py-16 text-center"
      >
        <h2 className="text-3xl font-bold mb-6">About MaintainIQ</h2>

        <p className="text-slate-400 leading-8">
          MaintainIQ helps organizations manage assets through QR-powered
          maintenance tracking. Report issues, assign technicians, record
          maintenance activities, and maintain a complete service history in one
          simple platform.
        </p>
      </section>

      {/* Contact */}
      <section
        id="contact"
        className="max-w-3xl mx-auto px-6 py-16"
      >
        <h2 className="text-3xl font-bold text-center mb-10">
          Contact Us
        </h2>

        <form className="space-y-5">
          <input
            type="text"
            placeholder="Name"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
          />

          <input
            type="email"
            placeholder="Email"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
          />

          <textarea
            rows="5"
            placeholder="Message"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
          ></textarea>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold"
          >
            Send Message
          </button>
        </form>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-slate-400">
        © {new Date().getFullYear()} MaintainIQ. All Rights Reserved.
      </footer>
    </div>
  );
}