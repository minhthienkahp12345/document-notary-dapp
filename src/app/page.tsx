import FileNotaryDropzone from '@/components/FileNotaryDropzone';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Hệ thống Công chứng & Xác thực Tài liệu Số
        </h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
          Nền tảng lưu trữ lai phi tập trung kết hợp Blockchain Ethereum và IPFS
        </p>
      </div>

      <FileNotaryDropzone />
    </main>
  );
}