'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { calculateSHA256, uploadToIPFS } from '@/lib/cryptoAndIpfs';
import { useWriteContract, useReadContract, useAccount } from 'wagmi';
import { DocumentNotaryABI } from '@/config/abi';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

export default function FileNotaryDropzone() {
  const { address, isConnected } = useAccount();
  const [file, setFile] = useState<File | null>(null);
  const [docHash, setDocHash] = useState<`0x${string}` | null>(null);
  const [ipfsCid, setIpfsCid] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Hook đọc thông tin kiểm tra On-chain từ Smart Contract (Free Gas Read)
  const { data: verifyData, refetch: checkVerification } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: DocumentNotaryABI,
    functionName: 'verifyDocument',
    args: docHash ? [docHash] : undefined,
    query: { enabled: !!docHash },
  });

  // Hook ghi giao dịch On-chain
  const { writeContractAsync } = useWriteContract();

  // Xử lý khi người dùng thả file vào vùng Drag & Drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    setIsLoading(true);
    setStatus('Đang tính toán mã băm SHA-256 tại trình duyệt...');

    try {
      // 1. Băm SHA-256
      const hash = await calculateSHA256(selectedFile);
      setDocHash(hash);
      setStatus('Đã tính xong SHA-256! Kiểm tra trạng thái trên Blockchain...');

      // Re-trigger tra cứu contract
      await checkVerification();
    } catch (err) {
      setStatus('Có lỗi xảy ra khi xử lý file.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [checkVerification]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  // Thực hiện công chứng tài liệu mới
  const handleNotarize = async () => {
    if (!file || !docHash || !isConnected) return;
    try {
      setIsLoading(true);
      setStatus('1/2. Đang tải tập tin lên IPFS...');
      const cid = await uploadToIPFS(file);
      setIpfsCid(cid);

      setStatus('2/2. Yêu cầu ký giao dịch công chứng On-chain via MetaMask...');
      const tx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: DocumentNotaryABI,
        functionName: 'notarizeDocument',
        args: [docHash, cid],
      });

      setStatus(`Thành công! Mã giao dịch (TxHash): ${tx}`);
    } catch (error: any) {
      setStatus(`Lỗi: ${error?.shortMessage || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Xác thực & Công chứng Tài liệu Số
      </h2>

      {/* Vùng Drag and Drop UI */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
        }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            📄 Đã chọn: {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </p>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            Kéo & thả tập tin vào đây, hoặc click để chọn tập tin từ máy tính
          </p>
        )}
      </div>

      {/* Thông tin Mã băm & Kết quả On-chain */}
      {docHash && (
        <div className="mt-6 space-y-3 text-sm">
          <div className="p-3 bg-gray-100 dark:bg-gray-900 rounded break-all">
            <span className="font-bold text-gray-700 dark:text-gray-300">Mã băm SHA-256 (bytes32):</span>
            <p className="font-mono text-blue-600 dark:text-blue-400">{docHash}</p>
          </div>

          {verifyData && (
            <div className={`p-4 rounded-lg ${
              verifyData[0] ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              <p className="font-bold">
                Trạng thái On-chain: {verifyData[0] ? '✅ ĐÃ ĐƯỢC CÔNG CHỨNG (VALID)' : '⚠️ CHƯA CÓ TRÊN BLOCKCHAIN'}
              </p>
              {verifyData[0] && (
                <div className="mt-2 text-xs space-y-1">
                  <p><strong>Owner:</strong> {verifyData[3]}</p>
                  <p><strong>Phiên bản hiện tại:</strong> v{verifyData[4].toString()}</p>
                  <p><strong>IPFS CID:</strong> {verifyData[1]}</p>
                  <p><strong>Thời gian:</strong> {new Date(Number(verifyData[2]) * 1000).toLocaleString()}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Nút hành động Notarize */}
      {docHash && verifyData && !verifyData[0] && (
        <button
          onClick={handleNotarize}
          disabled={isLoading || !isConnected}
          className="mt-6 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow disabled:opacity-50 transition-all"
        >
          {isLoading ? 'Đang xử lý...' : 'Đăng ký Công chứng On-chain'}
        </button>
      )}

      {/* Trạng thái Log */}
      {status && (
        <p className="mt-4 text-xs font-mono text-gray-500 text-center">{status}</p>
      )}
    </div>
  );
}
