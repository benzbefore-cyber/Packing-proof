"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { PackageSearch, Video, ShieldCheck } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [showPdpa, setShowPdpa] = useState(false);

  useEffect(() => {
    // Check if user has already accepted PDPA
    const hasAccepted = localStorage.getItem("pdpa_accepted");
    if (!hasAccepted) {
      setShowPdpa(true);
    }
  }, []);

  const handleTrack = () => {
    if (trackingNumber.trim()) {
      router.push(`/track/${trackingNumber.trim()}`);
    }
  };

  const acceptPdpa = () => {
    localStorage.setItem("pdpa_accepted", "true");
    setShowPdpa(false);
  };

  return (
    <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      
      <div style={{ marginBottom: '1.5rem', background: 'var(--primary-light)', padding: '1rem', borderRadius: '50%', color: 'var(--primary-color)' }}>
        <ShieldCheck size={56} />
      </div>

      <h1 className="gradient-text" style={{ fontSize: '3.5rem', marginBottom: '1rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
        Packing Proof
      </h1>
      <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '3.5rem', maxWidth: '600px', lineHeight: 1.6 }}>
        ระบบตรวจสอบการแพ็คสินค้าอย่างโปร่งใส มั่นใจทุกกล่องด้วยหลักฐานวิดีโอตั้งแต่เริ่มแพ็คจนถึงมือคุณ
      </p>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '900px' }}>
        {/* Customer Section */}
        <div className="card" style={{ flex: '1', minWidth: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '1.25rem', borderRadius: '50%', marginBottom: '1.5rem', color: 'var(--primary-color)' }}>
            <PackageSearch size={40} />
          </div>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>สำหรับลูกค้า</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            กรอกหมายเลขพัสดุของคุณเพื่อดูวิดีโอการแพ็คสินค้า ตรวจสอบความถูกต้องก่อนจัดส่ง
          </p>
          <div className="form-group" style={{ width: '100%' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="กรอกหมายเลขติดตามพัสดุ (Tracking Number)" 
              style={{ marginBottom: '1rem', textAlign: 'center' }}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
            />
            <button className="btn-primary" style={{ width: '100%', fontSize: '1rem' }} onClick={handleTrack}>
              <PackageSearch size={18} /> ติดตามพัสดุ
            </button>
          </div>
        </div>

        {/* Staff Section */}
        <div className="card" style={{ flex: '1', minWidth: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1.25rem', borderRadius: '50%', marginBottom: '1.5rem', color: 'var(--success-color)' }}>
            <Video size={40} />
          </div>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>สำหรับพนักงาน</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            สแกนบาร์โค้ดพัสดุและบันทึกวิดีโอการแพ็คสินค้า (จำเป็นต้องเข้าสู่ระบบสำหรับพนักงาน)
          </p>
          <div style={{ marginTop: 'auto', width: '100%' }}>
            <Link href="/login" className="btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block', fontSize: '1rem' }}>
              เข้าสู่ระบบพนักงาน
            </Link>
          </div>
        </div>
      </div>

      {/* PDPA Modal */}
      {showPdpa && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'left' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
              นโยบายความเป็นส่วนตัว (PDPA)
            </h3>
            <div style={{ maxHeight: '60vh', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              <p style={{ marginBottom: '1rem' }}>
                เว็บไซต์นี้มีการจัดเก็บและประมวลผลข้อมูลส่วนบุคคล ได้แก่ ชื่อ ที่อยู่ เบอร์โทรศัพท์ และวิดีโอบันทึกการแพ็คสินค้า เพื่อวัตถุประสงค์ดังต่อไปนี้:
              </p>
              <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
                <li style={{ marginBottom: '0.5rem' }}>เพื่อใช้เป็นหลักฐานยืนยันความถูกต้องของสินค้า</li>
                <li style={{ marginBottom: '0.5rem' }}>ป้องกันการฉ้อโกงและการสูญหายระหว่างจัดส่ง</li>
                <li style={{ marginBottom: '0.5rem' }}>เพื่อการตรวจสอบและการรับประกันสินค้า</li>
              </ul>
              <p>
                ข้อมูลของคุณจะถูกเก็บรักษาอย่างปลอดภัยตาม พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) หากคุณใช้งานเว็บไซต์ต่อ ถือว่าคุณยอมรับข้อตกลงและเงื่อนไขของเรา
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                className="btn-primary" 
                style={{ width: '100%' }}
                onClick={acceptPdpa}
              >
                ฉันรับทราบและยินยอม
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
