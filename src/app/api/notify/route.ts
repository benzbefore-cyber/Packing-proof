import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { trackingNumber, customerName } = await request.json();

    if (!trackingNumber) {
      return NextResponse.json({ success: false, message: "Tracking number required" }, { status: 400 });
    }

    // ==========================================
    // STUB: LINE Notify Integration
    // Replace the token below with a real LINE Notify Token
    // ==========================================
    const LINE_NOTIFY_TOKEN = process.env.LINE_NOTIFY_TOKEN;
    const message = `\n📦 ออเดอร์ของคุณ ${customerName || 'ลูกค้า'} แพ็คเสร็จแล้ว!\n\nดูวิดีโอยืนยันการแพ็คได้ที่:\nhttps://yourdomain.com/track/${trackingNumber}\n\nขอบคุณที่อุดหนุนครับ! 🙏`;

    if (LINE_NOTIFY_TOKEN) {
      // Execute Real LINE API
      const response = await fetch("https://notify-api.line.me/api/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Bearer ${LINE_NOTIFY_TOKEN}`
        },
        body: new URLSearchParams({ message })
      });
      
      if (!response.ok) {
         console.error("Failed to send LINE notification", await response.text());
         return NextResponse.json({ success: false, message: "LINE API Error" }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: "LINE Notification sent successfully" });
    } else {
      // Mock / Dev fallback
      console.log("🔔 [LINE NOTIFY MOCK] Message sent:");
      console.log(message);
      return NextResponse.json({ success: true, message: "Notification sent (Mocked - No Token Found)" });
    }
  } catch (error: any) {
    console.error("Notify API Error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
