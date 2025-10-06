const {
    loadFixture,
    time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UsageReceiptVerifier Contract", function () {
    // We define a fixture to reuse the same setup in every test.
    async function deployVerifierFixture() {
        // Get signers
        const [owner, admin, minter, uriSetter, assetOwner, contributor1, contributor2, user, verifier, pauser] = await ethers.getSigners();

        // --- 1. DEPLOY MOCK USDC ---
        const MockERC20 = await ethers.getContractFactory("ERC20PresetMinterPauser");
        const usdc = await MockERC20.deploy("Mock USDC", "mUSDC");
        await usdc.waitForDeployment();
        
        // Fund the user's account with mock USDC
        const paymentAmount = ethers.parseUnits("100", 6); // 100 USDC with 6 decimals
        await usdc.mint(user.address, paymentAmount);

        // --- 2. DEPLOY ALL DEPENDENCIES ---
        const AssetToken = await ethers.getContractFactory("AssetToken");
        const assetToken = await AssetToken.deploy(admin.address, minter.address, uriSetter.address, "uri");
        await assetToken.waitForDeployment();

        const ContributorRegistry = await ethers.getContractFactory("ContributorRegistry");
        const contributorRegistry = await ContributorRegistry.deploy(admin.address, admin.address, pauser.address);
        await contributorRegistry.waitForDeployment();
        
        const ProvenanceGraph = await ethers.getContractFactory("ProvenanceGraph");
        const provenanceGraph = await ProvenanceGraph.deploy(await assetToken.getAddress(), await contributorRegistry.getAddress());
        await provenanceGraph.waitForDeployment();
        
        const RoyaltySplitFactory = await ethers.getContractFactory("RoyaltySplitFactory");
        const royaltySplitFactory = await RoyaltySplitFactory.deploy(await provenanceGraph.getAddress());
        await royaltySplitFactory.waitForDeployment();

        // --- 3. SETUP FULL SCENARIO FOR A SINGLE ASSET ---
        const assetId = 1;
        // Grant roles
        const CONTRIBUTOR_ROLE = await provenanceGraph.CONTRIBUTOR_ROLE();
        await contributorRegistry.connect(admin).grantRole(CONTRIBUTOR_ROLE, contributor1.address);
        await contributorRegistry.connect(admin).grantRole(CONTRIBUTOR_ROLE, contributor2.address);
        // Mint asset
        await assetToken.connect(minter).mint(assetOwner.address, assetId, 1, "uri", "0x");
        // Define provenance
        await provenanceGraph.connect(assetOwner).addContributorEdge(assetId, contributor1.address, 8000);
        await provenanceGraph.connect(assetOwner).addContributorEdge(assetId, contributor2.address, 2000);
        // Finalize
        await provenanceGraph.connect(assetOwner).finalize(assetId);
        // Create splitter
        await royaltySplitFactory.createSplitter(assetId);
        const paymentSplitterAddress = await royaltySplitFactory.assetIdToSplitter(assetId);

        // --- 4. DEPLOY UsageReceiptVerifier ---
        const EIP712_NAME = "AIUsageReceipts";
        const EIP712_VERSION = "1";
        const UsageReceiptVerifier = await ethers.getContractFactory("UsageReceiptVerifier");
        const usageReceiptVerifier = await UsageReceiptVerifier.deploy(
            EIP712_NAME,
            EIP712_VERSION,
            await usdc.getAddress(),
            await royaltySplitFactory.getAddress(),
            admin.address,
            verifier.address,
            pauser.address
        );
        await usageReceiptVerifier.waitForDeployment();
        
        // --- 5. PREPARE FOR PAYMENT ---
        // User approves the verifier contract to spend their USDC
        await usdc.connect(user).approve(await usageReceiptVerifier.getAddress(), paymentAmount);

        // EIP-712 Domain
        const domain = {
            name: EIP712_NAME,
            version: EIP712_VERSION,
            chainId: (await ethers.provider.getNetwork()).chainId,
            verifyingContract: await usageReceiptVerifier.getAddress()
        };

        // EIP-712 Types
        const types = {
            UsageReceipt: [
                { name: "assetId", type: "uint256" },
                { name: "amount", type: "uint256" },
                { name: "user", type: "address" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" }
            ]
        };

        return {
            usageReceiptVerifier,
            usdc,
            user,
            verifier,
            pauser,
            admin,
            paymentSplitterAddress,
            assetId,
            paymentAmount,
            domain,
            types,
        };
    }

    describe("Deployment", function () {
        it("Should set the correct roles and addresses", async function () {
            const { usageReceiptVerifier, usdc, verifier, pauser, admin } = await loadFixture(deployVerifierFixture);
            expect(await usageReceiptVerifier.usdc()).to.equal(await usdc.getAddress());
            expect(await usageReceiptVerifier.hasRole(await usageReceiptVerifier.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
            expect(await usageReceiptVerifier.hasRole(await usageReceiptVerifier.VERIFIER_ROLE(), verifier.address)).to.be.true;
            expect(await usageReceiptVerifier.hasRole(await usageReceiptVerifier.PAUSER_ROLE(), pauser.address)).to.be.true;
        });
    });

    describe("verifyAndPayWithReceipt Functionality", function () {

        it("Should successfully process a valid receipt and transfer funds", async function () {
            const { usageReceiptVerifier, usdc, user, verifier, paymentSplitterAddress, assetId, paymentAmount, domain, types } = await loadFixture(deployVerifierFixture);
            
            const deadline = (await time.latest()) + 60 * 60; // 1 hour from now
            const nonce = await usageReceiptVerifier.nonces(user.address);
            
            const receipt = {
                assetId: assetId,
                amount: paymentAmount,
                user: user.address,
                nonce: nonce,
                deadline: deadline,
            };

            const signature = await user.signTypedData(domain, types, receipt);
            
            await expect(
                usageReceiptVerifier.connect(verifier).verifyAndPayWithReceipt(receipt, signature)
            ).to.changeTokenBalances(
                usdc,
                [user, paymentSplitterAddress],
                [-paymentAmount, paymentAmount]
            );
            
            // Check if nonce was incremented
            expect(await usageReceiptVerifier.nonces(user.address)).to.equal(nonce + BigInt(1));
        });

        it("Should REVERT if the receipt has expired", async function () {
            const { usageReceiptVerifier, user, verifier, assetId, paymentAmount, domain, types } = await loadFixture(deployVerifierFixture);
            
            const deadline = (await time.latest()) - 1; // 1 second in the past
            const nonce = await usageReceiptVerifier.nonces(user.address);
            
            const receipt = { assetId, amount: paymentAmount, user: user.address, nonce, deadline };
            const signature = await user.signTypedData(domain, types, receipt);
            
            await expect(
                usageReceiptVerifier.connect(verifier).verifyAndPayWithReceipt(receipt, signature)
            ).to.be.revertedWithCustomError(usageReceiptVerifier, "ReceiptExpired");
        });

        it("Should REVERT if the signature is invalid", async function () {
            const { usageReceiptVerifier, user, verifier, assetId, paymentAmount, domain, types } = await loadFixture(deployVerifierFixture);
            
            const deadline = (await time.latest()) + 60 * 60;
            const nonce = await usageReceiptVerifier.nonces(user.address);
            const receipt = { assetId, amount: paymentAmount, user: user.address, nonce, deadline };

            // Sign with the wrong account (verifier instead of user)
            const signature = await verifier.signTypedData(domain, types, receipt);

            await expect(
                usageReceiptVerifier.connect(verifier).verifyAndPayWithReceipt(receipt, signature)
            ).to.be.revertedWithCustomError(usageReceiptVerifier, "InvalidSignature");
        });

        it("Should REVERT if the nonce is incorrect (replay attack)", async function () {
            const { usageReceiptVerifier, user, verifier, assetId, paymentAmount, domain, types } = await loadFixture(deployVerifierFixture);
            
            const deadline = (await time.latest()) + 60 * 60;
            const badNonce = (await usageReceiptVerifier.nonces(user.address)) + BigInt(1); // Incorrect nonce
            
            const receipt = { assetId, amount: paymentAmount, user: user.address, nonce: badNonce, deadline };
            const signature = await user.signTypedData(domain, types, receipt);

            await expect(
                usageReceiptVerifier.connect(verifier).verifyAndPayWithReceipt(receipt, signature)
            ).to.be.revertedWithCustomError(usageReceiptVerifier, "InvalidNonce");
        });

        it("Should REVERT if the contract is paused", async function () {
            const { usageReceiptVerifier, user, verifier, pauser, assetId, paymentAmount, domain, types } = await loadFixture(deployVerifierFixture);
            
            await usageReceiptVerifier.connect(pauser).pause();
            
            const deadline = (await time.latest()) + 60 * 60;
            const nonce = await usageReceiptVerifier.nonces(user.address);
            const receipt = { assetId, amount: paymentAmount, user: user.address, nonce, deadline };
            const signature = await user.signTypedData(domain, types, receipt);

            await expect(
                usageReceiptVerifier.connect(verifier).verifyAndPayWithReceipt(receipt, signature)
            ).to.be.revertedWith("Pausable: paused");
        });

        it("Should REVERT if the splitter for the asset does not exist", async function () {
            const { usageReceiptVerifier, user, verifier, paymentAmount, domain, types } = await loadFixture(deployVerifierFixture);
            
            const nonExistentAssetId = 999;
            const deadline = (await time.latest()) + 60 * 60;
            const nonce = await usageReceiptVerifier.nonces(user.address);

            const receipt = { assetId: nonExistentAssetId, amount: paymentAmount, user: user.address, nonce, deadline };
            const signature = await user.signTypedData(domain, types, receipt);

            await expect(
                usageReceiptVerifier.connect(verifier).verifyAndPayWithReceipt(receipt, signature)
            ).to.be.revertedWithCustomError(usageReceiptVerifier, "SplitterNotCreated");
        });
    });
});
