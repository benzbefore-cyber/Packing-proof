"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { Users, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      const usersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole.toUpperCase()}?`)) return;
    
    setUpdating(userId);
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      setSuccessMsg("User role updated successfully.");
      await fetchUsers();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Failed to update role:", err);
      alert("Failed to update role.");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <div>Loading users...</div>;

  return (
    <div className="container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Users size={32} color="var(--primary-color)" />
        <h1 style={{ color: 'var(--primary-color)' }}>User Management</h1>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={20} /> {successMsg}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-color)' }}>
              <th style={{ padding: '1rem' }}>Email</th>
              <th style={{ padding: '1rem' }}>Current Role</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Actions (Change Role)</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{u.email}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    background: u.role === 'admin' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                    color: u.role === 'admin' ? 'var(--primary-color)' : 'var(--success-color)', 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '999px', 
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    fontSize: '0.75rem'
                  }}>
                    {u.role || 'staff'}
                  </span>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <select 
                    disabled={updating === u.id}
                    value={u.role || 'staff'} 
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    style={{ 
                      padding: '0.5rem', 
                      borderRadius: '8px', 
                      border: '1px solid var(--border-color)',
                      background: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No users found in database. Users appear here when they log in.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
