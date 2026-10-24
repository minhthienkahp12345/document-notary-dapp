import { create } from 'kubo-rpc-client';

// Khởi tạo IPFS Client kết nối tới node IPFS RPC local hoặc RPC Gateway
const ipfsClient = create({
  url: process.env.NEXT_PUBLIC_IPFS_RPC_URL || 'http://127.0.0.1:5001/api/v0',
});

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
    const arrayBuffer = await file.arrayBuffer();
    const content = new Uint8Array(arrayBuffer);

    const result = await ipfsClient.add(content);
    return result.cid.toString();
  } catch (error) {
    console.error('Lỗi khi tải tập tin lên IPFS:', error);
    throw new Error('Không thể tải tập tin lên mạng IPFS.');
  }
}