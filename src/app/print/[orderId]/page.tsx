"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function PrintLabel() {
  const params = useParams();
  const orderId = params.orderId as string;
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (!orderId) return;

    getDoc(doc(db, "orders", orderId)).then(d => {
      if (d.exists()) {
        setOrder({ id: d.id, ...d.data() });
        // Give time for render, then print
        setTimeout(() => {
          window.print();
        }, 500);
      }
    });
  }, [orderId]);

  if (!order) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading print data...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: 'auto', background: 'white', color: 'black', fontFamily: 'sans-serif' }}>
      <div style={{ border: '2px solid black', padding: '1.5rem', borderRadius: '8px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '2px solid black', paddingBottom: '0.5rem' }}>PACKING PROOF - SHIPPING LABEL</h1>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <strong>Tracking No:</strong>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{order.flashTracking}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong>Shop Order ID:</strong>
            <div>{order.shopOrderId}</div>
          </div>
        </div>

        <div style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Ship To:</h3>
          <p style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>{order.customerName}</p>
          <p style={{ margin: '0 0 0.5rem 0' }}>{order.phone}</p>
          <p style={{ margin: '0' }}>{order.address}</p>
        </div>

        <div>
          <strong>Items:</strong>
          <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
            {order.items?.map((item: any, idx: number) => (
              <li key={idx} style={{ marginBottom: '0.25rem' }}>
                {item.name} ({item.size}, {item.color}) - <span style={{ fontWeight: 'bold' }}>Qty: {item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem' }}>
          * Scan Tracking Number or Order ID to record packing video *
        </div>
      </div>
      
      {/* Hide this button when printing using CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
      <button className="no-print" onClick={() => window.print()} style={{ marginTop: '2rem', padding: '0.75rem 1.5rem', background: 'blue', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        Print Again
      </button>
    </div>
  );
}
