# 📜 Decentralized Document Notary & Verification DApp
A Hybrid On-chain/Off-chain Decentralized Application (DApp) for notarizing and verifying digital documents using **Ethereum Smart Contracts** and **IPFS (InterPlanetary File System)**.

## 📋 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Project Directory Structure](#-project-directory-structure)
- [Installation & Setup](#-installation--setup)
- [Smart Contract Deployment & Testing](#-smart-contract-deployment--testing)
- [Running the Frontend DApp](#-running-the-frontend-dapp)
- [Running the Demo on Another Computer](#-running-the-demo-on-another-computer)
- [Usage Flow](#-usage-flow)
- [License](#-license)

## 🏗 Architecture Overview
This project implements a **Hybrid Architecture** to solve scalability and Gas cost challenges on EVM networks:

1. **Off-chain (IPFS):** Stores the raw binary file and returns a unique **Content Identifier (CID)**.
2. **On-client (Browser RAM):** Calculates the **SHA-256 Hash** (`bytes32`) of the original file using the native Web Crypto API before uploading.
3. **On-chain (Ethereum Smart Contract):** Stores immutable records including the SHA-256 Document Hash, IPFS CID, timestamp, owner address, and version history.

## 🛠 Tech Stack

- **Smart Contracts:** Solidity (`^0.8.20`), OpenZeppelin Contracts (`v5.x`), Hardhat, Ethers.js v6.
- **Frontend:** Next.js 14+ (App Router), React, Tailwind CSS, Wagmi / Viem.
- **Off-chain Storage & Cryptography:** IPFS (`js-kubo-rpc-client`), Web Crypto API (`window.crypto.subtle`).

## ⚡ Prerequisites
Ensure you have the following installed on your local machine:

- [Node.js](https://nodejs.org/) (v18.x or later)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [IPFS Desktop / Kubo CLI](https://docs.ipfs.tech/install/) (Running IPFS node at `http://127.0.0.1:5001`)
- [MetaMask Wallet Extension](https://metamask.io/) in your browser.

## 📁 Project Directory Structure

```
document-notary-dapp/
├── contracts/                  # Solidity Smart Contracts
│   └── DocumentNotary.sol
├── scripts/                    # Deployment Scripts
│   └── deploy.ts
├── test/                       # Smart Contract Unit & Integration Tests
│   └── DocumentNotary.test.ts
├── src/                        # Next.js App Router Frontend
│   ├── app/                    # Pages and API routes
│   ├── components/             # Drag & Drop UI Components
│   └── lib/                    # SHA-256 & IPFS Client Utilities
├── .env.local                 # Local environment variables (not committed)
├── hardhat.config.ts           # Hardhat Configuration
├── package.json
└── README.md
```

## 🚀 Installation & Setup

1. **Clone the repository:**

```
git clone https://github.com/minhthienkahp12345/document-notary-dapp.git
cd document-notary-dapp
```
2. **Install all dependencies:**

```
npm install
```

The project uses one root `package.json`; there is no separate `frontend` directory.

3. **Create the local environment file:**

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_IPFS_RPC_URL=http://127.0.0.1:5001/api/v0
```

`.env.local` is ignored by Git and must be created separately on each computer.

## 🧪 Smart Contract Deployment & Testing

### 1. Compile Smart Contracts
Compile the Solidity contracts using Hardhat:

```
npx hardhat compile
```

### 2. Run Unit Tests & Gas Benchmark
Execute the automated test suite with full test coverage and gas reports:

```
npx hardhat test
```
To run code coverage:

```
npx hardhat coverage
```

### 3. Deploy to Local Network (Hardhat Node)

Open a terminal and keep it running:

```
npx hardhat node
```

Open a second terminal and deploy the contract:

```
npx hardhat compile
npx hardhat run .\scripts\deploy.ts --network localhost
```

Copy the deployed **Contract Address** from the console output and put it in `.env.local`:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedContractAddressHere
NEXT_PUBLIC_IPFS_RPC_URL=http://127.0.0.1:5001/api/v0
```

The local blockchain is reset when the Hardhat node is restarted, so deploy the contract again and update the address whenever that happens.

## 💻 Running the Frontend DApp

1. **Start the local IPFS daemon** in a third terminal:

```
ipfs daemon
```

The app uploads through the Next.js `/api/ipfs/add` route, so the browser does not need direct IPFS CORS access. The IPFS API must be available at `http://127.0.0.1:5001`.

2. **Launch the development server** in a fourth terminal:

```
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

If port 3000 is already in use, Next.js may select another port. Open the URL shown in the terminal.

## 🖥 Running the Demo on Another Computer

GitHub stores the source code, but it does not run the local Hardhat blockchain or IPFS node. To run the demo on another Windows computer:

1. Install Node.js 18+, GitHub Desktop (or Git), MetaMask, and Kubo/IPFS Desktop.
2. Clone the repository:

```powershell
git clone https://github.com/<your-github-username>/document-notary-dapp.git
cd document-notary-dapp
npm install
```

3. Create `.env.local` in the project root using the template above.
4. Run the services in separate terminals:

```powershell
# Terminal 1
npx hardhat node

# Terminal 2
npx hardhat run .\scripts\deploy.ts --network localhost

# Terminal 3
ipfs daemon

# Terminal 4
npm run dev
```

5. Copy the contract address printed by Terminal 2 into `.env.local`.
6. Restart Terminal 4 after changing `.env.local`:

```powershell
npm run dev
```

7. Configure MetaMask with:

```text
Network name: Hardhat Local
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
Currency symbol: ETH
```

8. Import a test account using one of the private keys printed by `npx hardhat node`. Never use a real wallet private key for local testing.

The local demo requires Hardhat and IPFS to remain running. A public demo link needs a hosted frontend (for example Vercel), a public testnet/RPC, and a hosted IPFS pinning service; GitHub alone cannot provide those runtime services.

## 📖 Usage Flow

1. **Connect Wallet:** Click "Kết nối MetaMask" and connect an account on the Localhost network (Chain ID: 31337).
2. **Verify / Notarize Document:**

- Drag & drop any file (PDF, PNG, DOCX) into the dropzone area.
- The DApp calculates the file's **SHA-256 Hash** instantly inside your browser memory.
- If the file is not found on-chain, click **"Đăng ký Công chứng On-chain"**.
- Confirm the transaction in MetaMask (uploads to IPFS + stores hash on-chain).
- If a previously notarized file is modified, the app detects the changed hash and offers **"Đăng ký phiên bản mới On-chain"**.
3. **Verify Existing Files:**

- Drop a file to perform a instant, **0-Gas** verification against the blockchain state.
- View the current status (**VALID / MODIFIED**), original owner address, IPFS CID, and complete version history.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.