const {
    loadFixture,
    time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Escrow Contract", function () {
    async function deployEscrowFixture() {
        const [owner, admin, minter, uriSetter, assetOwner, user, arbiter, pauser, treasury, contributor1, contributor2, otherAccount] = await ethers.getSigners();

        // 1. Deploy Mock USDC and fund user
        const MockERC20 = await ethers.getContractFactory("ERC20PresetMinterPauser");
        const usdc = await MockERC20.deploy("Mock USDC", "mUSDC");
        await usdc.waitForDeployment();
        const paymentAmount = ethers.parseUnits("100", 6);
        await usdc.mint(user.address, paymentAmount);

        // 2. Deploy all contract dependencies
        const AssetToken = await ethers.getContractFactory("AssetToken");
        const assetToken = await AssetToken.deploy(admin.address, minter.address, uriSetter.address, "uri");
        const ContributorRegistry = await ethers.getContractFactory("ContributorRegistry");
        const contributorRegistry = await ContributorRegistry.deploy(admin.address, admin.address, pauser.address);
        const ProvenanceGraph = await ethers.getContractFactory("ProvenanceGraph");
        const provenanceGraph = await ProvenanceGraph.deploy(await assetToken.getAddress(), await contributorRegistry.getAddress());
        const RoyaltySplitFactory = await ethers.getContractFactory("RoyaltySplitFactory");
        const royaltySplitFactory = await RoyaltySplitFactory.deploy(await provenanceGraph.getAddress());
        const FeeTreasury = await ethers.getContractFactory("FeeTreasury");
        const feeTreasury = await FeeTreasury.deploy(admin.address, treasury.address, 250); // 2.5% fee

        // 3. Setup asset, provenance, and splitter
        const assetId = 1;
        const CONTRIBUTOR_ROLE = await provenanceGraph.CONTRIBUTOR_ROLE();
        await contributorRegistry.connect(admin).grantRole(CONTRIBUTOR_ROLE, contributor1.address);
        await contributorRegistry.connect(admin).grantRole(CONTRIBUTOR_ROLE, contributor2.address);
        await assetToken.connect(minter).mint(assetOwner.address, assetId, 1, "uri", "0x");
        await provenanceGraph.connect(assetOwner).addContributorEdge(assetId, contributor1.address, 8000);
        await provenanceGraph.connect(assetOwner).addContributorEdge(assetId, contributor2.address, 2000);
        await provenanceGraph.connect(assetOwner).finalize(assetId);
        await royaltySplitFactory.createSplitter(assetId);
        const paymentSplitterAddress = await royaltySplitFactory.assetIdToSplitter(assetId);

        // 4. Deploy Escrow contract
        const disputeWindowSeconds = 3 * 24 * 60 * 60; // 3 days
        const Escrow = await ethers.getContractFactory("Escrow");
        const escrow = await Escrow.deploy(
            await usdc.getAddress(),
            await feeTreasury.getAddress(),
            await royaltySplitFactory.getAddress(),
            admin.address,
            pauser.address,
            arbiter.address,
            disputeWindowSeconds
        );
        await escrow.waitForDeployment();
        
        // 5. Grant the HOLDER_ROLE to the user for testing purposes
        const HOLDER_ROLE = await escrow.HOLDER_ROLE();
        await escrow.connect(admin).grantRole(HOLDER_ROLE, user.address);

        return { escrow, usdc, user, arbiter, pauser, treasury, paymentSplitterAddress, assetId, paymentAmount, disputeWindowSeconds };
    }

    describe("holdPayment", function () {
        it("Should successfully hold a payment and transfer funds", async function () {
            const { escrow, usdc, user, assetId, paymentAmount, paymentSplitterAddress } = await loadFixture(deployEscrowFixture);

            // User must first approve the Escrow contract to spend their USDC
            await usdc.connect(user).approve(await escrow.getAddress(), paymentAmount);

            const expectedReleaseTime = (await time.latest()) + 1 + (await escrow.disputeWindowSeconds());
            
            await expect(escrow.connect(user).holdPayment(assetId, user.address, paymentAmount))
                .to.emit(escrow, "EscrowHeld")
                .withArgs(1, assetId, user.address, paymentAmount, paymentSplitterAddress);
            
            const heldPayment = await escrow.escrows(1);
            expect(heldPayment.status).to.equal(0); // 0 = Held
            expect(heldPayment.releaseTime).to.equal(expectedReleaseTime);
        });
    });

    describe("Dispute and Release Logic", function () {
        it("Should allow a user to open a dispute within the window", async function () {
            const { escrow, usdc, user, assetId, paymentAmount } = await loadFixture(deployEscrowFixture);
            await usdc.connect(user).approve(await escrow.getAddress(), paymentAmount);
            await escrow.connect(user).holdPayment(assetId, user.address, paymentAmount);

            await expect(escrow.connect(user).openDispute(1))
                .to.emit(escrow, "EscrowDisputed")
                .withArgs(1);

            const heldPayment = await escrow.escrows(1);
            expect(heldPayment.status).to.equal(1); // 1 = Disputed
        });

        it("Should allow anyone to release funds after the dispute window", async function () {
            const { escrow, usdc, user, assetId, paymentAmount, treasury, paymentSplitterAddress, disputeWindowSeconds } = await loadFixture(deployEscrowFixture);
            await usdc.connect(user).approve(await escrow.getAddress(), paymentAmount);
            await escrow.connect(user).holdPayment(assetId, user.address, paymentAmount);

            // Fast forward time
            await time.increase(disputeWindowSeconds + 1);
            
            const fee = (paymentAmount * BigInt(250)) / BigInt(10000);
            const amountToContributors = paymentAmount - fee;

            await expect(escrow.release(1)).to.changeTokenBalances(
                usdc,
                [treasury, paymentSplitterAddress],
                [fee, amountToContributors]
            );
            
            const heldPayment = await escrow.escrows(1);
            expect(heldPayment.status).to.equal(2); // 2 = Released
        });

        it("Should allow an arbiter to resolve a dispute by refunding the user", async function () {
            const { escrow, usdc, user, arbiter, assetId, paymentAmount } = await loadFixture(deployEscrowFixture);
            await usdc.connect(user).approve(await escrow.getAddress(), paymentAmount);
            await escrow.connect(user).holdPayment(assetId, user.address, paymentAmount);
            await escrow.connect(user).openDispute(1);

            await expect(escrow.connect(arbiter).resolveDispute(1, true))
                .to.emit(escrow, "EscrowResolved")
                .withArgs(1, true);

            expect(await usdc.balanceOf(user.address)).to.equal(paymentAmount);
            const heldPayment = await escrow.escrows(1);
            expect(heldPayment.status).to.equal(3); // 3 = Refunded
        });

        it("Should allow an arbiter to resolve a dispute by releasing to contributors", async function () {
            const { escrow, usdc, user, arbiter, treasury, paymentSplitterAddress, assetId, paymentAmount } = await loadFixture(deployEscrowFixture);
            await usdc.connect(user).approve(await escrow.getAddress(), paymentAmount);
            await escrow.connect(user).holdPayment(assetId, user.address, paymentAmount);
            await escrow.connect(user).openDispute(1);

            const fee = (paymentAmount * BigInt(250)) / BigInt(10000);
            const amountToContributors = paymentAmount - fee;
            
            await expect(escrow.connect(arbiter).resolveDispute(1, false)).to.changeTokenBalances(
                usdc,
                [treasury, paymentSplitterAddress],
                [fee, amountToContributors]
            );

            const heldPayment = await escrow.escrows(1);
            expect(heldPayment.status).to.equal(2); // 2 = Released
        });
    });
});
