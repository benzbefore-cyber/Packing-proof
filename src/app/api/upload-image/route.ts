import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, message: "Missing file" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Make sure public/uploads/products exists
    const uploadDir = join(process.cwd(), "public", "uploads", "products");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Preserve original extension if possible
    const extension = file.name.split('.').pop() || "png";
    const filename = `product-${Date.now()}.${extension}`;
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    // Return the public URL
    const fileUrl = `/uploads/products/${filename}`;
    
    return NextResponse.json({ success: true, url: fileUrl });
  } catch (err: any) {
    console.error("Upload Image Error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
