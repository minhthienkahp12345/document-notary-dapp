/**
 * Tính mã băm SHA-256 của File nguyên bản ngay tại Client RAM
 * @param file Tập tin do người dùng nạp vào
 * @returns Chuỗi Hex định dạng bytes32 (0x...) để gửi lên Smart Contract
 */
export async function calculateSHA256(file: File): Promise<`0x${string}`> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexString = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return `0x${hexString}`;
}

/**
 * Tải tập tin gốc lên hệ thống IPFS
 * @param file Tập tin cần lưu trữ
 * @returns IPFS Content Identifier (CID)
 */
export async function uploadToIPFS(file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', file, file.name);

    const response = await fetch('/api/ipfs/add', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    if (!response.ok || !result.cid) {
      throw new Error(result.error || `IPFS trả về HTTP ${response.status}.`);
    }

    return result.cid;
  } catch (error) {
    console.error('Lỗi khi tải tập tin lên IPFS:', error);
    const message = error instanceof Error ? error.message : '';
    if (message.includes('403') || message.toLowerCase().includes('forbidden')) {
      throw new Error(
        'IPFS từ chối yêu cầu (403). Hãy bật CORS cho http://localhost:3000 trên IPFS rồi khởi động lại IPFS.'
      );
    }
    throw new Error(
      `Không thể kết nối IPFS. Hãy kiểm tra IPFS đang chạy tại http://127.0.0.1:5001. ${message}`
    );
  }
}