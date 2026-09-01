"use client";

import { useState, useRef, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, writeBatch, onSnapshot } from "firebase/firestore";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Camera, LogOut, Video, StopCircle, UploadCloud, CheckCircle2, PackagePlus, ScanBarcode, Printer, Plus, Trash2, ShieldCheck, Search, FileUp, Usb, Archive, User, ClipboardList, CheckCircle, Eye, XCircle, Download } from "lucide-react";
import { signOut } from "firebase/auth";
import Link from "next/link";
import Papa from "papaparse";

export default function StaffPortal() {
  const [activeTab, setActiveTab] = useState<'create' | 'record' | 'inventory' | 'summary'>('create');
  
  // --- Inventory State ---
  const [products, setProducts] = useState<any[]>([]);
  const [inventoryForm, setInventoryForm] = useState({ sku: "", name: "", size: "", color: "", stock: "" });
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // --- Create Order State ---
  const [orderForm, setOrderForm] = useState({ shopOrderId: "", customerName: "", phone: "", address: "", weight: "1.0" });
  const [orderItems, setOrderItems] = useState<any[]>([]); 
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);

  // --- Record Video State ---
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // --- Pick & Pack State ---
  const [orderToPack, setOrderToPack] = useState<any>(null);
  const [scannedItems, setScannedItems] = useState<Record<string, number>>({});
  const [barcodeInput, setBarcodeInput] = useState("");

  // --- Bulk Import State ---
  const [isBulkImporting, setIsBulkImporting] = useState(false);

  // --- Summary State ---
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [selectedSummaryOrder, setSelectedSummaryOrder] = useState<any>(null);
  const [summaryVideoUrl, setSummaryVideoUrl] = useState<string>("");
  const [loadingSummaryVideo, setLoadingSummaryVideo] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [staffName, setStaffName] = useState<string>("");

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, "users", auth.currentUser.uid)).then(d => {
        if (d.exists()) {
          const data = d.data();
          if (data.firstName || data.nickname) {
            setStaffName(`${data.firstName || ""} ${data.lastName || ""} ${data.nickname ? `(${data.nickname})` : ""}`.trim());
          }
        }
      });
    }
  }, []);

  // 1. Fetch Inventory realtime
  useEffect(() => {
    const q = query(collection(db, "products"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(productsData);
    });
    return () => unsubscribe();
  }, []);

  // 2. Initialize camera for 'record' tab
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (activeTab === 'record') {
      const startCamera = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
        }
      };
      startCamera();
    }
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [activeTab]);

  // 3. Fetch Summary when 'summary' tab is active
  useEffect(() => {
    if (activeTab === 'summary') {
      const fetchSummary = async () => {
        setLoadingSummary(true);
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const q = query(collection(db, "orders"), where("timestamp", ">=", today));
          const snap = await getDocs(q);
          const data = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() as any }))
            // Filter locally: Only 'packed' and processed by this staff
            .filter(d => d.status === "packed" && (d.staffId === auth.currentUser?.uid || d.staffEmail === auth.currentUser?.email));
          
          // Sort by newest first
          data.sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());
          setSummaryData(data);
        } catch (error) {
          console.error("Error fetching summary:", error);
        } finally {
          setLoadingSummary(false);
        }
      };
      fetchSummary();
    }
  }, [activeTab]);

  const handleViewSummaryDetails = async (order: any) => {
    setSelectedSummaryOrder(order);
    setSummaryVideoUrl("");
    setLoadingSummaryVideo(true);
    try {
      const q = query(collection(db, "packages"), where("trackingNumber", "==", order.flashTracking));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setSummaryVideoUrl(snap.docs[0].data().videoUrl);
      }
    } catch (error) {
      console.error("Error fetching video:", error);
    } finally {
      setLoadingSummaryVideo(false);
    }
  };

  const handleExportSummary = () => {
    if (summaryData.length === 0) {
      alert("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }
    const exportData = summaryData.map(order => {
      const totalItems = order.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
      return {
        "วันที่/เวลา": order.timestamp?.toDate().toLocaleString('th-TH') || "-",
        "รหัสออเดอร์ร้านค้า": order.shopOrderId || "-",
        "Tracking Number": order.flashTracking || "-",
        "ชื่อลูกค้า": order.customerName || "-",
        "พนักงานที่แพ็ค": order.staffName || order.staffEmail || "-",
        "จำนวนสินค้ารวม (ชิ้น)": totalItems,
        "รายการสินค้า": order.items?.map((item: any) => `${item.sku} (${item.quantity})`).join(", ") || ""
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); 
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `daily_summary_${today}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Hardware: Connect Web Serial Scale ---
  const handleConnectScale = async () => {
    try {
      if (!('serial' in navigator)) {
        throw new Error("Web Serial API not supported in this browser. Please use Google Chrome or Edge.");
      }
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      setSuccessMessage("Scale connected successfully!");
      
      const reader = port.readable.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Continuous read loop
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        // Very basic parsing for common scale output (e.g., lines ending with \r\n or \n)
        if (buffer.includes("\n")) {
           const lines = buffer.split("\n");
           // Take the last complete line
           const weightLine = lines[lines.length - 2]; 
           const parsedWeight = parseFloat(weightLine.replace(/[^\d.]/g, ''));
           if (!isNaN(parsedWeight)) {
             setOrderForm(prev => ({ ...prev, weight: parsedWeight.toFixed(2) }));
           }
           buffer = lines[lines.length - 1]; // Keep remainder
        }
      }
    } catch (error: any) {
      setErrorMessage("Scale error: " + error.message);
    }
  };

  // --- Create Order Handlers ---
  const handleOrderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setOrderForm({ ...orderForm, [e.target.name]: e.target.value });
  };

  const handleAddItemToOrder = () => {
    if (!selectedProductId || selectedQuantity <= 0) return;
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const existing = orderItems.find(item => item.productId === selectedProductId);
    const currentQty = existing ? existing.quantity : 0;
    
    if (currentQty + selectedQuantity > product.stock) {
      setErrorMessage(`Not enough stock for ${product.name}. Available: ${product.stock}`);
      return;
    }

    if (existing) {
      setOrderItems(orderItems.map(item => item.productId === selectedProductId ? { ...item, quantity: item.quantity + selectedQuantity } : item));
    } else {
      setOrderItems([...orderItems, { 
        productId: product.id, sku: product.sku, name: product.name, size: product.size, color: product.color, quantity: selectedQuantity 
      }]);
    }
    setErrorMessage("");
    setSelectedProductId("");
    setSelectedQuantity(1);
  };

  const handleRemoveItem = (productId: string) => {
    setOrderItems(orderItems.filter(item => item.productId !== productId));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      setErrorMessage("Please add at least one item to the order.");
      return;
    }
    
    setIsCreatingOrder(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/flash/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderForm)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      const flashTrackingNumber = data.data.trackingNumber;
      const batch = writeBatch(db);
      const orderRef = doc(collection(db, "orders"));
      
      const orderData = {
        ...orderForm,
        items: orderItems,
        flashTracking: flashTrackingNumber,
        staffId: auth.currentUser?.uid || "unknown",
        staffEmail: auth.currentUser?.email || "unknown",
        staffName: staffName || auth.currentUser?.email || "unknown",
        timestamp: serverTimestamp(),
        status: 'label_created'
      };
      
      batch.set(orderRef, orderData);

      for (const item of orderItems) {
        const productRef = doc(db, "products", item.productId);
        const product = products.find(p => p.id === item.productId);
        if (product) batch.update(productRef, { stock: product.stock - item.quantity });
      }

      await batch.commit();

      setCreatedOrder(orderData);
      setSuccessMessage(`Order created successfully! Tracking: ${flashTrackingNumber}`);
      
      setOrderForm({ shopOrderId: "", customerName: "", phone: "", address: "", weight: "1.0" });
      setOrderItems([]);

      // Auto-Print Label (Feature 3)
      setTimeout(() => window.print(), 500);

    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create order");
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const printLabel = () => window.print();

  // --- Record Video & Pick Pack Handlers ---
  const handleFetchOrderToPack = async () => {
    if (!trackingNumber.trim()) return;
    setErrorMessage("");
    setOrderToPack(null);
    setScannedItems({});
    
    try {
      const ordersRef = collection(db, "orders");
      const q = query(ordersRef, where("flashTracking", "==", trackingNumber.trim()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        const q2 = query(ordersRef, where("shopOrderId", "==", trackingNumber.trim()));
        const snap2 = await getDocs(q2);
        if (snap2.empty) throw new Error("Order not found with this tracking/order ID.");
        setOrderToPack({ id: snap2.docs[0].id, ...snap2.docs[0].data() });
      } else {
        setOrderToPack({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    } catch (error: any) {
      setErrorMessage(error.message);
    }
  };

  const handleScanItemBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToPack || !barcodeInput.trim()) return;
    
    const sku = barcodeInput.trim();
    const itemInOrder = orderToPack.items?.find((i: any) => i.sku === sku);
    
    if (!itemInOrder) {
      setErrorMessage(`❌ Invalid Item! SKU ${sku} is NOT in this order.`);
      setBarcodeInput("");
      return;
    }

    const currentScanned = scannedItems[sku] || 0;
    if (currentScanned >= itemInOrder.quantity) {
      setErrorMessage(`⚠️ Overpack Warning! You have already packed enough of ${sku}.`);
      setBarcodeInput("");
      return;
    }

    setScannedItems(prev => ({ ...prev, [sku]: (prev[sku] || 0) + 1 }));
    setErrorMessage("");
    setSuccessMessage(`✅ Item ${sku} verified.`);
    setBarcodeInput("");
  };

  const isFullyPacked = () => {
    if (!orderToPack || !orderToPack.items) return false;
    for (const item of orderToPack.items) {
      const scanned = scannedItems[item.sku] || 0;
      if (scanned < item.quantity) return false;
    }
    return true;
  };

  const startScanning = () => {
    setIsScanning(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText) => {
        setTrackingNumber(decodedText);
        scanner.clear();
        setIsScanning(false);
      }, () => {});
    }, 100);
  };

  const startRecording = () => {
    if (!isFullyPacked()) {
      setErrorMessage("Please scan all items before recording.");
      return;
    }
    if (!videoRef.current?.srcObject) return;
    setSuccessMessage(""); setErrorMessage(""); setVideoBlob(null); chunksRef.current = [];
    const stream = videoRef.current.srcObject as MediaStream;
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mediaRecorder.onstop = () => setVideoBlob(new Blob(chunksRef.current, { type: 'video/webm' }));
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleUpload = async () => {
    if (!videoBlob || !trackingNumber) return;
    setIsUploading(true); setErrorMessage(""); setSuccessMessage("");
    
    try {
      setUploadProgress(10); 
      const formData = new FormData();
      formData.append("file", videoBlob, `${trackingNumber}.webm`);
      formData.append("trackingNumber", trackingNumber);
      
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      
      setUploadProgress(80);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to upload");

      const downloadURL = data.url;
      await addDoc(collection(db, "packages"), { trackingNumber, videoUrl: downloadURL, staffId: auth.currentUser?.uid, staffEmail: auth.currentUser?.email, staffName: staffName || auth.currentUser?.email || "unknown", timestamp: serverTimestamp() });
      
      if (orderToPack && orderToPack.id) {
        const batch = writeBatch(db);
        batch.update(doc(db, "orders", orderToPack.id), { status: "packed" });
        await batch.commit();
      }

      await fetch("/api/notify", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ trackingNumber, customerName: orderToPack?.customerName })
      });
      
      setIsUploading(false);
      setSuccessMessage("Video uploaded and linked successfully!");
      setTrackingNumber(""); setVideoBlob(null); setUploadProgress(100);
      setOrderToPack(null); setScannedItems({});
    } catch (err: any) {
      setErrorMessage(err.message); setIsUploading(false); setUploadProgress(0);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingProduct(true);
    try {
      await addDoc(collection(db, "products"), {
        ...inventoryForm,
        stock: Number(inventoryForm.stock),
        timestamp: serverTimestamp()
      });
      setSuccessMessage("Product added to inventory.");
      setInventoryForm({ sku: "", name: "", size: "", color: "", stock: "" });
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsAddingProduct(false);
    }
  };

  // --- Bulk CSV Import Handler ---
  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsBulkImporting(true);
    setErrorMessage("");
    setSuccessMessage("");

    Papa.parse(e.target.files[0], {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const batch = writeBatch(db);
          let successCount = 0;
          
          for (const row of results.data as any[]) {
             // CSV Expected Columns: shopOrderId, customerName, phone, address, weight, items (sku:qty|sku:qty)
             if (!row.shopOrderId || !row.customerName || !row.items) continue;

             const itemStrings = row.items.split('|');
             const orderItems = [];

             for (const it of itemStrings) {
               const [sku, qty] = it.split(':');
               const product = products.find(p => p.sku === sku.trim());
               if (!product) throw new Error(`SKU ${sku} not found in inventory.`);
               if (product.stock < Number(qty)) throw new Error(`Not enough stock for SKU ${sku}.`);
               
               orderItems.push({
                 productId: product.id, sku: product.sku, name: product.name, 
                 size: product.size, color: product.color, quantity: Number(qty)
               });

               // Deduct stock in batch
               const productRef = doc(db, "products", product.id);
               batch.update(productRef, { stock: product.stock - Number(qty) });
             }

             // In a real app, you would call Flash API for each order here in bulk.
             // We'll simulate getting a flash tracking number.
             const fakeFlashTracking = "TH" + Math.random().toString().slice(2, 12);
             
             const orderRef = doc(collection(db, "orders"));
             batch.set(orderRef, {
                shopOrderId: row.shopOrderId,
                customerName: row.customerName,
                phone: row.phone,
                address: row.address,
                weight: row.weight || "1.0",
                items: orderItems,
                flashTracking: fakeFlashTracking,
                staffId: auth.currentUser?.uid || "bulk",
                staffEmail: auth.currentUser?.email || "bulk",
                staffName: staffName || auth.currentUser?.email || "bulk",
                timestamp: serverTimestamp(),
                status: 'label_created'
             });

             successCount++;
          }

          await batch.commit();
          setSuccessMessage(`Bulk Import Successful! Created ${successCount} orders.`);
        } catch (error: any) {
          setErrorMessage("Bulk Import Error: " + error.message);
        } finally {
          setIsBulkImporting(false);
          // Reset file input
          e.target.value = '';
        }
      },
      error: (error) => {
        setErrorMessage("CSV Parse Error: " + error.message);
        setIsBulkImporting(false);
      }
    });
  };

  const handleLogout = () => signOut(auth);
  const clearMessages = () => { setSuccessMessage(""); setErrorMessage(""); };

  return (
    <ProtectedRoute>
      <div className="container no-print" style={{ padding: '1rem', maxWidth: '1000px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>แผงควบคุมพนักงาน</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href="/admin" className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>แผงควบคุมแอดมิน</Link>
            <Link href="/profile" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
              <User size={16} /> โปรไฟล์ของฉัน
            </Link>
            <button className="btn-secondary" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
              <LogOut size={16} /> ออกจากระบบ
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          <button onClick={() => { setActiveTab('create'); clearMessages(); }} className={activeTab === 'create' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, padding: '0.5rem' }}>
            <PackagePlus size={18} /> สร้างออเดอร์
          </button>
          <button onClick={() => { setActiveTab('inventory'); clearMessages(); }} className={activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, padding: '0.5rem' }}>
            <Archive size={18} /> คลังสินค้า
          </button>
          <button onClick={() => { setActiveTab('record'); clearMessages(); }} className={activeTab === 'record' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, padding: '0.5rem' }}>
            <ScanBarcode size={18} /> แพ็คและบันทึก
          </button>
          <button onClick={() => { setActiveTab('summary'); clearMessages(); }} className={activeTab === 'summary' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, padding: '0.5rem' }}>
            <ClipboardList size={18} /> สรุปประจำวัน
          </button>
        </div>

        {successMessage && <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={20} /> {successMessage}</div>}
        {errorMessage && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{errorMessage}</div>}

        {/* --- TAB 1: CREATE ORDER --- */}
        {activeTab === 'create' && (
          <div className="card">
            <h3>สร้างออเดอร์จัดส่ง (Flash Express)</h3>
            
            {!createdOrder ? (
              <form onSubmit={handleCreateOrder} style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label>รหัสออเดอร์ร้านค้า (Shop Order ID)</label>
                  <input type="text" name="shopOrderId" className="input-field" value={orderForm.shopOrderId} onChange={handleOrderChange} required />
                </div>
                
                <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>รายการสินค้าที่ต้องแพ็ค</h4>
                  {orderItems.length > 0 ? (
                    <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1rem' }}>
                      {orderItems.map((item, idx) => (
                        <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--surface-color)', borderRadius: '4px', marginBottom: '0.5rem' }}>
                          <span>{item.name} ({item.size}, {item.color}) - SKU: {item.sku}</span>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <strong>x{item.quantity}</strong>
                            <button type="button" onClick={() => handleRemoveItem(item.productId)} style={{ color: 'var(--error-color)', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>ยังไม่มีสินค้าในรายการ</p>}

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select className="input-field" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} style={{ flex: 2 }}>
                      <option value="">-- เลือกสินค้า --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                          {p.name} ({p.size}, {p.color}) - Stock: {p.stock}
                        </option>
                      ))}
                    </select>
                    <input type="number" min="1" className="input-field" value={selectedQuantity} onChange={(e) => setSelectedQuantity(Number(e.target.value))} style={{ flex: 1 }} />
                    <button type="button" onClick={handleAddItemToOrder} className="btn-secondary" style={{ display: 'flex', alignItems: 'center' }}><Plus size={16}/> Add</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="form-group" style={{ flex: 1 }}><label>ชื่อลูกค้า</label><input type="text" name="customerName" className="input-field" value={orderForm.customerName} onChange={handleOrderChange} required /></div>
                  <div className="form-group" style={{ flex: 1 }}><label>เบอร์โทรศัพท์</label><input type="tel" name="phone" className="input-field" value={orderForm.phone} onChange={handleOrderChange} required /></div>
                </div>
                <div className="form-group"><label>ที่อยู่</label><textarea name="address" className="input-field" value={orderForm.address} onChange={handleOrderChange} required rows={2} /></div>
                
                <div className="form-group">
                  <label>น้ำหนัก (กก.)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="number" step="0.1" name="weight" className="input-field" value={orderForm.weight} onChange={handleOrderChange} required style={{ flex: 1 }} />
                    <button type="button" onClick={handleConnectScale} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Usb size={16}/> เชื่อมต่อเครื่องชั่ง</button>
                  </div>
                </div>
                
                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={isCreatingOrder}>
                  {isCreatingOrder ? "กำลังสร้างออเดอร์..." : "สร้างออเดอร์และพิมพ์ใบปะหน้า"}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed var(--border-color)', borderRadius: '8px' }}>
                <h2 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>{createdOrder.flashTracking}</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>รหัสออเดอร์: {createdOrder.shopOrderId}</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button className="btn-primary" onClick={printLabel}><Printer size={20} /> พิมพ์ใบปะหน้า</button>
                  <button className="btn-secondary" onClick={() => {setCreatedOrder(null); clearMessages();}}>สร้างออเดอร์ใหม่</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- TAB: INVENTORY & BULK IMPORT --- */}
        {activeTab === 'inventory' && (
           <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>การจัดการคลังสินค้า</h3>
                <div>
                  <input type="file" accept=".csv" onChange={handleBulkImport} style={{ display: 'none' }} id="csv-upload" disabled={isBulkImporting} />
                  <label htmlFor="csv-upload" className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                    <FileUp size={16} /> {isBulkImporting ? "กำลังดำเนินการ..." : "นำเข้าออเดอร์ (CSV)"}
                  </label>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start' }}>
                
                {/* Left Side: Current Stock */}
                <div style={{ flex: '1 1 500px', minWidth: 0 }}>
                  <h4>จำนวนสินค้าคงเหลือ</h4>
                  <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                          <th style={{ padding: '0.5rem' }}>SKU</th>
                          <th style={{ padding: '0.5rem' }}>ชื่อสินค้า</th>
                          <th style={{ padding: '0.5rem' }}>ขนาด/สี</th>
                          <th style={{ padding: '0.5rem' }}>จำนวนเหลือ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem 0.5rem' }}>{p.sku}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>{p.name}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>{p.size} / {p.color}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ fontWeight: 'bold', color: p.stock < 5 ? 'var(--error-color)' : 'var(--text-main)' }}>{p.stock}</span>
                            </td>
                          </tr>
                        ))}
                        {products.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>ไม่พบสินค้า</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Side: Add Product Form */}
                <div style={{ flex: '0 0 350px', background: 'var(--bg-color)', padding: '1.5rem', borderRadius: '8px', width: '100%' }}>
                  <h4 style={{ marginBottom: '1.5rem' }}>เพิ่มสินค้าใหม่</h4>
                  <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group"><label>SKU</label><input type="text" className="input-field" value={inventoryForm.sku} onChange={(e) => setInventoryForm({...inventoryForm, sku: e.target.value})} required /></div>
                    <div className="form-group"><label>ชื่อสินค้า</label><input type="text" className="input-field" value={inventoryForm.name} onChange={(e) => setInventoryForm({...inventoryForm, name: e.target.value})} required /></div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div className="form-group" style={{ flex: 1 }}><label>ขนาด</label><input type="text" className="input-field" value={inventoryForm.size} onChange={(e) => setInventoryForm({...inventoryForm, size: e.target.value})} placeholder="เช่น S, M, L" required /></div>
                      <div className="form-group" style={{ flex: 1 }}><label>สี</label><input type="text" className="input-field" value={inventoryForm.color} onChange={(e) => setInventoryForm({...inventoryForm, color: e.target.value})} placeholder="เช่น แดง, ดำ" required /></div>
                    </div>
                    <div className="form-group"><label>จำนวนเริ่มต้น</label><input type="number" className="input-field" value={inventoryForm.stock} onChange={(e) => setInventoryForm({...inventoryForm, stock: e.target.value})} required /></div>
                    <button type="submit" className="btn-secondary" disabled={isAddingProduct} style={{ width: '100%', marginTop: '0.5rem' }}>เพิ่มสินค้า</button>
                  </form>
                </div>

              </div>
           </div>
        )}

        {/* --- TAB: PICK & RECORD VIDEO --- */}
        {activeTab === 'record' && (
          <>
             <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3>1. ค้นหาออเดอร์</h3>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <input type="text" className="input-field" placeholder="สแกน Tracking Number หรือรหัสออเดอร์ร้านค้า..." value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFetchOrderToPack()} />
                <button className="btn-primary" onClick={handleFetchOrderToPack}><Search size={20}/></button>
                <button className="btn-secondary" onClick={startScanning} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Camera size={20} /> เปิดกล้องสแกน</button>
              </div>
              {isScanning && (
                <div style={{ marginTop: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <div id="reader" style={{ width: '100%' }}></div>
                  <button className="btn-secondary" onClick={() => setIsScanning(false)} style={{ width: '100%', borderRadius: 0, borderTop: '1px solid var(--border-color)' }}>ยกเลิก</button>
                </div>
              )}
            </div>

            {orderToPack && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3>2. ตรวจสอบและแพ็คสินค้า</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>สแกนบาร์โค้ด SKU ของสินค้าแต่ละชิ้นก่อนใส่ลงในกล่องพัสดุ</p>
                
                <form onSubmit={handleScanItemBarcode} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                   <input type="text" className="input-field" placeholder="สแกนบาร์โค้ดสินค้า (SKU)..." value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} autoFocus />
                   <button type="submit" className="btn-secondary">ยืนยันสินค้า</button>
                </form>

                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {orderToPack.items?.map((item: any, idx: number) => {
                    const scanned = scannedItems[item.sku] || 0;
                    const isComplete = scanned >= item.quantity;
                    return (
                      <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: isComplete ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-color)', border: `1px solid ${isComplete ? 'var(--success-color)' : 'var(--border-color)'}`, borderRadius: '8px', marginBottom: '0.5rem', alignItems: 'center' }}>
                        <div>
                          <strong style={{ display: 'block' }}>{item.sku}</strong>
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{item.name} ({item.size}, {item.color})</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '1.25rem', color: isComplete ? 'var(--success-color)' : 'var(--error-color)' }}>
                            {scanned} / {item.quantity}
                          </span>
                          {isComplete && <ShieldCheck color="var(--success-color)" />}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <div className="card" style={{ marginBottom: '1.5rem', opacity: orderToPack ? 1 : 0.5, pointerEvents: orderToPack ? 'auto' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>3. บันทึกวิดีโอการแพ็ค</h3>
                {isRecording && <span style={{ color: 'var(--error-color)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--error-color)', animation: 'pulse 1.5s infinite' }}></div> กำลังบันทึก...</span>}
              </div>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}></video>
                {orderToPack && !isFullyPacked() && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column', gap: '1rem' }}>
                     <ShieldCheck size={48} color="var(--error-color)" />
                     <p>กรุณาสแกนสินค้าให้ครบทุกชิ้นก่อนเริ่มบันทึกวิดีโอ</p>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                {!isRecording ? <button className="btn-primary" onClick={startRecording} disabled={!isFullyPacked()} style={{ background: isFullyPacked() ? 'var(--success-color)' : 'gray' }}><Video size={20} /> เริ่มบันทึก</button> : <button className="btn-danger" onClick={stopRecording}><StopCircle size={20} /> หยุดบันทึก</button>}
              </div>
            </div>

            <div className="card" style={{ opacity: orderToPack ? 1 : 0.5, pointerEvents: orderToPack ? 'auto' : 'none' }}>
              <h3>4. อัปโหลดและเชื่อมโยงข้อมูล</h3>
              <div style={{ marginTop: '1rem' }}>
                <p style={{ marginBottom: '0.5rem' }}><strong>หมายเลขพัสดุ/ออเดอร์:</strong> {trackingNumber || <span style={{ color: 'var(--text-muted)' }}>ยังไม่ระบุ</span>}</p>
                <p style={{ marginBottom: '1rem' }}><strong>วิดีโอ:</strong> {videoBlob ? <span style={{ color: 'var(--success-color)' }}>พร้อมอัปโหลด ({(videoBlob.size / 1024 / 1024).toFixed(2)} MB)</span> : <span style={{ color: 'var(--text-muted)' }}>ยังไม่ได้บันทึก</span>}</p>
                
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div style={{ width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '4px', height: '8px', marginBottom: '1rem' }}><div style={{ width: `${uploadProgress}%`, backgroundColor: 'var(--primary-color)', height: '100%', borderRadius: '4px', transition: 'width 0.2s' }}></div></div>
                )}
                <button className="btn-primary" onClick={handleUpload} disabled={isUploading || !videoBlob || !trackingNumber} style={{ width: '100%' }}><UploadCloud size={20} /> {isUploading ? `กำลังอัปโหลด... ${Math.round(uploadProgress)}%` : 'อัปโหลดและบันทึกข้อมูล'}</button>
              </div>
            </div>
          </>
        )}

        {/* --- TAB: DAILY SUMMARY --- */}
        {activeTab === 'summary' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle color="var(--success-color)" /> สรุปผลงานวันนี้
              </h3>
              <button onClick={handleExportSummary} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }} disabled={loadingSummary || summaryData.length === 0}>
                <Download size={18} /> ส่งออกเป็น CSV
              </button>
            </div>
            
            {loadingSummary ? (
               <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>กำลังโหลดข้อมูล...</div>
            ) : (
               <>
                 <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                   <div style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '8px', flex: 1, textAlign: 'center', border: '1px solid var(--border-color)' }}>
                     <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>จำนวนพัสดุที่แพ็คแล้ววันนี้</p>
                     <h2 style={{ fontSize: '2.5rem', color: 'var(--success-color)' }}>{summaryData.length}</h2>
                   </div>
                 </div>

                 <h4 style={{ marginBottom: '1rem' }}>รายการที่แพ็คสำเร็จ</h4>
                 <div style={{ overflowX: 'auto' }}>
                   <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                     <thead>
                       <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                         <th style={{ padding: '0.75rem' }}>หมายเลขติดตามพัสดุ</th>
                         <th style={{ padding: '0.75rem' }}>รหัสออเดอร์ร้านค้า</th>
                         <th style={{ padding: '0.75rem' }}>เวลาที่แพ็ค</th>
                         <th style={{ padding: '0.75rem' }}>จำนวนสินค้า (ชิ้น)</th>
                         <th style={{ padding: '0.75rem', textAlign: 'center' }}>รายละเอียด</th>
                       </tr>
                     </thead>
                     <tbody>
                       {summaryData.map(order => {
                         const totalItems = order.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
                         return (
                           <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => handleViewSummaryDetails(order)}>
                             <td style={{ padding: '0.75rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{order.flashTracking}</td>
                             <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{order.shopOrderId}</td>
                             <td style={{ padding: '0.75rem' }}>{order.timestamp?.toDate().toLocaleTimeString('th-TH')}</td>
                             <td style={{ padding: '0.75rem' }}>{totalItems}</td>
                             <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                               <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                                 <Eye size={16} /> ดู
                               </button>
                             </td>
                           </tr>
                         )
                       })}
                       {summaryData.length === 0 && (
                         <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>ยังไม่มีประวัติการแพ็คสินค้าในวันนี้</td></tr>
                       )}
                     </tbody>
                   </table>
                 </div>
               </>
            )}
          </div>
        )}
      </div>

      {/* Summary Details Modal */}
      {selectedSummaryOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>รายละเอียดออเดอร์</h3>
              <button onClick={() => setSelectedSummaryOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><XCircle size={24} /></button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ marginBottom: '0.5rem' }}><strong>รหัสออเดอร์ร้านค้า:</strong> {selectedSummaryOrder.shopOrderId}</p>
              <p style={{ marginBottom: '0.5rem' }}><strong>Tracking Number:</strong> <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{selectedSummaryOrder.flashTracking}</span></p>
              <p><strong>ชื่อลูกค้า:</strong> {selectedSummaryOrder.customerName}</p>
            </div>

            <h4 style={{ marginBottom: '0.5rem' }}>รายการสินค้าในกล่อง</h4>
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem' }}>
              {selectedSummaryOrder.items?.map((item: any, idx: number) => (
                <li key={idx} style={{ padding: '0.75rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '4px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', display: 'block' }}>{item.sku}</span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{item.name} ({item.size}, {item.color})</span>
                  </div>
                  <strong style={{ fontSize: '1.25rem' }}>x{item.quantity}</strong>
                </li>
              ))}
            </ul>

            <h4 style={{ marginBottom: '0.5rem' }}>วิดีโอบันทึกการแพ็ค</h4>
            {loadingSummaryVideo ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: '#000', borderRadius: '8px' }}>กำลังโหลดวิดีโอ...</div>
            ) : summaryVideoUrl ? (
              <video src={summaryVideoUrl} controls style={{ width: '100%', borderRadius: '8px', backgroundColor: '#000' }}></video>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--error-color)', background: '#000', borderRadius: '8px' }}>ไม่พบวิดีโอการแพ็คของออเดอร์นี้</div>
            )}
          </div>
        </div>
      )}

      {/* Printable Label */}
      {createdOrder && (
         <div className="print-only">
           <div style={{ border: '2px solid #000', padding: '20px', width: '100mm', margin: '0 auto', fontFamily: 'sans-serif' }}>
             <h1 style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', fontSize: '24px' }}>FLASH EXPRESS</h1>
             
             <div style={{ margin: '15px 0', textAlign: 'center' }}>
               <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{createdOrder.flashTracking}</div>
               <div style={{ height: '40px', background: 'repeating-linear-gradient(90deg, #000, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 8px, #fff 8px, #fff 10px, #000 10px, #000 14px, #fff 14px, #fff 18px)', marginTop: '5px' }}></div>
             </div>
 
             <div style={{ borderTop: '2px dashed #000', paddingTop: '10px', fontSize: '14px' }}>
               <p><strong>To:</strong> {createdOrder.customerName} ({createdOrder.phone})</p>
               <p><strong>Address:</strong> {createdOrder.address}</p>
               <p style={{ marginTop: '5px' }}><strong>Order:</strong> {createdOrder.shopOrderId} | <strong>Weight:</strong> {createdOrder.weight} kg</p>
             </div>
             
             <div style={{ borderTop: '2px solid #000', marginTop: '15px', paddingTop: '10px' }}>
               <h4 style={{ margin: '0 0 5px 0', fontSize: '16px', textAlign: 'center' }}>-- PACKING LIST --</h4>
               <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                 <thead>
                   <tr style={{ borderBottom: '1px solid #ccc' }}>
                     <th style={{ textAlign: 'left', padding: '2px 0' }}>Item (SKU)</th>
                     <th style={{ textAlign: 'center', padding: '2px 0' }}>Var</th>
                     <th style={{ textAlign: 'right', padding: '2px 0' }}>Qty</th>
                   </tr>
                 </thead>
                 <tbody>
                   {createdOrder.items?.map((item: any, i: number) => (
                     <tr key={i} style={{ borderBottom: '1px dashed #eee' }}>
                       <td style={{ padding: '4px 0' }}>{item.sku}</td>
                       <td style={{ textAlign: 'center', padding: '4px 0' }}>{item.size},{item.color}</td>
                       <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 'bold', fontSize: '14px' }}>x{item.quantity}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
 
           </div>
         </div>
       )}

      <style>{`
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .print-only { display: none; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block; }
          body { background-color: white !important; margin: 0; padding: 0; }
          @page { margin: 0; size: 100mm 150mm; } 
        }
      `}</style>
    </ProtectedRoute>
  );
}
