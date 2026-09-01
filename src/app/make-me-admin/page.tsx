"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function MakeMeAdmin() {
  const { user } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    const promote = async () => {
      if (!user) {
        setStatus("Please log in first.");
        return;
      }
      try {
        await setDoc(doc(db, "users", user.uid), { role: "admin", email: user.email }, { merge: true });
        setStatus("Success! You are now an admin. Redirecting to admin panel...");
        setTimeout(() => {
          router.push("/admin");
        }, 2000);
      } catch (e: any) {
        setStatus("Error: " + e.message);
      }
    };
    promote();
  }, [user, router]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Admin Promotion</h1>
      <p>{status}</p>
    </div>
  );
}
