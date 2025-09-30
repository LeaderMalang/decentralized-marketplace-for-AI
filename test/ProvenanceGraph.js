const {
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProvenanceGraph Contract", function () {
    // We define a fixture to reuse the same setup in every test.
    async function deployProvenanceGraphFixture() {
        // Get signers
        const [owner, admin, minter, uriSetter, user1, user2, contributor1, contributor2] = await ethers.getSigners();

        // --- 1. DEPLOY AssetToken ---
        const AssetToken = await ethers.getContractFactory("AssetToken");
        const assetToken = await AssetToken.deploy(
            admin.address,      // defaultAdmin
            minter.address,     // minter
            uriSetter.address,  // uriSetter
            "https://initial.uri/" // initialBaseURI
        );
        await assetToken.waitForDeployment();

        // --- 2. DEPLOY ContributorRegistry ---
        const ContributorRegistry = await ethers.getContractFactory("ContributorRegistry");
        const contributorRegistry = await ContributorRegistry.deploy(
            admin.address,      // defaultAdmin
            admin.address,      // roleAdmin
            admin.address       // pauser
        );
        await contributorRegistry.waitForDeployment();

        // --- 3. DEPLOY ProvenanceGraph ---
        const ProvenanceGraph = await ethers.getContractFactory("ProvenanceGraph");
        const provenanceGraph = await ProvenanceGraph.deploy(
            await assetToken.getAddress(),
            await contributorRegistry.getAddress()
        );
        await provenanceGraph.waitForDeployment();

        // --- 4. SETUP ROLES & ASSETS ---
        // Grant CONTRIBUTOR_ROLE to our test contributors
        const CONTRIBUTOR_ROLE = await provenanceGraph.CONTRIBUTOR_ROLE();
        await contributorRegistry.connect(admin).grantRole(CONTRIBUTOR_ROLE, contributor1.address);
        await contributorRegistry.connect(admin).grantRole(CONTRIBUTOR_ROLE, contributor2.address);

        // Mint a test asset (assetId 1) owned by user1
        await assetToken.connect(minter).mint(user1.address, 1, 1, "https://asset1.uri/", "0x");
        // Mint a parent asset (assetId 2) owned by user2
        await assetToken.connect(minter).mint(user2.address, 2, 1, "https://asset2.uri/", "0x");


        return {
            provenanceGraph,
            assetToken,
            contributorRegistry,
            owner,
            admin,
            minter,
            user1,
            user2,
            contributor1,
            contributor2,
            CONTRIBUTOR_ROLE
        };
    }

    describe("Deployment", function () {
        it("Should set the correct AssetToken and ContributorRegistry addresses", async function () {
            const { provenanceGraph, assetToken, contributorRegistry } = await loadFixture(deployProvenanceGraphFixture);
            expect(await provenanceGraph.assetToken()).to.equal(await assetToken.getAddress());
            expect(await provenanceGraph.contributorRegistry()).to.equal(await contributorRegistry.getAddress());
        });
    });

    describe("Edge Management", function () {
        describe("addContributorEdge", function () {
            it("Should allow asset owner to add a contributor edge", async function () {
                const { provenanceGraph, user1, contributor1 } = await loadFixture(deployProvenanceGraphFixture);
                const assetId = 1;
                const weightBps = 5000; // 50%

                await expect(provenanceGraph.connect(user1).addContributorEdge(assetId, contributor1.address, weightBps))
                    .to.emit(provenanceGraph, "ContributorEdgeAdded")
                    .withArgs(assetId, contributor1.address, weightBps);

                const edges = await provenanceGraph.getContributorEdges(assetId);
                expect(edges.length).to.equal(1);
                expect(edges[0].contributor).to.equal(contributor1.address);
                expect(edges[0].weightBps).to.equal(weightBps);
                expect(await provenanceGraph.getTotalBpsAllocated(assetId)).to.equal(weightBps);
            });

            it("Should REVERT if caller is not the asset owner", async function () {
                const { provenanceGraph, user2, contributor1 } = await loadFixture(deployProvenanceGraphFixture);
                await expect(
                    provenanceGraph.connect(user2).addContributorEdge(1, contributor1.address, 5000)
                ).to.be.revertedWithCustomError(provenanceGraph, "NotAssetOwner");
            });

            it("Should REVERT if weight is invalid (0 or > 10000)", async function () {
                const { provenanceGraph, user1, contributor1 } = await loadFixture(deployProvenanceGraphFixture);
                await expect(
                    provenanceGraph.connect(user1).addContributorEdge(1, contributor1.address, 0)
                ).to.be.revertedWithCustomError(provenanceGraph, "InvalidWeight");
                await expect(
                    provenanceGraph.connect(user1).addContributorEdge(1, contributor1.address, 10001)
                ).to.be.revertedWithCustomError(provenanceGraph, "InvalidWeight");
            });

            it("Should REVERT if total weight exceeds 10000 bps", async function () {
                const { provenanceGraph, user1, contributor1, contributor2 } = await loadFixture(deployProvenanceGraphFixture);
                await provenanceGraph.connect(user1).addContributorEdge(1, contributor1.address, 6000);
                await expect(
                    provenanceGraph.connect(user1).addContributorEdge(1, contributor2.address, 4001)
                ).to.be.revertedWithCustomError(provenanceGraph, "TotalWeightExceeded");
            });

             it("Should REVERT if the address is not a registered contributor", async function () {
                const { provenanceGraph, user1, user2 } = await loadFixture(deployProvenanceGraphFixture);
                // user2 does not have CONTRIBUTOR_ROLE
                await expect(
                    provenanceGraph.connect(user1).addContributorEdge(1, user2.address, 2000)
                ).to.be.revertedWithCustomError(provenanceGraph, "NotAContributor");
             });
        });

        describe("addParentEdge", function () {
            it("Should allow asset owner to add a parent edge", async function () {
                const { provenanceGraph, user1 } = await loadFixture(deployProvenanceGraphFixture);
                const childAssetId = 1;
                const parentAssetId = 2;
                const weightBps = 3000; // 30%

                await expect(provenanceGraph.connect(user1).addParentEdge(childAssetId, parentAssetId, weightBps))
                    .to.emit(provenanceGraph, "ParentEdgeAdded")
                    .withArgs(childAssetId, parentAssetId, weightBps);

                const edges = await provenanceGraph.getParentEdges(childAssetId);
                expect(edges.length).to.equal(1);
                expect(edges[0].parentAssetId).to.equal(parentAssetId);
                expect(edges[0].weightBps).to.equal(weightBps);
            });

            it("Should REVERT if parent asset does not exist", async function () {
                 const { provenanceGraph, user1 } = await loadFixture(deployProvenanceGraphFixture);
                 const nonExistentAssetId = 999;
                 await expect(
                     provenanceGraph.connect(user1).addParentEdge(1, nonExistentAssetId, 3000)
                 ).to.be.revertedWithCustomError(provenanceGraph, "AssetDoesNotExist");
            });
        });
    });

    describe("Graph Finalization", function () {
        it("Should allow the asset owner to finalize the graph", async function () {
            const { provenanceGraph, user1, contributor1 } = await loadFixture(deployProvenanceGraphFixture);
            const assetId = 1;
            await provenanceGraph.connect(user1).addContributorEdge(assetId, contributor1.address, 8000);

            await expect(provenanceGraph.connect(user1).finalize(assetId))
                .to.emit(provenanceGraph, "GraphFinalized")
                .withArgs(assetId);

            expect(await provenanceGraph.isFinalized(assetId)).to.be.true;
        });

        it("Should REVERT if trying to add an edge after finalization", async function () {
            const { provenanceGraph, user1, contributor1, contributor2 } = await loadFixture(deployProvenanceGraphFixture);
            const assetId = 1;
            await provenanceGraph.connect(user1).addContributorEdge(assetId, contributor1.address, 8000);
            await provenanceGraph.connect(user1).finalize(assetId);

            await expect(
                provenanceGraph.connect(user1).addContributorEdge(assetId, contributor2.address, 1000)
            ).to.be.revertedWithCustomError(provenanceGraph, "GraphIsFinalized");
        });

        it("Should REVERT if a non-owner tries to finalize", async function () {
            const { provenanceGraph, user2 } = await loadFixture(deployProvenanceGraphFixture);
            await expect(
                provenanceGraph.connect(user2).finalize(1)
            ).to.be.revertedWithCustomError(provenanceGraph, "NotAssetOwner");
        });

        it("Should REVERT if trying to finalize twice", async function () {
            const { provenanceGraph, user1 } = await loadFixture(deployProvenanceGraphFixture);
            await provenanceGraph.connect(user1).finalize(1);
            await expect(
                provenanceGraph.connect(user1).finalize(1)
            ).to.be.revertedWithCustomError(provenanceGraph, "GraphIsFinalized");
        });
    });
});
