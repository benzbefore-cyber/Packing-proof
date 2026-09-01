import Link from "next/link";
import { LogOut, LayoutDashboard, Boxes, Search, AlertTriangle, ArrowRight, Users } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAdmin={true}>
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
      {/* Sidebar */}
      <aside style={{ width: '250px', backgroundColor: 'white', borderRight: '1px solid var(--border-color)', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ color: 'var(--primary-color)', marginBottom: '2rem', fontSize: '1.5rem' }}>Admin Panel</h2>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-main)', textDecoration: 'none', fontWeight: '500' }}>
            <LayoutDashboard size={20} /> Dashboard
          </Link>
          <Link href="/admin/inventory" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-color)', textDecoration: 'none' }}>
            <Boxes size={20} /> Inventory
          </Link>
          <Link href="/admin/users" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-color)', textDecoration: 'none' }}>
            <Users size={20} /> Users & Roles
          </Link>
          <Link href="/admin/claims" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-color)', textDecoration: 'none' }}>
            <AlertTriangle size={20} /> Claims & Issues
          </Link>
          <Link href="/staff" className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px', textDecoration: 'none', marginTop: 'auto', fontWeight: 'bold' }}>
            Go to Staff Portal <ArrowRight size={18} />
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
    </ProtectedRoute>
  );
}
