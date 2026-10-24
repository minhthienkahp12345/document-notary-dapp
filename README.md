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
├── frontend/                   # Next.js App Router Frontend
│   ├── src/
│   │   ├── app/                # Next.js Pages & Layout
│   │   ├── components/         # Drag & Drop UI Components
│   │   ├── config/             # Wagmi & Contract ABI Configuration
│   │   └── lib/                # SHA-256 & IPFS Client Utilities
│   └── .env.local              # Environment Variables
├── hardhat.config.ts           # Hardhat Configuration
├── package.json
└── README.md
```

## 🚀 Installation & Setup

1. **Clone the repository:**

```
git clone https://github.com/your-username/document-notary-dapp.git
cd document-notary-dapp
```
2. **Install dependencies for Smart Contract environment:**

```
npm install
```
3. **Install dependencies for Frontend environment:**

```
cd frontend
npm install
cd ..
```

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

1. Start a local Hardhat Ethereum node:

```
npx hardhat node
```
2. Open a new terminal and deploy the contract:

```
npx hardhat run scripts/deploy.ts --network localhost
```
3. Copy the deployed **Contract Address** from the console output.

## 💻 Running the Frontend DApp

1. **Configure Environment Variables:**
Create a `.env.local` file inside the `frontend/` directory:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedContractAddressHere
NEXT_PUBLIC_IPFS_RPC_URL=http://127.0.0.1:5001/api/v0
```
2. **Start Local IPFS Daemon:**
Ensure your local IPFS daemon is running and configured with CORS headers enabled:

```
ipfs daemon
```
*(CORS configuration for local IPFS node):*

```
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST", "GET"]'
```
3. **Launch the Development Server:**

```
cd frontend
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage Flow

1. **Connect Wallet:** Click "Connect Wallet" on the top right to link your MetaMask account to the Localhost network (Chain ID: 31337).
2. **Verify / Notarize Document:**

- Drag & drop any file (PDF, PNG, DOCX) into the dropzone area.
- The DApp calculates the file's **SHA-256 Hash** instantly inside your browser memory.
- If the file is **Not Found** on-chain, click **"Register Notarization"**.
- Confirm the transaction in MetaMask (uploads to IPFS + stores hash on-chain).
3. **Verify Existing Files:**

- Drop a file to perform a instant, **0-Gas** verification against the blockchain state.
- View the current status (**VALID / MODIFIED**), original owner address, IPFS CID, and complete version history.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.