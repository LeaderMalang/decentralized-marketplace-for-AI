const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetToken", function () {
    // We define a fixture to reuse the same setup in every test.
    async function deployAssetTokenFixture() {
        const [owner, defaultAdmin, minter, uriSetter, user1, user2] = await ethers.getSigners();

        const MinterRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
        const UriSetterRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("URI_SETTER_ROLE"));
        const DefaultAdminRole = '0x0000000000000000000000000000000000000000000000000000000000000000';

        const AssetTokenFactory = await ethers.getContractFactory("AssetToken");
        const assetToken = await AssetTokenFactory.deploy(
            defaultAdmin.address,
            minter.address,
            uriSetter.address,
            "https://api.example.com/assets/" // base URI (unused in this implementation)
        );
        await assetToken.deployed();

        return { assetToken, owner, defaultAdmin, minter, uriSetter, user1, user2, MinterRole, UriSetterRole, DefaultAdminRole };
    }
    
    // A second fixture for tests that require a token to be already minted.
    async function deployAndMintFixture() {
        const { assetToken, minter, user1, ...rest } = await loadFixture(deployAssetTokenFixture);
        const tokenId = 1;
        const licenseId = 1;
        const metadataURI = "ipfs://initial_hash";
        
        await assetToken.connect(minter).mint(user1.address, licenseId, metadataURI, "0x");
        
        return { assetToken, minter, user1, tokenId, licenseId, metadataURI, ...rest };
    }


    describe("Deployment and Roles", function () {
        it("Should set the correct roles on deployment", async function () {
            const { assetToken, defaultAdmin, minter, uriSetter, MinterRole, UriSetterRole, DefaultAdminRole } = await loadFixture(deployAssetTokenFixture);
            expect(await assetToken.hasRole(DefaultAdminRole, defaultAdmin.address)).to.be.true;
            expect(await assetToken.hasRole(MinterRole, minter.address)).to.be.true;
            expect(await assetToken.hasRole(UriSetterRole, uriSetter.address)).to.be.true;
        });

        it("Should not grant deployer (owner) any roles unless specified", async function () {
            const { assetToken, owner, MinterRole, UriSetterRole, DefaultAdminRole } = await loadFixture(deployAssetTokenFixture);
            expect(await assetToken.hasRole(DefaultAdminRole, owner.address)).to.be.false;
            expect(await assetToken.hasRole(MinterRole, owner.address)).to.be.false;
            expect(await assetToken.hasRole(UriSetterRole, owner.address)).to.be.false;
        });

        it("DEFAULT_ADMIN_ROLE should be able to grant and revoke roles", async function () {
            const { assetToken, defaultAdmin, user1, MinterRole } = await loadFixture(deployAssetTokenFixture);
            await assetToken.connect(defaultAdmin).grantRole(MinterRole, user1.address);
            expect(await assetToken.hasRole(MinterRole, user1.address)).to.be.true;

            await assetToken.connect(defaultAdmin).revokeRole(MinterRole, user1.address);
            expect(await assetToken.hasRole(MinterRole, user1.address)).to.be.false;
        });

        it("Non-admin users should not be able to grant roles", async function () {
            const { assetToken, user1, user2, MinterRole, DefaultAdminRole } = await loadFixture(deployAssetTokenFixture);
            await expect(
                assetToken.connect(user1).grantRole(MinterRole, user2.address)
            ).to.be.revertedWith(
                `AccessControl: account ${user1.address.toLowerCase()} is missing role ${DefaultAdminRole}`
            );
        });
    });

    describe("Minting", function () {
        it("Should allow an account with MINTER_ROLE to mint a new token", async function () {
            const { assetToken, minter, user1, MinterRole } = await loadFixture(deployAssetTokenFixture);
            const licenseId = 1;
            const metadataURI = "ipfs://somehash";

            await expect(assetToken.connect(minter).mint(user1.address, licenseId, metadataURI, "0x"))
                .to.emit(assetToken, "AssetMinted")
                .withArgs(1, minter.address, user1.address, licenseId, metadataURI);
            
            expect(await assetToken.balanceOf(user1.address, 1)).to.equal(1);
        });

        it("Should not allow an account without MINTER_ROLE to mint", async function () {
            const { assetToken, user1, MinterRole } = await loadFixture(deployAssetTokenFixture);
            await expect(
                assetToken.connect(user1).mint(user1.address, 1, "ipfs://somehash", "0x")
            ).to.be.revertedWith(
                `AccessControl: account ${user1.address.toLowerCase()} is missing role ${MinterRole}`
            );
        });

        it("Should correctly store asset details after minting", async function () {
            const { assetToken, tokenId, licenseId, metadataURI } = await loadFixture(deployAndMintFixture);

            const assetDetails = await assetToken.getAssetDetails(tokenId);
            expect(assetDetails.licenseId).to.equal(licenseId);
            expect(assetDetails.metadataURI).to.equal(metadataURI);
            
            expect(await assetToken.uri(tokenId)).to.equal(metadataURI);
            expect(await assetToken.license(tokenId)).to.equal(licenseId);
        });
    });

    describe("URI Management", function () {
        it("Should allow URI_SETTER_ROLE to update the URI", async function () {
            const { assetToken, uriSetter, tokenId } = await loadFixture(deployAndMintFixture);
            const newURI = "ipfs://new_hash";

            await expect(assetToken.connect(uriSetter).setURI(tokenId, newURI))
                .to.emit(assetToken, "URIUpdated")
                .withArgs(tokenId, newURI);

            expect(await assetToken.uri(tokenId)).to.equal(newURI);
        });

        it("Should not allow other roles to update the URI", async function () {
            const { assetToken, minter, tokenId, UriSetterRole } = await loadFixture(deployAndMintFixture);
             await expect(
                assetToken.connect(minter).setURI(tokenId, "ipfs://new_hash")
            ).to.be.revertedWith(
                `AccessControl: account ${minter.address.toLowerCase()} is missing role ${UriSetterRole}`
            );
        });

        it("Should revert when trying to set URI for a nonexistent token", async function () {
            const { assetToken, uriSetter } = await loadFixture(deployAssetTokenFixture);
            await expect(
                assetToken.connect(uriSetter).setURI(999, "ipfs://new_hash")
            ).to.be.revertedWith("AssetToken: URI set for nonexistent token");
        });
    });

    describe("License Management", function () {
        it("Should allow DEFAULT_ADMIN_ROLE to update the license", async function () {
            const { assetToken, defaultAdmin, tokenId } = await loadFixture(deployAndMintFixture);
            const newLicense = 2;
            
            await expect(assetToken.connect(defaultAdmin).setLicense(tokenId, newLicense))
                .to.emit(assetToken, "LicenseUpdated")
                .withArgs(tokenId, newLicense);

            expect(await assetToken.license(tokenId)).to.equal(newLicense);
        });

        it("Should not allow other roles to update the license", async function () {
             const { assetToken, minter, tokenId, DefaultAdminRole } = await loadFixture(deployAndMintFixture);
             await expect(
                assetToken.connect(minter).setLicense(tokenId, 2)
            ).to.be.revertedWith(
                `AccessControl: account ${minter.address.toLowerCase()} is missing role ${DefaultAdminRole}`
            );
        });

        it("Should revert when trying to set license for a nonexistent token", async function () {
            const { assetToken, defaultAdmin } = await loadFixture(deployAssetTokenFixture);
            await expect(
                assetToken.connect(defaultAdmin).setLicense(999, 2)
            ).to.be.revertedWith("AssetToken: License update for nonexistent token");
        });
    });

    describe("View Functions for Nonexistent Tokens", function() {
        it("uri() should revert for nonexistent token", async function() {
            const { assetToken } = await loadFixture(deployAssetTokenFixture);
            await expect(assetToken.uri(999)).to.be.revertedWith("AssetToken: URI query for nonexistent token");
        });
         it("license() should revert for nonexistent token", async function() {
            const { assetToken } = await loadFixture(deployAssetTokenFixture);
            await expect(assetToken.license(999)).to.be.revertedWith("AssetToken: License query for nonexistent token");
        });
         it("getAssetDetails() should revert for nonexistent token", async function() {
            const { assetToken } = await loadFixture(deployAssetTokenFixture);
            await expect(assetToken.getAssetDetails(999)).to.be.revertedWith("AssetToken: Details query for nonexistent token");
        });
    });
});

