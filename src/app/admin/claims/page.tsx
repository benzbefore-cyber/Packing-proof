"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AlertTriangle, Clock, PlayCircle, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function AdminClaims() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "claims"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClaims(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleResolveClaim = async (claimId: string) => {
    try {
      const claimRef = doc(db, "claims", claimId);
      await updateDoc(claimRef, { status: "resolved" });
    } catch (error) {
      console.error("Error resolving claim:", error);
      alert("Failed to update claim status.");
    }
  };

  return (
    <ProtectedRoute>
      <div style={{ maxWidth: '1000px' }}>
        <h1 style={{ marginBottom: '2rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle /> Customer Claims & Issues
        </h1>
        
        {loading ? (
          <p>Loading claims...</p>
        ) : claims.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <p>No claims reported yet. Great job!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {claims.map((claim) => (
              <div key={claim.id} className="card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', borderLeft: `4px solid ${claim.status === 'resolved' ? 'var(--success-color)' : 'var(--error-color)'}` }}>
                <div style={{ background: claim.status === 'resolved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: claim.status === 'resolved' ? 'var(--success-color)' : 'var(--error-color)', padding: '1rem', borderRadius: '8px', minWidth: '150px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{claim.issueType.replace('_', ' ')}</p>
                  <p style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>{claim.status === 'pending' ? 'Pending Review' : 'Resolved'}</p>
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>Order: {claim.orderId}</h3>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{claim.createdAt?.toDate().toLocaleString()}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}><strong>Customer:</strong> {claim.customerName} | <strong>Tracking:</strong> {claim.trackingNumber}</p>
                  <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
                    <p>"{claim.description}"</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      <Clock size={16} /> Reported at {claim.videoTimestamp} in video
                    </span>
                    <Link href={`/track/${claim.trackingNumber}`} target="_blank" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
                      <PlayCircle size={16} /> Watch Video
                    </Link>
                    {claim.status === 'pending' && (
                      <button onClick={() => handleResolveClaim(claim.id)} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
                        <CheckCircle size={16} /> Mark as Resolved
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
