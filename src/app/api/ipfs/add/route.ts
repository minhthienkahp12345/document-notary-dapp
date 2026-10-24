import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Không tìm thấy tập tin cần tải lên.' },
        { status: 400 }
      );
    }

    const ipfsFormData = new FormData();
    ipfsFormData.append('file', file, file.name);

    const ipfsUrl =
      process.env.NEXT_PUBLIC_IPFS_RPC_URL ||
      'http://127.0.0.1:5001/api/v0';
    const response = await fetch(`${ipfsUrl}/add`, {
      method: 'POST',
      body: ipfsFormData,
    });
    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: `IPFS trả về HTTP ${response.status}: ${responseText}` },
        { status: 502 }
      );
    }

    const result = JSON.parse(responseText);
    return NextResponse.json({ cid: result.Hash });
  } catch (error) {
    console.error('Lỗi API upload IPFS:', error);
    const message = error instanceof Error ? error.message : 'Lỗi không xác định.';

    return NextResponse.json(
      { error: `Không thể kết nối IPFS: ${message}` },
      { status: 502 }
    );
  }
}
