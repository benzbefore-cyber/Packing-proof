"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, setDoc, orderBy } from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { User, Package, Video, ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const { user } = useAuth();
  const [role, setRole] = useState("Staff");
  const [stats, setStats] = useState({ ordersCreated: 0, packagesPacked: 0 });
  const [loading, setLoading] = useState(true);
  const [recentPackages, setRecentPackages] = useState<any[]>([]);
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", nickname: "", phone: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;
      try {
        // Fetch Role and Profile
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.role === 'admin') setRole("Admin");
          setProfileForm({
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            nickname: data.nickname || "",
            phone: data.phone || ""
          });
        }

        // Fetch Orders Created by this user
        const qOrders = query(collection(db, "orders"), where("staffId", "==", user.uid));
        const ordersSnap = await getDocs(qOrders);

        // Fetch Packages Packed by this user
        const qPackages = query(collection(db, "packages"), where("staffId", "==", user.uid), orderBy("timestamp", "desc"));
        const packagesSnap = await getDocs(qPackages);

        setStats({
          ordersCreated: ordersSnap.size,
          packagesPacked: packagesSnap.size
        });

        const recent = packagesSnap.docs.slice(0, 10).map(d => ({ id: d.id, ...d.data() }));
        setRecentPackages(recent);

      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setSuccessMsg("");
    try {
      await setDoc(doc(db, "users", user.uid), profileForm, { merge: true });
      setSuccessMsg("อัปเดตโปรไฟล์สำเร็จ!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="container" style={{ padding: '2rem 1rem', maxWidth: '800px' }}>
        <Link href={role === 'Admin' ? "/admin" : "/staff"} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', color: 'var(--text-muted)' }}>
          <ArrowLeft size={20} /> ย้อนกลับ
        </Link>
        
        <div className="card" style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--bg-color)', padding: '2rem', borderRadius: '50%', color: 'var(--primary-color)' }}>
            <User size={64} />
          </div>
          <div>
            <h1 style={{ marginBottom: '0.5rem' }}>{user?.email}</h1>
            <span style={{ 
              background: role === 'Admin' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
              color: role === 'Admin' ? 'var(--primary-color)' : 'var(--success-color)', 
              padding: '0.25rem 0.75rem', 
              borderRadius: '999px', 
              fontWeight: 'bold',
              textTransform: 'uppercase',
              fontSize: '0.875rem'
            }}>
              {role}
            </span>
          </div>
        </div>

        {successMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={20} /> {successMsg}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>ข้อมูลส่วนตัว</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>ชื่อจริง</label>
              <input type="text" value={profileForm.firstName} onChange={e => setProfileForm({...profileForm, firstName: e.target.value})} className="input-field" placeholder="ระบุชื่อจริง" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>นามสกุล</label>
              <input type="text" value={profileForm.lastName} onChange={e => setProfileForm({...profileForm, lastName: e.target.value})} className="input-field" placeholder="ระบุนามสกุล" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>ชื่อเล่น</label>
              <input type="text" value={profileForm.nickname} onChange={e => setProfileForm({...profileForm, nickname: e.target.value})} className="input-field" placeholder="ระบุชื่อเล่น" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>เบอร์โทรศัพท์</label>
              <input type="tel" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} className="input-field" placeholder="ระบุเบอร์โทรศัพท์" />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Save size={18} /> {isSaving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
          </button>
        </form>

        <h2 style={{ marginBottom: '1rem' }}>ประสิทธิภาพการทำงาน</h2>
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '3rem' }}>
          <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ color: 'var(--primary-color)' }}><Package size={32} /></div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>สร้างออเดอร์แล้ว</p>
              <h2>{loading ? '...' : stats.ordersCreated}</h2>
            </div>
          </div>
          <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ color: 'var(--success-color)' }}><Video size={32} /></div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>แพ็คพัสดุแล้ว</p>
              <h2>{loading ? '...' : stats.packagesPacked}</h2>
            </div>
          </div>
        </div>

        <h2 style={{ marginBottom: '1rem' }}>ประวัติการแพ็คล่าสุด</h2>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {recentPackages.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบประวัติการแพ็ค</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-color)' }}>
                  <th style={{ padding: '1rem' }}>หมายเลขติดตามพัสดุ</th>
                  <th style={{ padding: '1rem' }}>วันและเวลา</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>วิดีโอ</th>
                </tr>
              </thead>
              <tbody>
                {recentPackages.map(pkg => (
                  <tr key={pkg.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>{pkg.trackingNumber}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{pkg.timestamp?.toDate().toLocaleString()}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <Link href={`/track/${pkg.trackingNumber}`} target="_blank" className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
                        ดู
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
