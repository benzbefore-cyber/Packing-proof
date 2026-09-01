"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/staff");
    } catch (err: any) {
      setError(err.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("กรุณากรอกอีเมลของคุณก่อน");
      return;
    }
    setError("");
    setResetMessage("");
    setLoading(true);
    
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage("ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว! กรุณาตรวจสอบในอีเมลของคุณ");
    } catch (err: any) {
      setError(err.message || "ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
      <div style={{ alignSelf: 'flex-start', marginBottom: 'auto' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <ArrowLeft size={20} /> กลับสู่หน้าหลัก
        </Link>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '400px', margin: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(37, 99, 235, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--primary-color)' }}>
            <Lock size={32} />
          </div>
          <h2>เข้าสู่ระบบพนักงาน</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>กรอกข้อมูลเพื่อเข้าสู่ระบบ</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        
        {resetMessage && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {resetMessage}
          </div>
        )}

        <form onSubmit={isResetting ? handleResetPassword : handleLogin}>
          <div className="form-group">
            <label htmlFor="email">อีเมล</label>
            <input
              id="email"
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          {!isResetting && (
            <div className="form-group">
              <label htmlFor="password">รหัสผ่าน</label>
              <input
                id="password"
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem', fontSize: '1rem' }} disabled={loading}>
            {loading ? "กำลังดำเนินการ..." : (isResetting ? "ส่งอีเมลรีเซ็ตรหัสผ่าน" : "เข้าสู่ระบบ")}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button 
            type="button" 
            onClick={() => { setIsResetting(!isResetting); setError(""); setResetMessage(""); }} 
            style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.95rem' }}
          >
            {isResetting ? "กลับไปหน้าเข้าสู่ระบบ" : "ลืมรหัสผ่านใช่หรือไม่?"}
          </button>
        </div>
      </div>
      <div style={{ marginTop: 'auto' }}></div>
    </div>
  );
}
