const {
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RoyaltySplitFactory Contract", function () {
    // We define a fixture to reuse the same setup in every test.
    async function deployFactoryFixture() {
        // Get signers
        const [owner, admin, minter, uriSetter, assetOwner, contributor1, contributor2] = await ethers.getSigners();

        // --- 1. DEPLOY DEPENDENCIES ---
        const AssetToken = await ethers.getContractFactory("AssetToken");
        const assetToken = await AssetToken.deploy(admin.address, minter.address, uriSetter.address, "https://initial.uri/");
        await assetToken.waitForDeployment();

        const ContributorRegistry = await ethers.getContractFactory("ContributorRegistry");
        const contributorRegistry = await ContributorRegistry.deploy(admin.address, admin.address, admin.address);
        await contributorRegistry.waitForDeployment();

        const ProvenanceGraph = await ethers.getContractFactory("ProvenanceGraph");
        const provenanceGraph = await ProvenanceGraph.deploy(await assetToken.getAddress(), await contributorRegistry.getAddress());
        await provenanceGraph.waitForDeployment();

        // --- 2. DEPLOY RoyaltySplitFactory ---
        const RoyaltySplitFactory = await ethers.getContractFactory("RoyaltySplitFactory");
        const royaltySplitFactory = await RoyaltySplitFactory.deploy(await provenanceGraph.getAddress());
        await royaltySplitFactory.waitForDeployment();


        // --- 3. SETUP STATE ---
        // Grant contributor roles
        const CONTRIBUTOR_ROLE = await provenanceGraph.CONTRIBUTOR_ROLE();
        await contributorRegistry.connect(admin).grantRole(CONTRIBUTOR_ROLE, contributor1.address);
        await contributorRegistry.connect(admin).grantRole(CONTRIBUTOR_ROLE, contributor2.address);

        // Mint an asset for our tests (assetId = 1), owned by assetOwner
        const assetId = 1;
        await assetToken.connect(minter).mint(assetOwner.address, assetId, 1, "https://asset1.uri/", "0x");
        
        // Mint another asset for negative tests (assetId = 2)
        const assetIdNoContributors = 2;
        await assetToken.connect(minter).mint(assetOwner.address, assetIdNoContributors, 1, "https://asset2.uri/", "0x");


        // Add edges to the provenance graph for assetId 1
        await provenanceGraph.connect(assetOwner).addContributorEdge(assetId, contributor1.address, 7000); // 70%
        await provenanceGraph.connect(assetOwner).addContributorEdge(assetId, contributor2.address, 3000); // 30%

        return {
            royaltySplitFactory,
            provenanceGraph,
            assetOwner,
            contributor1,
            contributor2,
            assetId,
            assetIdNoContributors
        };
    }

    describe("Deployment", function () {
        it("Should set the correct ProvenanceGraph address", async function () {
            const { royaltySplitFactory, provenanceGraph } = await loadFixture(deployFactoryFixture);
            expect(await royaltySplitFactory.provenanceGraph()).to.equal(await provenanceGraph.getAddress());
        });
        
        it("Should REVERT if ProvenanceGraph address is the zero address", async function () {
            const RoyaltySplitFactory = await ethers.getContractFactory("RoyaltySplitFactory");
            await expect(RoyaltySplitFactory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(RoyaltySplitFactory, "ZeroAddress");
        });
    });

    describe("createSplitter Functionality", function () {
        it("Should REVERT if the asset's graph is not yet finalized", async function () {
            const { royaltySplitFactory, assetId } = await loadFixture(deployFactoryFixture);
            await expect(
                royaltySplitFactory.createSplitter(assetId)
            ).to.be.revertedWithCustomError(royaltySplitFactory, "GraphNotFinalized");
        });

        it("Should successfully create a new PaymentSplitter after the graph is finalized", async function () {
            const { royaltySplitFactory, provenanceGraph, assetOwner, assetId, contributor1, contributor2 } = await loadFixture(deployFactoryFixture);
            
            // Finalize the graph first
            await provenanceGraph.connect(assetOwner).finalize(assetId);

            // Create the splitter and check for the event
            await expect(royaltySplitFactory.createSplitter(assetId))
                .to.emit(royaltySplitFactory, "SplitterCreated")
                .withArgs(
                    assetId,
                    (addr) => ethers.isAddress(addr), // The address of the new splitter
                    [contributor1.address, contributor2.address],
                    [7000, 3000]
                );
                
            // Verify the splitter address is stored
            const splitterAddress = await royaltySplitFactory.assetIdToSplitter(assetId);
            expect(splitterAddress).to.not.equal(ethers.ZeroAddress);
        });

        it("Should set up the new PaymentSplitter with the correct payees and shares", async function () {
            const { royaltySplitFactory, provenanceGraph, assetOwner, assetId, contributor1, contributor2 } = await loadFixture(deployFactoryFixture);
            
            // Finalize and create
            await provenanceGraph.connect(assetOwner).finalize(assetId);
            await royaltySplitFactory.createSplitter(assetId);
            const splitterAddress = await royaltySplitFactory.assetIdToSplitter(assetId);

            // Interact with the newly created splitter contract
            const paymentSplitter = await ethers.getContractAt("PaymentSplitter", splitterAddress);
            
            expect(await paymentSplitter.totalShares()).to.equal(10000);
            expect(await paymentSplitter.payee(0)).to.equal(contributor1.address);
            expect(await paymentSplitter.shares(contributor1.address)).to.equal(7000);
            expect(await paymentSplitter.payee(1)).to.equal(contributor2.address);
            expect(await paymentSplitter.shares(contributor2.address)).to.equal(3000);
        });

        it("Should REVERT if a splitter already exists for the asset", async function () {
            const { royaltySplitFactory, provenanceGraph, assetOwner, assetId } = await loadFixture(deployFactoryFixture);
            
            // Finalize and create once
            await provenanceGraph.connect(assetOwner).finalize(assetId);
            await royaltySplitFactory.createSplitter(assetId);

            // Attempt to create again
            await expect(
                royaltySplitFactory.createSplitter(assetId)
            ).to.be.revertedWithCustomError(royaltySplitFactory, "SplitterAlreadyExists");
        });

        it("Should REVERT if the asset has no contributors", async function () {
            const { royaltySplitFactory, provenanceGraph, assetOwner, assetIdNoContributors } = await loadFixture(deployFactoryFixture);
            
            // Finalize the graph for the asset that has no edges
            await provenanceGraph.connect(assetOwner).finalize(assetIdNoContributors);

            // Attempt to create the splitter
            await expect(
                royaltySplitFactory.createSplitter(assetIdNoContributors)
            ).to.be.revertedWithCustomError(royaltySplitFactory, "NoContributors");
        });
    });
});
