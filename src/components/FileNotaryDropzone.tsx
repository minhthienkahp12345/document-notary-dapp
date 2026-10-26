'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { calculateSHA256, uploadToIPFS } from '../lib/cryptoAndIpfs';
import { useWriteContract, useReadContract, useAccount, useConnect, usePublicClient } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { DocumentNotary__factory } from '../../typechain-types/factories/contracts/DocumentNotary__factory';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const IPFS_GATEWAY_URL =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || 'http://127.0.0.1:8080/ipfs';
type NotarizationResult = {
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  timestamp: number;
  cid: string;
};

export default function FileNotaryDropzone() {
  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting, error: connectError } = useConnect();
  const [isMounted, setIsMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docHash, setDocHash] = useState<`0x${string}` | null>(null);
  const [originalDocHash, setOriginalDocHash] = useState<`0x${string}` | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const [ipfsCid, setIpfsCid] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVerificationRequested, setIsVerificationRequested] = useState(false);
  const [notarizationResult, setNotarizationResult] =
    useState<NotarizationResult | null>(null);
  const publicClient = usePublicClient();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Hook đọc thông tin kiểm tra On-chain từ Smart Contract (Free Gas Read)
  const { data: verifyData, isPending: isVerificationPending, refetch: refetchVerification } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: DocumentNotary__factory.abi, // Sửa ở đây
    functionName: 'verifyDocument',
    args: docHash ? [docHash] : undefined,
    query: { enabled: !!docHash && isVerificationRequested },
  });

  // Hook ghi giao dịch On-chain
  const { writeContractAsync } = useWriteContract();

  const isNonceError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return /nonce too low|nonce has already been used/i.test(message);
  };

  // A new hash alone cannot identify its source document. The file name keeps
  // the current session's version flow separate from a completely new file.
  const isChangedVersion = Boolean(
    file &&
    originalDocHash &&
    originalFileName === file.name &&
    originalDocHash !== docHash
  );

  const loadNotarizationResult = async (hash: `0x${string}`) => {
    if (!publicClient) {
      throw new Error('Không thể kết nối blockchain để tải thông tin công chứng.');
    }

    const notarizedLogs = await publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      event: {
        type: 'event',
        name: 'DocumentNotarized',
        inputs: [
          { indexed: true, name: 'docHash', type: 'bytes32' },
          { indexed: false, name: 'ipfsHash', type: 'string' },
          { indexed: true, name: 'owner', type: 'address' },
          { indexed: false, name: 'timestamp', type: 'uint256' },
        ],
      },
      args: { docHash: hash },
      fromBlock: 0n,
      toBlock: 'latest',
    });
    const updatedLogs = await publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      event: {
        type: 'event',
        name: 'DocumentUpdated',
        inputs: [
          { indexed: true, name: 'originalDocHash', type: 'bytes32' },
          { indexed: true, name: 'newDocHash', type: 'bytes32' },
          { indexed: false, name: 'newIpfsHash', type: 'string' },
          { indexed: false, name: 'newVersion', type: 'uint256' },
          { indexed: false, name: 'timestamp', type: 'uint256' },
        ],
      },
      args: { newDocHash: hash },
      fromBlock: 0n,
      toBlock: 'latest',
    });
    const matches = [
      ...notarizedLogs.map((log) => ({ log, cid: log.args.ipfsHash })),
      ...updatedLogs.map((log) => ({ log, cid: log.args.newIpfsHash })),
    ];
    const match = matches
      .sort((left, right) => Number(right.log.blockNumber - left.log.blockNumber))[0];

    if (!match?.log.blockNumber || !match.log.transactionHash || !match.cid) {
      throw new Error('Không tìm thấy giao dịch công chứng của tài liệu này.');
    }

    const block = await publicClient.getBlock({ blockNumber: match.log.blockNumber });

    return {
      blockNumber: match.log.blockNumber,
      transactionHash: match.log.transactionHash,
      timestamp: Number(block.timestamp),
      cid: match.cid,
    };
  };

  const handleVerify = async () => {
    if (!docHash) return;
    setIsVerificationRequested(true);
    setIsLoading(true);
    setNotarizationResult(null);
    setStatus('Đang kiểm tra tài liệu trên Blockchain...');
    try {
      const result = await refetchVerification();
      if (result.data?.[0]) {
        setNotarizationResult(await loadNotarizationResult(docHash));
        setStatus('Kiểm tra công chứng thành công.');
      } else {
        setStatus('Đã kiểm tra trạng thái công chứng.');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Lỗi: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý khi người dùng thả file vào vùng Drag & Drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    setIsVerificationRequested(false);
    setIpfsCid('');
    setNotarizationResult(null);
    setIsLoading(true);
    setStatus('Đang tính toán mã băm SHA-256 tại trình duyệt...');

    try {
      // 1. Băm SHA-256
      const hash = await calculateSHA256(selectedFile);
      setDocHash(hash);
      setStatus('');
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
    if (!file || !docHash || !isConnected || !address) return;
    try {
      setIsLoading(true);
      setStatus('1/2. Đang tải tập tin lên IPFS...');
      const cid = await uploadToIPFS(file);
      setIpfsCid(cid);

      if (!publicClient) {
        throw new Error('Không thể kết nối blockchain để gửi giao dịch.');
      }

      const isNewVersion = isChangedVersion;
      setStatus(
        isNewVersion
          ? '2/2. Yêu cầu ký giao dịch cập nhật phiên bản via MetaMask...'
          : '2/2. Yêu cầu ký giao dịch công chứng On-chain via MetaMask...'
      );
      const sendTransaction = (nonce: number) => (
        isNewVersion && originalDocHash
          ? writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: DocumentNotary__factory.abi,
            functionName: 'updateDocumentVersion',
            args: [originalDocHash, docHash, cid],
            nonce,
          })
          : writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: DocumentNotary__factory.abi,
            functionName: 'notarizeDocument',
            args: [docHash, cid],
            nonce,
          })
      );

      let nonce = await publicClient.getTransactionCount({
        address,
        blockTag: 'pending',
      });
      let tx: `0x${string}`;
      try {
        tx = await sendTransaction(nonce);
      } catch (error) {
        if (!isNonceError(error)) {
          throw error;
        }

        nonce = await publicClient.getTransactionCount({
          address,
          blockTag: 'pending',
        });
        tx = await sendTransaction(nonce);
      }

      setStatus('Đang chờ giao dịch được ghi vào block...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
      setNotarizationResult({
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.transactionHash,
        timestamp: Number(block.timestamp),
        cid,
      });
      if (!isNewVersion) {
        setOriginalDocHash(docHash);
        setOriginalFileName(file.name);
      }
      setIsVerificationRequested(true);
      await refetchVerification();
      setStatus(
        `${isNewVersion ? 'Cập nhật phiên bản thành công' : 'Công chứng thành công'}! Mã giao dịch (TxHash): ${tx}`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Lỗi: ${message}`);
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

      {docHash && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleVerify}
            disabled={isLoading}
            className="w-full rounded-lg bg-gray-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            Kiểm tra tài liệu công chứng
          </button>
          <button
            type="button"
            onClick={handleNotarize}
            disabled={
              isLoading ||
              !isConnected ||
              (isVerificationRequested && !isVerificationPending && !!verifyData?.[0])
            }
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading
              ? 'Đang xử lý...'
              : isChangedVersion
                ? 'Công chứng phiên bản mới'
                : 'Công chứng tài liệu mới'}
          </button>
        </div>
      )}

      {/* Thông tin Mã băm & Kết quả On-chain */}
      {docHash && (
        <div className="mt-6 space-y-3 text-sm">
          <div className="p-3 bg-gray-100 dark:bg-gray-900 rounded break-all">
            <span className="font-bold text-gray-700 dark:text-gray-300">Mã băm SHA-256 (bytes32):</span>
            <p className="font-mono text-blue-600 dark:text-blue-400">{docHash}</p>
          </div>

          {isVerificationRequested && isVerificationPending && (
            <div className="p-4 rounded-lg bg-blue-100 text-blue-800">
              Đang kiểm tra tài liệu trên Blockchain...
            </div>
          )}

          {isVerificationRequested && !isVerificationPending && verifyData && (
            <div className={`p-4 rounded-lg ${verifyData[0] ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
              <p className="font-bold">
                Trạng thái On-chain: {verifyData[0]
                  ? '✅ ĐÃ ĐƯỢC CÔNG CHỨNG (VALID)'
                  : isChangedVersion
                    ? '⚠️ TÀI LIỆU ĐÃ BỊ THAY ĐỔI SO VỚI BẢN GỐC'
                    : '⚠️ CHƯA CÓ TRÊN BLOCKCHAIN'}
              </p>
              {verifyData[0] && docHash && (
                <div className="mt-3 space-y-2 rounded-lg bg-green-50 p-3 text-xs text-green-950">
                  <p className="font-semibold">
                    Kết quả so sánh mã hash: khớp
                  </p>
                  <p className="break-all">
                    <strong>Hash đã ghi nhận trên Blockchain:</strong>{' '}
                    <span className="font-mono">{docHash}</span>
                  </p>
                  <p className="break-all">
                    <strong>Hash file đang kiểm tra:</strong>{' '}
                    <span className="font-mono">{docHash}</span>
                  </p>
                  <p>
                    Hai mã SHA-256 giống nhau, nội dung file khớp với bản đã công chứng.
                  </p>
                </div>
              )}
              {isChangedVersion && originalDocHash && docHash && (
                <div className="mt-3 space-y-2 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-950">
                  <p className="font-semibold">
                    Kết quả so sánh mã hash: không khớp
                  </p>
                  <p className="break-all">
                    <strong>Hash file gốc:</strong>{' '}
                    <span className="font-mono">{originalDocHash}</span>
                  </p>
                  <p className="break-all">
                    <strong>Hash file đang kiểm tra:</strong>{' '}
                    <span className="font-mono">{docHash}</span>
                  </p>
                  <p>
                    Nội dung file hiện tại khác file gốc nên mã SHA-256 đã thay đổi.
                  </p>
                </div>
              )}
              {verifyData[0] && (
                <div className="mt-2 text-xs space-y-1">
                  <p><strong>Owner:</strong> {verifyData[3]}</p>
                  <p><strong>Phiên bản hiện tại:</strong> v{verifyData[4].toString()}</p>
                  <p className="break-all">
                    <strong>IPFS CID:</strong>{' '}
                    <a
                      href={`${IPFS_GATEWAY_URL}/${verifyData[1]}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline"
                    >
                      {verifyData[1]}
                    </a>
                  </p>
                  <p><strong>Thời gian:</strong> {new Date(Number(verifyData[2]) * 1000).toLocaleString()}</p>
                </div>
              )}
            </div>
          )}

          {notarizationResult && (
            <div className="rounded-lg bg-blue-100 p-4 text-sm text-blue-900">
              <p className="font-bold">Chi tiết công chứng trên Blockchain</p>
              <div className="mt-2 space-y-2">
                <p className="break-all">
                  <strong>SHA-256 Hash:</strong>{' '}
                  <span className="font-mono">{docHash}</span>
                </p>
                <p className="text-xs text-blue-800">
                  SHA-256 Hash là tiêu chí chính để phát hiện nội dung tài liệu có thay đổi.
                </p>
                <p className="break-all">
                  <strong>Transaction Hash:</strong>{' '}
                  <span className="font-mono">{notarizationResult.transactionHash}</span>
                </p>
                <p>
                  <strong>Block Number:</strong>{' '}
                  {notarizationResult.blockNumber.toString()}
                </p>
                <p>
                  <strong>Timestamp:</strong>{' '}
                  {new Date(notarizationResult.timestamp * 1000).toLocaleString()}
                </p>
                <p className="break-all">
                  <strong>IPFS CID:</strong>{' '}
                  <a
                    href={`${IPFS_GATEWAY_URL}/${notarizationResult.cid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 underline"
                  >
                    {notarizationResult.cid}
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trạng thái Log */}
      {status && (
        <p className="mt-4 text-xs font-mono text-gray-500 text-center">{status}</p>
      )}
    </div>
  );
}
