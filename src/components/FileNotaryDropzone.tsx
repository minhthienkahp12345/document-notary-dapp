'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { calculateSHA256, uploadToIPFS } from '../lib/cryptoAndIpfs';
import { useWriteContract, useReadContract, useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { DocumentNotary__factory } from '../../typechain-types/factories/contracts/DocumentNotary__factory';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
export default function FileNotaryDropzone() {
  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting, error: connectError } = useConnect();
  const [isMounted, setIsMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docHash, setDocHash] = useState<`0x${string}` | null>(null);
  const [originalDocHash, setOriginalDocHash] = useState<`0x${string}` | null>(null);
  const [ipfsCid, setIpfsCid] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Hook đọc thông tin kiểm tra On-chain từ Smart Contract (Free Gas Read)
  const { data: verifyData, isPending: isVerificationPending, refetch: refetchVerification } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: DocumentNotary__factory.abi, // Sửa ở đây
    functionName: 'verifyDocument',
    args: docHash ? [docHash] : undefined,
    query: { enabled: !!docHash },
  });

  useEffect(() => {
    if (docHash) {
      setStatus('Đã tính xong SHA-256! Đang kiểm tra trạng thái trên Blockchain...');
    }
  }, [docHash]);

  useEffect(() => {
    if (verifyData?.[0] && docHash) {
      setOriginalDocHash(docHash);
    }
  }, [docHash, verifyData]);


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
    } catch (err) {
      setStatus('Có lỗi xảy ra khi xử lý file.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

      const isNewVersion = Boolean(originalDocHash && originalDocHash !== docHash);
      setStatus(
        isNewVersion
          ? '2/2. Yêu cầu ký giao dịch cập nhật phiên bản via MetaMask...'
          : '2/2. Yêu cầu ký giao dịch công chứng On-chain via MetaMask...'
      );
      const tx = isNewVersion && originalDocHash
        ? await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: DocumentNotary__factory.abi,
          functionName: 'updateDocumentVersion',
          args: [originalDocHash, docHash, cid],
        })
        : await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: DocumentNotary__factory.abi,
          functionName: 'notarizeDocument',
          args: [docHash, cid],
        });

      await refetchVerification();
      setStatus(
        `${isNewVersion ? 'Cập nhật phiên bản thành công' : 'Công chứng thành công'}! Mã giao dịch (TxHash): ${tx}`
      );
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

      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-gray-100 p-3 text-sm dark:bg-gray-900">
        {!isMounted ? (
          <p className="text-gray-600 dark:text-gray-300">
            Đang kiểm tra kết nối ví...
          </p>
        ) : isConnected ? (
          <p className="truncate text-green-700 dark:text-green-400">
            Đã kết nối: {address}
          </p>
        ) : (
          <>
            <p className="text-gray-600 dark:text-gray-300">
              Hãy kết nối MetaMask để đăng ký công chứng.
            </p>
            <button
              type="button"
              onClick={() => connect({ connector: injected() })}
              disabled={isConnecting}
              className="shrink-0 rounded-lg bg-orange-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              {isConnecting ? 'Đang kết nối...' : 'Kết nối MetaMask'}
            </button>
          </>
        )}
      </div>

      {connectError && (
        <p className="mb-4 text-sm text-red-600">
          Không thể kết nối ví: {connectError.message}
        </p>
      )}

      {/* Vùng Drag and Drop UI */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive
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

          {isVerificationPending && (
            <div className="p-4 rounded-lg bg-blue-100 text-blue-800">
              Đang kiểm tra tài liệu trên Blockchain...
            </div>
          )}

          {verifyData && (
            <div className={`p-4 rounded-lg ${verifyData[0] ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
              <p className="font-bold">
                Trạng thái On-chain: {verifyData[0]
                  ? '✅ ĐÃ ĐƯỢC CÔNG CHỨNG (VALID)'
                  : originalDocHash
                    ? '⚠️ TÀI LIỆU ĐÃ BỊ THAY ĐỔI SO VỚI BẢN GỐC'
                    : '⚠️ CHƯA CÓ TRÊN BLOCKCHAIN'}
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
          {isLoading
            ? 'Đang xử lý...'
            : originalDocHash
              ? 'Đăng ký phiên bản mới On-chain'
              : 'Đăng ký Công chứng On-chain'}
        </button>
      )}

      {/* Trạng thái Log */}
      {status && (
        <p className="mt-4 text-xs font-mono text-gray-500 text-center">{status}</p>
      )}
    </div>
  );
}
