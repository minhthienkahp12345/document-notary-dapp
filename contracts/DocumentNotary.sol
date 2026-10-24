// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DocumentNotary
 * @dev Hệ thống công chứng và xác thực tài liệu số lưu trữ lai On-chain/Off-chain.
 */
contract DocumentNotary is Ownable, Pausable {

    // ==========================================
    // DATA STRUCTURES
    // ==========================================

    struct VersionRecord {
        string ipfsHash;        // CID IPFS của phiên bản
        bytes32 docHash;        // Mã băm SHA-256 của file thuộc phiên bản này
        uint256 timestamp;      // Dấu thời gian đăng ký (block.timestamp)
        uint256 versionNumber;  // Số hiệu phiên bản (1, 2, 3...)
    }

    struct Document {
        bytes32 docHash;        // Mã băm SHA-256 định danh tài liệu gốc
        string ipfsHash;        // CID IPFS của phiên bản hiện tại
        uint256 timestamp;      // Thời điểm đăng ký lần đầu
        address owner;          // Địa chỉ ví người công chứng/sở hữu
        uint256 currentVersion; // Số hiệu phiên bản hiện tại
        bool exists;            // Cờ xác định sự tồn tại của tài liệu
    }

    // ==========================================
    // STATE VARIABLES & MAPPINGS
    // ==========================================

    // Mapping từ docHash gốc -> Thông tin Document
    mapping(bytes32 => Document) private documents;

    // Mapping từ docHash gốc -> Mảng danh sách lịch sử các phiên bản
    mapping(bytes32 => VersionRecord[]) private versionHistory;

    // ==========================================
    // CUSTOM ERRORS (Gas Optimization)
    // ==========================================

    error DocumentAlreadyExists(bytes32 docHash);
    error DocumentNotFound(bytes32 docHash);
    error NotDocumentOwner(address caller, address owner);
    error InvalidHashOrCID();
    error VersionHashAlreadyExists(bytes32 newDocHash);

    // ==========================================
    // EVENTS
    // ==========================================

    event DocumentNotarized(
        bytes32 indexed docHash,
        string ipfsHash,
        address indexed owner,
        uint256 timestamp
    );

    event DocumentUpdated(
        bytes32 indexed originalDocHash,
        bytes32 indexed newDocHash,
        string newIpfsHash,
        uint256 newVersion,
        uint256 timestamp
    );

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    constructor() Ownable(msg.sender) {}

    // ==========================================
    // EXTERNAL WRITE FUNCTIONS (Transactions)
    // ==========================================

    /**
     * @notice Đăng ký công chứng tài liệu mới lên Blockchain
     * @param _docHash Mã băm SHA-256 (32 bytes) của tài liệu gốc
     * @param _ipfsHash Chuỗi CID IPFS trỏ đến file gốc
     */
    function notarizeDocument(bytes32 _docHash, string calldata _ipfsHash) 
        external 
        whenNotPaused 
    {
        if (_docHash == bytes32(0) || bytes(_ipfsHash).length == 0) {
            revert InvalidHashOrCID();
        }
        if (documents[_docHash].exists) {
            revert DocumentAlreadyExists(_docHash);
        }

        // Khởi tạo Struct Document
        documents[_docHash] = Document({
            docHash: _docHash,
            ipfsHash: _ipfsHash,
            timestamp: block.timestamp,
            owner: msg.sender,
            currentVersion: 1,
            exists: true
        });

        // Thêm bản ghi phiên bản 1 vào History
        versionHistory[_docHash].push(VersionRecord({
            ipfsHash: _ipfsHash,
            docHash: _docHash,
            timestamp: block.timestamp,
            versionNumber: 1
        }));

        emit DocumentNotarized(_docHash, _ipfsHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Cập nhật phiên bản mới cho tài liệu đã tồn tại
     * @param _originalDocHash Mã băm SHA-256 của tài liệu gốc lần đầu
     * @param _newDocHash Mã băm SHA-256 của file phiên bản mới
     * @param _newIpfsHash Chuỗi CID IPFS mới
     */
    function updateDocumentVersion(
        bytes32 _originalDocHash,
        bytes32 _newDocHash,
        string calldata _newIpfsHash
    ) 
        external 
        whenNotPaused 
    {
        if (_originalDocHash == bytes32(0) || _newDocHash == bytes32(0) || bytes(_newIpfsHash).length == 0) {
            revert InvalidHashOrCID();
        }
        
        Document storage doc = documents[_originalDocHash];
        
        if (!doc.exists) {
            revert DocumentNotFound(_originalDocHash);
        }
        if (doc.owner != msg.sender) {
            revert NotDocumentOwner(msg.sender, doc.owner);
        }
        if (documents[_newDocHash].exists) {
            revert VersionHashAlreadyExists(_newDocHash);
        }

        // Cập nhật thông tin phiên bản mới
        doc.currentVersion += 1;
        doc.ipfsHash = _newIpfsHash;

        // Lưu vào danh sách lịch sử
        versionHistory[_originalDocHash].push(VersionRecord({
            ipfsHash: _newIpfsHash,
            docHash: _newDocHash,
            timestamp: block.timestamp,
            versionNumber: doc.currentVersion
        }));

        emit DocumentUpdated(
            _originalDocHash,
            _newDocHash,
            _newIpfsHash,
            doc.currentVersion,
            block.timestamp
        );
    }

    // ==========================================
    // EXTERNAL VIEW FUNCTIONS (Free Gas Reads)
    // ==========================================

    /**
     * @notice Xác thực tính toàn vẹn của một mã băm SHA-256
     * @param _docHash Mã băm SHA-256 cần kiểm tra
     */
    function verifyDocument(bytes32 _docHash) 
        external 
        view 
        returns (
            bool isValid,
            string memory ipfsHash,
            uint256 timestamp,
            address owner,
            uint256 currentVersion
        ) 
    {
        Document memory doc = documents[_docHash];
        if (doc.exists) {
            return (true, doc.ipfsHash, doc.timestamp, doc.owner, doc.currentVersion);
        }
        return (false, "", 0, address(0), 0);
    }

    /**
     * @notice Truy xuất toàn bộ danh sách lịch sử các phiên bản của tài liệu gốc
     * @param _originalDocHash Mã băm SHA-256 của tài liệu gốc
     */
    function getDocumentHistory(bytes32 _originalDocHash) 
        external 
        view 
        returns (VersionRecord[] memory) 
    {
        if (!documents[_originalDocHash].exists) {
            revert DocumentNotFound(_originalDocHash);
        }
        return versionHistory[_originalDocHash];
    }

    // ==========================================
    // ADMIN FUNCTIONS
    // ==========================================

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}