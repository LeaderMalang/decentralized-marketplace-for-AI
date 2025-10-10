# AI Contributor & Revenue Share Platform

## Overview
This project is building a decentralized, pay-on-use system to fairly reward every contributor in the AI value chain.  
Using a combination of **smart contracts** and **off-chain infrastructure**, the platform ensures that whenever a dataset or model is used, revenue is automatically split and distributed to the original data owners, annotators, model developers, and compute providers.

---

## Table of Contents
- [Core Concepts](#core-concepts)  
- [Project Status](#project-status)  
- [Local Development](#local-development)  
- [Testing](#testing)  
- [Future Enhancements](#future-enhancements)  
- [License](#license)  

---

## Core Concepts
- **Wallet-based Identity**: Every contributor is identified by their unique blockchain wallet.  
- **Asset Tokenization**: Datasets and models are represented as unique **ERC-1155 tokens** on the blockchain.  
- **Verifiable Provenance**: A tamper-proof **ProvenanceGraph** records contributions with weighted revenue shares.  
- **Automated Revenue Splits**: Smart contracts meter usage and automatically split revenues in **USDC stablecoin** to all registered contributors.  

---

## Project Status (as of September 2025)

### A) Policy & Licenses
- [ ] A1. License templates (COMM/NC, attribution, prohibited uses)  
- [ ] A2. Pricing metrics (per-1k tokens, GPU-sec, training step)  
- [ ] A3. Publisher attestation & AUP (rights warranty, takedown)  
- [ ] A4. DPA & TOS (PII, retention, breach notice)  

### B) Smart Contracts (EVM)
- [x] B1. ContributorRegistry — wallet↔profile; roles; AccessControl, Pausable  
- [x] B2. AssetToken (ERC-1155) — datasets/models, per-ID URIs, license IDs  
- [x] B3. ProvenanceGraph — addEdge(assetId,target,weightBps); finalize()  
- [x] B4. RoyaltySplitFactory (+Splits) — PaymentSplitter clones or 0xSplits  
- [x] B5. UsageReceiptVerifier — EIP-712 receipts; Permit2 USDC pull or escrow  
- [x] B6. Escrow & Dispute — open/hold/resolve with roles and time-locks  
- [ ] B7. FeeTreasury — protocol fee (bps) to multisig  
- [ ] B8. RegistryRouter (views) — read asset→split/license/parents; contributor→roles  
- [ ] B9. Upgradability & Admin — core non-upgradeable; Safe multisig  
- [x] B10. Hardhat Monorepo — tests (≥90% cov), deploy scripts  
- [x] AssetToken.sol tests complete  
- [x] ContributorRegistry.sol tests complete  
- [ ] Security analysis (Slither/Echidna) pending  

### C) AI Factory Gateway
- [ ] C1. Auth & rate-limit (API keys/OAuth, throttling)  
- [ ] C2. License enforcement (block on invalid license; log)  
- [ ] C3. Usage metering (tokens/GPU-sec per model)  
- [ ] C4. UsageReceipt spec & signer (EIP-712; HSM/secure key)  
- [ ] C5. Batch settlement API (idempotent; replay-safe)  
- [ ] C6. Admin UI (RBAC for keys, pricing, license maps, logs)  

---

## Local Development

### Prerequisites
- Node.js **v18+**  
- npm  
- Hardhat (`npm install --save-dev hardhat`)  
- Development wallet  

### Installation
```bash
git clone <your-repo-url>
cd <your-repo-directory>
npm install
