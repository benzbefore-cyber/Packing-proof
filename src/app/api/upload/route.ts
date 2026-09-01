import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;
    const trackingNumber = data.get("trackingNumber");

    if (!file || !trackingNumber) {
      return NextResponse.json({ success: false, message: "Missing file or tracking number" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Make sure public/uploads exists
    const uploadDir = join(process.cwd(), "public", "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save with a unique filename
    const filename = `${trackingNumber}-${Date.now()}.webm`;
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    // Return the public URL
    const fileUrl = `/uploads/${filename}`;
    
    return NextResponse.json({ success: true, url: fileUrl });
  } catch (err: any) {
    console.error("Upload Error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
