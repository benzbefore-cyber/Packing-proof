"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeft, PackageCheck, AlertCircle, Loader2, Info, Truck, CheckCircle2, MessageSquareWarning, X } from "lucide-react";

export default function TrackPage() {
  const params = useParams();
  const trackingId = params.trackingId as string;
  
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [logisticsData, setLogisticsData] = useState<any>(null); // For Real API

  // Claim State
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimIssue, setClaimIssue] = useState("missing_item");
  const [claimDesc, setClaimDesc] = useState("");
  const [claimTimestamp, setClaimTimestamp] = useState("");
  const [claimSuccess, setClaimSuccess] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const fetchTrackingInfo = async () => {
      try {
        let finalTrackingNumberToSearch = trackingId;
        let foundOrderData: any = null;

        const ordersRef = collection(db, "orders");
        const orderByIdQuery = query(ordersRef, where("shopOrderId", "==", trackingId));
        const orderByFlashQuery = query(ordersRef, where("flashTracking", "==", trackingId));

        const [idSnapshot, flashSnapshot] = await Promise.all([
          getDocs(orderByIdQuery),
          getDocs(orderByFlashQuery)
        ]);

        if (!idSnapshot.empty) {
          foundOrderData = { id: idSnapshot.docs[0].id, ...idSnapshot.docs[0].data() };
          finalTrackingNumberToSearch = foundOrderData.flashTracking;
        } else if (!flashSnapshot.empty) {
          foundOrderData = { id: flashSnapshot.docs[0].id, ...flashSnapshot.docs[0].data() };
        }

        setOrderInfo(foundOrderData);

        const packagesRef = collection(db, "packages");
        let videoSnapshot = await getDocs(query(packagesRef, where("trackingNumber", "==", finalTrackingNumberToSearch)));
        
        if (videoSnapshot.empty && finalTrackingNumberToSearch !== trackingId) {
           videoSnapshot = await getDocs(query(packagesRef, where("trackingNumber", "==", trackingId)));
        }
        
        if (videoSnapshot.empty && foundOrderData?.shopOrderId) {
           videoSnapshot = await getDocs(query(packagesRef, where("trackingNumber", "==", foundOrderData.shopOrderId)));
        }

        if (videoSnapshot.empty) {
          setError("ยังไม่พบวิดีโอการแพ็คสำหรับหมายเลขนี้ พัสดุอาจจะอยู่ในระหว่างการแพ็ค");
        } else {
          let docs = videoSnapshot.docs.map(doc => doc.data());
          docs.sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());
          
          const data = docs[0];
          setVideoUrl(data.videoUrl);
          if (data.timestamp) {
            setTimestamp(data.timestamp.toDate());
          }

          // Real Flash Express API Hook
          const FLASH_API_KEY = process.env.NEXT_PUBLIC_FLASH_API_KEY;
          if (FLASH_API_KEY && finalTrackingNumberToSearch) {
             try {
               // In a real integration, you would hit your proxy API or Flash Express directly:
               /*
               const response = await fetch(`https://api.flashexpress.com/v1/tracking?pno=${finalTrackingNumberToSearch}`, {
                 headers: { "Authorization": `Bearer ${FLASH_API_KEY}` }
               });
               const flashData = await response.json();
               setLogisticsData(flashData);
               */
               console.log("Mocking Flash Express fetch since actual endpoint requires signed payload.");
             } catch (e) {
               console.error("Flash API fetch error", e);
             }
          }
        }
      } catch (err: any) {
        console.error(err);
        setError("เกิดข้อผิดพลาดในการดึงข้อมูลการติดตาม");
      } finally {
        setLoading(false);
      }
    };

    if (trackingId) {
      fetchTrackingInfo();
    }
  }, [trackingId]);

  const handleOpenClaim = () => {
    if (videoRef.current) {
      const time = Math.floor(videoRef.current.currentTime);
      const minutes = Math.floor(time / 60);
      const seconds = time % 60;
      setClaimTimestamp(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }
    setShowClaimModal(true);
    setClaimSuccess(false);
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "claims"), {
        orderId: orderInfo?.shopOrderId || trackingId,
        trackingNumber: trackingId,
        customerName: orderInfo?.customerName || "Unknown",
        issueType: claimIssue,
        description: claimDesc,
        videoTimestamp: claimTimestamp,
        createdAt: serverTimestamp(),
        status: "pending"
      });
      setClaimSuccess(true);
      setTimeout(() => setShowClaimModal(false), 3000);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการส่งรายงานปัญหา");
    }
  };

  // Logistics Timeline Status based on order status / real API
  const getTimelineSteps = () => {
    let statusIndex = 0;
    
    // Fallback to local DB state
    if (orderInfo && orderInfo.status === 'packed') statusIndex = 1;

    // If we have real logistics data, override status
    if (logisticsData && logisticsData.state) {
      if (logisticsData.state === '1') statusIndex = 1; // Picked up
      if (logisticsData.state === '3') statusIndex = 2; // In Transit
      if (logisticsData.state === '4') statusIndex = 3; // Delivered
    }

    return [
      { label: "ได้รับออเดอร์", active: true, icon: <PackageCheck size={20} /> },
      { label: "แพ็คและตรวจสอบแล้ว", active: statusIndex >= 1, icon: <CheckCircle2 size={20} /> },
      { label: "กำลังจัดส่ง", active: statusIndex >= 2, icon: <Truck size={20} /> },
    ];
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)' }}>
      <header style={{ backgroundColor: 'var(--surface-color)', padding: '1rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <ArrowLeft size={20} /> กลับสู่หน้าหลัก
        </Link>
        <h1 style={{ marginLeft: 'auto', fontSize: '1.25rem', color: 'var(--primary-color)' }}>Packing Proof</h1>
      </header>

      <main className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2.5rem' }}>รายละเอียดการติดตามพัสดุ</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.5rem', marginTop: '0.5rem' }}>
            หมายเลขที่ค้นหา: <strong style={{ color: 'var(--primary-color)', fontSize: '1.75rem' }}>{trackingId}</strong>
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '4rem' }}>
            <Loader2 size={48} color="var(--primary-color)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-muted)' }}>กำลังค้นหาข้อมูลพัสดุของคุณ...</p>
          </div>
        ) : error ? (
          <div className="card" style={{ width: '100%', maxWidth: '600px', textAlign: 'center', padding: '3rem' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'var(--error-color)' }}>
              <AlertCircle size={32} />
            </div>
            <h3 style={{ marginBottom: '1rem' }}>ไม่พบวิดีโอ</h3>
            <p style={{ color: 'var(--text-muted)' }}>{error}</p>
            {orderInfo && (
               <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-color)', borderRadius: '8px', textAlign: 'left' }}>
                  <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>พบข้อมูลออเดอร์:</h4>
                  <p><strong>รหัสออเดอร์ร้านค้า:</strong> {orderInfo.shopOrderId}</p>
                  <p><strong>หมายเลขติดตาม Flash:</strong> {orderInfo.flashTracking}</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>ออเดอร์ได้ลงทะเบียนแล้ว แต่วิดีโอการแพ็คยังไม่ได้อัปโหลด</p>
               </div>
            )}
            <Link href="/" className="btn-primary" style={{ marginTop: '2rem' }}>ลองค้นหาหมายเลขอื่น</Link>
          </div>
        ) : (
          <div className="card" style={{ width: '100%', maxWidth: '1000px', padding: '3rem' }}>
            
            {/* LOGISTICS TIMELINE */}
            <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
               <h4 style={{ marginBottom: '1rem' }}>สถานะการจัดส่ง</h4>
               <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '16px', left: '10%', right: '10%', height: '2px', background: 'var(--border-color)', zIndex: 0 }}></div>
                  {getTimelineSteps().map((step, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: '0.5rem' }}>
                       <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: step.active ? 'var(--primary-color)' : 'var(--bg-color)', color: step.active ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: step.active ? 'none' : '2px solid var(--border-color)' }}>
                         {step.icon}
                       </div>
                       <span style={{ fontSize: '0.875rem', fontWeight: step.active ? '600' : '400', color: step.active ? 'var(--text-main)' : 'var(--text-muted)' }}>{step.label}</span>
                    </div>
                  ))}
               </div>
            </div>

            {orderInfo && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem', padding: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', borderLeft: '4px solid var(--primary-color)' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', marginBottom: '0.5rem' }}><Info size={20} /> ข้อมูลออเดอร์</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '0.5rem' }}>
                    <div>
                      <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>รหัสออเดอร์ร้านค้า</p>
                      <p style={{ fontWeight: '500', fontSize: '1.25rem' }}>{orderInfo.shopOrderId}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>หมายเลขติดตาม Flash</p>
                      <p style={{ fontWeight: '500', fontSize: '1.25rem' }}>{orderInfo.flashTracking}</p>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>ลูกค้า</p>
                      <p style={{ fontWeight: '500', fontSize: '1.25rem' }}>{orderInfo.customerName}</p>
                    </div>
                    {orderInfo.staffName && (
                      <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                        <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>แพ็คโดย</p>
                        <p style={{ fontWeight: '500', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={20} color="var(--success-color)" /> {orderInfo.staffName}</p>
                      </div>
                    )}
                  </div>
                  
                  {orderInfo.items && orderInfo.items.length > 0 && (
                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '1.5rem' }}>
                      <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>รายการสินค้าที่แพ็ค (ตรวจสอบผ่านการสแกนบาร์โค้ดแล้ว)</p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {orderInfo.items.map((item: any, idx: number) => (
                          <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: idx !== orderInfo.items.length - 1 ? '1px dashed rgba(0,0,0,0.1)' : 'none' }}>
                            <span style={{ fontWeight: '500', fontSize: '1.125rem' }}>{item.name} <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>({item.size}, {item.color})</span></span>
                            <span style={{ fontWeight: 'bold', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={18} color="var(--success-color)"/> x{item.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
               </div>
            )}

            <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '2rem' }}>
              <div>
                <h4 style={{ fontSize: '1.25rem' }}>หลักฐานวิดีโอการแพ็ค</h4>
                {timestamp && <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.25rem' }}>แพ็คเมื่อ {timestamp.toLocaleString('th-TH')}</p>}
              </div>
              <button onClick={handleOpenClaim} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error-color)', borderColor: 'var(--error-color)' }}>
                <MessageSquareWarning size={16} /> รายงานปัญหา
              </button>
            </div>

            {videoUrl && (
              <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000', aspectRatio: '16/9' }}>
                <video 
                  ref={videoRef}
                  src={videoUrl} 
                  controls 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  poster="/video-placeholder.png"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
            
          </div>
        )}
      </main>

      {/* Claim Modal */}
      {showClaimModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
           <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
              <button onClick={() => setShowClaimModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24}/></button>
              <h3 style={{ marginBottom: '1rem', color: 'var(--error-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquareWarning /> รายงานปัญหา</h3>
              
              {claimSuccess ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <CheckCircle2 size={48} color="var(--success-color)" style={{ margin: '0 auto 1rem' }} />
                  <h4>ส่งรายงานปัญหาสำเร็จ</h4>
                  <p style={{ color: 'var(--text-muted)' }}>เจ้าของร้านได้รับแจ้งแล้วและจะทำการตรวจสอบวิดีโอของคุณ</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitClaim}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>พบปัญหาใช่ไหม? หยุดวิดีโอในจุดที่คุณพบปัญหาแล้วส่งรายงานแจ้งเรา</p>
                  
                  <div className="form-group">
                    <label>เวลาในวิดีโอ (Timestamp)</label>
                    <input type="text" className="input-field" value={claimTimestamp} onChange={e => setClaimTimestamp(e.target.value)} placeholder="00:00" />
                  </div>

                  <div className="form-group">
                    <label>ประเภทปัญหา</label>
                    <select className="input-field" value={claimIssue} onChange={e => setClaimIssue(e.target.value)}>
                      <option value="missing_item">สินค้าไม่ครบ</option>
                      <option value="wrong_item">แพ็คสินค้าผิด</option>
                      <option value="damaged">สินค้าดูเหมือนมีความเสียหาย</option>
                      <option value="other">อื่นๆ</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>รายละเอียดเพิ่มเติม</label>
                    <textarea className="input-field" rows={3} required value={claimDesc} onChange={e => setClaimDesc(e.target.value)} placeholder="โปรดระบุปัญหาที่คุณพบ..."></textarea>
                  </div>

                  <button type="submit" className="btn-primary" style={{ width: '100%', background: 'var(--error-color)' }}>ส่งรายงานปัญหา</button>
                </form>
              )}
           </div>
        </div>
      )}
      
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
