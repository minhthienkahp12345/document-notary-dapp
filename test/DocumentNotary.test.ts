import { expect } from "chai";
import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import type { DocumentNotary } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const { ethers } = hre;

describe("DocumentNotary Contract Unit Tests", function () {
  let notary: DocumentNotary;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  // Dữ liệu mẫu giả lập
  const sampleHash1 = ethers.keccak256(ethers.toUtf8Bytes("Document 1 Content"));
  const sampleIpfs1 = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

  const sampleHash2 = ethers.keccak256(ethers.toUtf8Bytes("Document 1 Version 2"));
  const sampleIpfs2 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const DocumentNotaryFactory = await ethers.getContractFactory("DocumentNotary");
    notary = await DocumentNotaryFactory.deploy();
    await notary.waitForDeployment();
  });

  describe("1. Công chứng Tài liệu Mới (notarizeDocument)", function () {
    it("Tạo công chứng thành công và phát sự kiện DocumentNotarized", async function () {
      await expect(notary.connect(user1).notarizeDocument(sampleHash1, sampleIpfs1))
        .to.emit(notary, "DocumentNotarized")
        .withArgs(sampleHash1, sampleIpfs1, user1.address, (await ethers.provider.getBlock("latest"))?.timestamp! + 1);

      const doc = await notary.verifyDocument(sampleHash1);
      expect(doc.isValid).to.be.true;
      expect(doc.ipfsHash).to.equal(sampleIpfs1);
      expect(doc.owner).to.equal(user1.address);
      expect(doc.currentVersion).to.equal(1n);
    });

    it("Thất bại khi cố công chứng trùng docHash đã tồn tại (Revert DocumentAlreadyExists)", async function () {
      await notary.connect(user1).notarizeDocument(sampleHash1, sampleIpfs1);

      await expect(
        notary.connect(user2).notarizeDocument(sampleHash1, "QmAnotherCID...")
      ).to.be.revertedWithCustomError(notary, "DocumentAlreadyExists")
       .withArgs(sampleHash1);
    });

    it("Thất bại khi truyền docHash rỗng hoặc IPFS CID rỗng (Revert InvalidHashOrCID)", async function () {
      await expect(
        notary.connect(user1).notarizeDocument(ethers.ZeroHash, sampleIpfs1)
      ).to.be.revertedWithCustomError(notary, "InvalidHashOrCID");

      await expect(
        notary.connect(user1).notarizeDocument(sampleHash1, "")
      ).to.be.revertedWithCustomError(notary, "InvalidHashOrCID");
    });
  });

  describe("2. Cập nhật Phiên bản Tài liệu (updateDocumentVersion)", function () {
    beforeEach(async function () {
      await notary.connect(user1).notarizeDocument(sampleHash1, sampleIpfs1);
    });

    it("Chủ sở hữu cập nhật phiên bản thành công (Version 2)", async function () {
      await expect(
        notary.connect(user1).updateDocumentVersion(sampleHash1, sampleHash2, sampleIpfs2)
      )
        .to.emit(notary, "DocumentUpdated")
        .withArgs(sampleHash1, sampleHash2, sampleIpfs2, 2n, (await ethers.provider.getBlock("latest"))?.timestamp! + 1);

      const history = await notary.getDocumentHistory(sampleHash1);
      expect(history.length).to.equal(2);
      expect(history[1].versionNumber).to.equal(2n);
      expect(history[1].docHash).to.equal(sampleHash2);
      expect(history[1].ipfsHash).to.equal(sampleIpfs2);
    });

    it("Thất bại khi người không phải Owner cập nhật (Revert NotDocumentOwner)", async function () {
      await expect(
        notary.connect(user2).updateDocumentVersion(sampleHash1, sampleHash2, sampleIpfs2)
      ).to.be.revertedWithCustomError(notary, "NotDocumentOwner")
       .withArgs(user2.address, user1.address);
    });

    it("Thất bại khi cập nhật tài liệu không tồn tại (Revert DocumentNotFound)", async function () {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("Fake Doc"));
      await expect(
        notary.connect(user1).updateDocumentVersion(fakeHash, sampleHash2, sampleIpfs2)
      ).to.be.revertedWithCustomError(notary, "DocumentNotFound")
       .withArgs(fakeHash);
    });
  });

  describe("3. Xác thực & Truy xuất Lịch sử (Verify & History)", function () {
    it("Trả về isValid = false khi mã băm không tồn tại On-chain", async function () {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("Non Existing Doc"));
      const doc = await notary.verifyDocument(fakeHash);
      expect(doc.isValid).to.be.false;
      expect(doc.owner).to.equal(ethers.ZeroAddress);
    });

    it("Lấy chính xác danh sách lịch sử nhiều phiên bản", async function () {
      await notary.connect(user1).notarizeDocument(sampleHash1, sampleIpfs1);
      await notary.connect(user1).updateDocumentVersion(sampleHash1, sampleHash2, sampleIpfs2);

      const history = await notary.getDocumentHistory(sampleHash1);
      expect(history.length).to.equal(2);
      expect(history[0].ipfsHash).to.equal(sampleIpfs1);
      expect(history[1].ipfsHash).to.equal(sampleIpfs2);
    });
  });

  describe("4. Quyền Quản trị Admin (Pausable)", function () {
    it("Admin có thể Pause và Unpause hợp đồng", async function () {
      await notary.connect(owner).pause();
      
      // Không thể thực hiện giao dịch khi hợp đồng đang Paused
      await expect(
        notary.connect(user1).notarizeDocument(sampleHash1, sampleIpfs1)
      ).to.be.revertedWithCustomError(notary, "EnforcedPause");

      await notary.connect(owner).unpause();

      // Thực hiện giao dịch bình thường sau khi Unpause
      await expect(notary.connect(user1).notarizeDocument(sampleHash1, sampleIpfs1))
        .to.emit(notary, "DocumentNotarized");
    });
  });
});