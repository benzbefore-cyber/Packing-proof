"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (loading) return;
      
      if (!user) {
        router.push("/login");
        return;
      }

      if (requireAdmin) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAuthorized(true);
          } else {
            console.warn("Access denied. User is not an admin.");
            router.push("/staff"); // Redirect non-admins to staff portal
          }
        } catch (error) {
          console.error("Error checking role:", error);
          router.push("/staff");
        }
      } else {
        setIsAuthorized(true);
      }
      setCheckingRole(false);
    };

    checkAccess();
  }, [user, loading, router, requireAdmin]);

  if (loading || checkingRole) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 size={48} color="var(--primary-color)" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
