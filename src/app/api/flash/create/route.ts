import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // In a real scenario, you would send this data to Flash Express API
    // e.g., using fetch('https://api-sandbox.flashexpress.com/v1/orders', { ... })
    // and using your Merchant ID and API Key stored in process.env
    
    // For this mock, we'll simulate a 1-second delay and return a fake Flash tracking number
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Generate a mock Flash tracking number (usually starts with TH followed by numbers)
    const randomNumbers = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    const mockTrackingNumber = `TH${randomNumbers}`;
    
    return NextResponse.json({
      success: true,
      message: 'Order created successfully',
      data: {
        trackingNumber: mockTrackingNumber,
        orderInfo: body
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
