"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, onSnapshot } from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Download } from "lucide-react";
import Papa from "papaparse";

export default function AdminInventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [inventoryForm, setInventoryForm] = useState({ sku: "", name: "", size: "", color: "", stock: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const q = query(collection(db, "products"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(productsData);
    });
    return () => unsubscribe();
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingProduct(true);
    setErrorMessage("");
    try {
      let imageUrl = null;
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        const res = await fetch("/api/upload-image", { method: "POST", body: formData });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || "Failed to upload image.");
        imageUrl = data.url;
      }

      await addDoc(collection(db, "products"), {
        ...inventoryForm,
        stock: Number(inventoryForm.stock),
        imageUrl,
        timestamp: serverTimestamp()
      });
      setSuccessMessage("Product added to inventory.");
      setInventoryForm({ sku: "", name: "", size: "", color: "", stock: "" });
      setImageFile(null);
      
      const fileInput = document.getElementById("productImageInput") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleExportInventory = () => {
    try {
      const exportData = products.map(p => ({
        "SKU": p.sku,
        "Name": p.name,
        "Size": p.size,
        "Color": p.color,
        "Current Stock": p.stock,
      }));

      const csv = Papa.unparse(exportData);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `inventory_export_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting inventory:", error);
      alert("Failed to export inventory.");
    }
  };

  return (
    <ProtectedRoute>
      <div style={{ maxWidth: '1000px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: 'var(--primary-color)' }}>Inventory Management</h1>
          <button onClick={handleExportInventory} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
            <Download size={18} /> Export Inventory (CSV)
          </button>
        </div>
        
        {successMessage && <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{successMessage}</div>}
        {errorMessage && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{errorMessage}</div>}

        <div className="card">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start' }}>
            
            {/* Left Side: Current Stock */}
            <div style={{ flex: '1 1 500px', minWidth: 0 }}>
              <h3>Current Stock</h3>
              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '0.5rem', width: '50px' }}>Image</th>
                      <th style={{ padding: '0.5rem' }}>SKU</th>
                      <th style={{ padding: '0.5rem' }}>Name</th>
                      <th style={{ padding: '0.5rem' }}>Size/Color</th>
                      <th style={{ padding: '0.5rem' }}>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                          ) : (
                            <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--border-color)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>No Img</div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{p.sku}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{p.name}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{p.size} / {p.color}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ fontWeight: 'bold', color: p.stock < 5 ? 'var(--error-color)' : 'var(--text-main)' }}>{p.stock}</span>
                        </td>
                      </tr>
                    ))}
                    {products.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>No products found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Side: Add Product Form */}
            <div style={{ flex: '0 0 350px', background: 'var(--bg-color)', padding: '1.5rem', borderRadius: '8px', width: '100%' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>Add New Product</h3>
              <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group"><label>SKU</label><input type="text" className="input-field" value={inventoryForm.sku} onChange={(e) => setInventoryForm({...inventoryForm, sku: e.target.value})} required /></div>
                <div className="form-group"><label>Product Name</label><input type="text" className="input-field" value={inventoryForm.name} onChange={(e) => setInventoryForm({...inventoryForm, name: e.target.value})} required /></div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="form-group" style={{ flex: 1 }}><label>Size</label><input type="text" className="input-field" value={inventoryForm.size} onChange={(e) => setInventoryForm({...inventoryForm, size: e.target.value})} placeholder="e.g. S, M, L" required /></div>
                  <div className="form-group" style={{ flex: 1 }}><label>Color</label><input type="text" className="input-field" value={inventoryForm.color} onChange={(e) => setInventoryForm({...inventoryForm, color: e.target.value})} placeholder="e.g. Red, Black" required /></div>
                </div>
                <div className="form-group"><label>Initial Stock</label><input type="number" className="input-field" value={inventoryForm.stock} onChange={(e) => setInventoryForm({...inventoryForm, stock: e.target.value})} required /></div>
                
                <div className="form-group">
                  <label>Product Image (Optional)</label>
                  <input type="file" id="productImageInput" accept="image/*" onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)} style={{ padding: '0.5rem', display: 'block', width: '100%', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                </div>

                <button type="submit" className="btn-primary" disabled={isAddingProduct} style={{ width: '100%', marginTop: '0.5rem' }}>Add Product</button>
              </form>
            </div>

          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
