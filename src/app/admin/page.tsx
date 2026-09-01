"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, where, Timestamp, doc, updateDoc, writeBatch } from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Package, Video, AlertTriangle, Download, Edit, Printer, XCircle, LayoutDashboard, FileText, Search } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Papa from "papaparse";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalOrdersToday: 0,
    packagesPackedToday: 0,
    lowStockItems: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [editForm, setEditForm] = useState({ customerName: "", phone: "", address: "" });

  // Tab State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'report'>('dashboard');

  // Report State
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportData, setReportData] = useState<any[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Today's Date Boundaries
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Last 7 Days Boundary
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // Fetch Orders
        const qOrders = query(collection(db, "orders"), where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo)));
        const ordersSnap = await getDocs(qOrders);

        // Fetch Packages (Videos)
        const qPackages = query(collection(db, "packages"), where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo)));
        const packagesSnap = await getDocs(qPackages);

        // Fetch Low Stock Products (< 5)
        const qProducts = query(collection(db, "products"), where("stock", "<", 5));
        const productsSnap = await getDocs(qProducts);

        let todayOrders = 0;
        let todayPackages = 0;

        // Process data for Chart (Last 7 Days)
        const chartDataMap: Record<string, any> = {};
        for(let i=6; i>=0; i--) {
           const d = new Date();
           d.setDate(d.getDate() - i);
           const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
           chartDataMap[dateStr] = { name: dateStr, Orders: 0, Packed: 0 };
        }

        ordersSnap.forEach(doc => {
           const date = doc.data().timestamp.toDate();
           const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
           if(chartDataMap[dateStr]) chartDataMap[dateStr].Orders++;
           if (date >= today && date < tomorrow) todayOrders++;
        });

        packagesSnap.forEach(doc => {
           const date = doc.data().timestamp.toDate();
           const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
           if(chartDataMap[dateStr]) chartDataMap[dateStr].Packed++;
           if (date >= today && date < tomorrow) todayPackages++;
        });

        // Fetch all products for inventory chart
        const qAllProducts = query(collection(db, "products"));
        const allProductsSnap = await getDocs(qAllProducts);
        const invData = allProductsSnap.docs.map(d => ({ sku: d.data().sku, stock: d.data().stock }));

        setInventoryData(invData);
        setChartData(Object.values(chartDataMap));
        
        // Process Recent Orders (sort by timestamp desc)
        let ordersList = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        ordersList.sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());
        setRecentOrders(ordersList.slice(0, 50)); // top 50 recent orders

        setStats({
          totalOrdersToday: todayOrders,
          packagesPackedToday: todayPackages,
          lowStockItems: productsSnap.size,
        });

      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleExportOrders = async () => {
    try {
      const qOrders = query(collection(db, "orders")); // simplified for export all
      const snap = await getDocs(qOrders);
      const exportData = snap.docs.map(doc => {
        const data = doc.data();
        return {
          "Order ID": doc.id,
          "Shop Order ID": data.shopOrderId || "-",
          "Customer Name": data.customerName || "-",
          "Tracking Number": data.flashTracking || "-",
          "Status": data.status || "-",
          "Date": data.timestamp ? data.timestamp.toDate().toLocaleString() : "-",
          "Items": data.items?.map((item: any) => `${item.sku} (${item.quantity})`).join(", ") || ""
        };
      });

      const csv = Papa.unparse(exportData);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel UTF-8
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `orders_export_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting orders:", error);
      alert("Failed to export orders.");
    }
  };

  const handleCancelOrder = async (order: any) => {
    if (!confirm(`Are you sure you want to cancel order ${order.shopOrderId || order.id}?\nThis will return the items to stock.`)) return;

    try {
      const batch = writeBatch(db);
      
      // Update order status
      batch.update(doc(db, "orders", order.id), { status: "cancelled" });

      // Return items to stock
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
           if (item.productId) {
             const qProducts = query(collection(db, "products"), where("sku", "==", item.sku));
             const pSnap = await getDocs(qProducts);
             if (!pSnap.empty) {
               const pDoc = pSnap.docs[0];
               const currentStock = pDoc.data().stock;
               batch.update(doc(db, "products", pDoc.id), { stock: currentStock + item.quantity });
             }
           }
        }
      }

      await batch.commit();
      
      // Update UI
      setRecentOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "cancelled" } : o));
      alert("Order cancelled and stock returned successfully.");
    } catch (error) {
      console.error("Cancel Error:", error);
      alert("Failed to cancel order.");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    try {
      await updateDoc(doc(db, "orders", editingOrder.id), {
        customerName: editForm.customerName,
        phone: editForm.phone,
        address: editForm.address
      });
      setRecentOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, ...editForm } : o));
      setEditingOrder(null);
    } catch (error) {
      console.error("Edit Error:", error);
      alert("Failed to update order.");
    }
  };

  const fetchReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      alert("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด");
      return;
    }
    setLoadingReport(true);
    try {
      const start = new Date(reportStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(reportEndDate);
      end.setHours(23, 59, 59, 999);

      const q = query(collection(db, "orders"), where("timestamp", ">=", Timestamp.fromDate(start)), where("timestamp", "<=", Timestamp.fromDate(end)));
      const snap = await getDocs(q);
      const data = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() as any }))
        .filter(d => d.status === "packed");
        
      data.sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());
      setReportData(data);
    } catch (error) {
      console.error("Error fetching report:", error);
      alert("ไม่สามารถโหลดข้อมูลรายงานได้");
    } finally {
      setLoadingReport(false);
    }
  };

  const handleExportReport = () => {
    if (reportData.length === 0) {
      alert("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }
    const exportData = reportData.map(order => {
      const totalItems = order.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
      return {
        "วันที่": order.timestamp?.toDate().toLocaleString('th-TH') || "-",
        "รหัสออเดอร์": order.shopOrderId || "-",
        "Tracking Number": order.flashTracking || "-",
        "พนักงานที่แพ็ค": order.staffName || order.staffEmail || "-",
        "จำนวนสินค้า (ชิ้น)": totalItems,
        "รายการสินค้า": order.items?.map((item: any) => `${item.sku} (${item.quantity})`).join(", ") || ""
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); 
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `packing_report_${reportStartDate}_to_${reportEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ProtectedRoute>
      <div style={{ maxWidth: '1000px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: 'var(--primary-color)' }}>แผงควบคุมธุรกิจ</h1>
          {activeTab === 'dashboard' && (
            <button onClick={handleExportOrders} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
              <Download size={18} /> ส่งออกออเดอร์ทั้งหมด (CSV)
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          <button onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, padding: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
            <LayoutDashboard size={18} /> แดชบอร์ด
          </button>
          <button onClick={() => setActiveTab('report')} className={activeTab === 'report' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, padding: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
            <FileText size={18} /> รายงานการแพ็คสินค้า
          </button>
        </div>
        
        {activeTab === 'dashboard' && (
          loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
               <p style={{ color: 'var(--text-muted)' }}>กำลังโหลดข้อมูล...</p>
            </div>
          ) : (
          <>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '1rem', borderRadius: '50%', color: 'var(--primary-color)' }}>
                  <Package size={32} />
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>ออเดอร์ที่สร้างวันนี้</p>
                  <h2 style={{ fontSize: '2rem' }}>{stats.totalOrdersToday}</h2>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '50%', color: 'var(--success-color)' }}>
                  <Video size={32} />
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>พัสดุที่แพ็ควันนี้</p>
                  <h2 style={{ fontSize: '2rem' }}>{stats.packagesPackedToday}</h2>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', border: stats.lowStockItems > 0 ? '2px solid var(--error-color)' : 'none' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%', color: 'var(--error-color)' }}>
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>สินค้าใกล้หมด</p>
                  <h2 style={{ fontSize: '2rem', color: 'var(--error-color)' }}>{stats.lowStockItems}</h2>
                </div>
              </div>

            </div>

            {/* Performance Chart */}
            <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
               <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>ภาพรวมประสิทธิภาพรายสัปดาห์</h3>
               <div style={{ flex: 1, minHeight: 0 }}>
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                       </linearGradient>
                       <linearGradient id="colorPacked" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                     <YAxis stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                     <Tooltip 
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                       itemStyle={{ fontWeight: 'bold' }}
                     />
                     <Area type="monotone" dataKey="Orders" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorOrders)" />
                     <Area type="monotone" dataKey="Packed" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPacked)" />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
            </div>

            {/* Inventory Stock Chart */}
            {inventoryData.length > 0 && (
              <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column', marginTop: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>ระดับสต๊อกสินค้าปัจจุบัน</h3>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={inventoryData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="sku" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: 'var(--surface-color)' }}
                      />
                      <Bar dataKey="stock" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Recent Orders Table */}
            <div className="card" style={{ marginTop: '2rem' }}>
               <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>ออเดอร์ล่าสุด</h3>
               <div style={{ overflowX: 'auto' }}>
                 <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                   <thead>
                     <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                       <th style={{ padding: '0.75rem' }}>รหัสออเดอร์</th>
                       <th style={{ padding: '0.75rem' }}>ลูกค้า</th>
                       <th style={{ padding: '0.75rem' }}>สถานะ</th>
                       <th style={{ padding: '0.75rem' }}>จัดการ</th>
                     </tr>
                   </thead>
                   <tbody>
                     {recentOrders.map(order => (
                       <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: order.status === 'cancelled' ? 0.5 : 1 }}>
                         <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: 'bold' }}>{order.shopOrderId}</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{order.flashTracking}</div>
                         </td>
                         <td style={{ padding: '0.75rem' }}>
                            <div>{order.customerName}</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{order.phone}</div>
                         </td>
                         <td style={{ padding: '0.75rem' }}>
                            <span style={{ 
                              padding: '0.25rem 0.5rem', 
                              borderRadius: '4px', 
                              fontSize: '0.875rem',
                              background: order.status === 'cancelled' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              color: order.status === 'cancelled' ? 'var(--error-color)' : 'var(--success-color)'
                            }}>
                              {order.status || 'label_created'}
                            </span>
                         </td>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button onClick={() => window.open(`/print/${order.id}`, '_blank')} className="btn-secondary" style={{ padding: '0.5rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }} title="พิมพ์ใบปะหน้า">
                                <Printer size={16} />
                              </button>
                              {order.status !== 'cancelled' && (
                                <>
                                  <button onClick={() => {
                                    setEditingOrder(order);
                                    setEditForm({ customerName: order.customerName, phone: order.phone, address: order.address });
                                  }} className="btn-secondary" style={{ padding: '0.5rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }} title="แก้ไขข้อมูลลูกค้า">
                                    <Edit size={16} />
                                  </button>
                                  <button onClick={() => handleCancelOrder(order)} className="btn-secondary" style={{ padding: '0.5rem', display: 'flex', gap: '0.25rem', alignItems: 'center', color: 'var(--error-color)' }} title="ยกเลิกออเดอร์">
                                    <XCircle size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>

          </>
          )
        )}

        {/* REPORT TAB */}
        {activeTab === 'report' && (
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>รายงานประวัติการแพ็คสินค้า</h3>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginBottom: '2rem' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>ตั้งแต่วันที่</label>
                <input type="date" className="input-field" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>ถึงวันที่</label>
                <input type="date" className="input-field" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} />
              </div>
              <button onClick={fetchReport} className="btn-primary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem 1.5rem' }}>
                <Search size={18} /> ค้นหา
              </button>
            </div>

            {loadingReport ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>กำลังโหลดรายงาน...</div>
            ) : (
              <>
                {reportData.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--surface-color)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>สรุปยอดช่วงเวลาที่เลือก</p>
                      <h3 style={{ margin: 0, color: 'var(--success-color)' }}>แพ็คไปทั้งหมด {reportData.length} ออเดอร์</h3>
                    </div>
                    <button onClick={handleExportReport} className="btn-secondary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <Download size={18} /> ส่งออก (CSV)
                    </button>
                  </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                        <th style={{ padding: '0.75rem' }}>วัน/เวลา</th>
                        <th style={{ padding: '0.75rem' }}>รหัสออเดอร์</th>
                        <th style={{ padding: '0.75rem' }}>พนักงานที่แพ็ค</th>
                        <th style={{ padding: '0.75rem' }}>สินค้า</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map(order => {
                         const totalItems = order.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
                         return (
                          <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{order.timestamp?.toDate().toLocaleString('th-TH')}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ fontWeight: 'bold' }}>{order.shopOrderId}</div>
                              <div style={{ fontSize: '0.875rem', color: 'var(--primary-color)' }}>{order.flashTracking}</div>
                            </td>
                            <td style={{ padding: '0.75rem' }}>{order.staffName || order.staffEmail}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ fontWeight: 'bold' }}>{totalItems} ชิ้น</span>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {order.items?.map((item: any) => `${item.sku} (x${item.quantity})`).join(", ")}
                              </div>
                            </td>
                          </tr>
                         );
                      })}
                      {reportData.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            เลือกวันที่และกดค้นหาเพื่อดูรายงาน
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {editingOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>แก้ไขข้อมูลลูกค้า</h3>
            <div className="form-group">
              <label>ชื่อลูกค้า</label>
              <input type="text" className="input-field" value={editForm.customerName} onChange={e => setEditForm({...editForm, customerName: e.target.value})} />
            </div>
            <div className="form-group">
              <label>เบอร์โทรศัพท์</label>
              <input type="text" className="input-field" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label>ที่อยู่</label>
              <textarea className="input-field" rows={3} value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})}></textarea>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditingOrder(null)}>ยกเลิก</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveEdit}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

    </ProtectedRoute>
  );
}
