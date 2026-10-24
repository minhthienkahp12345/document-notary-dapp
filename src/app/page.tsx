'use client';

import FileNotaryDropzone from '../components/FileNotaryDropzone';

export default function Home() {
    return (
        <div className="container mx-auto px-4">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Hệ thống Công chứng & Xác thực Tài liệu Số
                </h1>
                <p className="text-sm text-gray-500 mt-2">
                    Nền tảng lưu trữ phi tập trung kết hợp Blockchain Ethereum và IPFS
                </p>
            </div>

            {/* Gọi giao diện kéo thả file vào đây */}
            <FileNotaryDropzone />
        </div>
    );
}