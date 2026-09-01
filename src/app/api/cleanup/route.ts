import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { unlink } from "fs/promises";
import { join } from "path";

export async function GET(request: NextRequest) {
  try {
    // 1. Verify Authorization
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // 2. Find packages older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const packagesRef = collection(db, "packages");
    const q = query(packagesRef, where("timestamp", "<", Timestamp.fromDate(thirtyDaysAgo)));
    const snapshot = await getDocs(q);

    let deletedCount = 0;

    for (const document of snapshot.docs) {
      const data = document.data();
      
      // 3. Delete the physical video file if it's stored locally
      if (data.videoUrl && data.videoUrl.startsWith("/uploads/")) {
        try {
          // Extract filename from URL (e.g. /uploads/video.webm -> video.webm)
          const filename = data.videoUrl.split("/uploads/")[1];
          const filepath = join(process.cwd(), "public", "uploads", filename);
          await unlink(filepath);
        } catch (fsError) {
          console.error(`Failed to delete file ${data.videoUrl}:`, fsError);
          // Continue even if file doesn't exist
        }
      }

      // 4. Delete the document from Firestore
      await deleteDoc(doc(db, "packages", document.id));
      deletedCount++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cleanup completed successfully. Deleted ${deletedCount} packages.` 
    });

  } catch (error: any) {
    console.error("Cleanup Error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
