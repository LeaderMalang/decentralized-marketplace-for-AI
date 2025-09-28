const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ContributorRegistry", function () {
    // We define a fixture to reuse the same setup in every test.
    async function deployContributorRegistryFixture() {
        const [owner, defaultAdmin, roleAdmin, pauser, user1, user2] = await ethers.getSigners();

        const RoleAdminRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_ADMIN"));
        const PauserRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PAUSER_ROLE"));
        const DefaultAdminRole = '0x0000000000000000000000000000000000000000000000000000000000000000';

        const ContributorRegistryFactory = await ethers.getContractFactory("ContributorRegistry");
        const registry = await ContributorRegistryFactory.deploy(
            defaultAdmin.address,
            roleAdmin.address,
            pauser.address
        );
        await registry.deployed();

        return { registry, owner, defaultAdmin, roleAdmin, pauser, user1, user2, RoleAdminRole, PauserRole, DefaultAdminRole };
    }

    describe("Deployment and Admin Roles", function () {
        it("Should set the correct admin roles on deployment", async function () {
            const { registry, defaultAdmin, roleAdmin, pauser, RoleAdminRole, PauserRole, DefaultAdminRole } = await loadFixture(deployContributorRegistryFixture);

            expect(await registry.hasRole(DefaultAdminRole, defaultAdmin.address)).to.be.true;
            expect(await registry.hasRole(RoleAdminRole, roleAdmin.address)).to.be.true;
            expect(await registry.hasRole(PauserRole, pauser.address)).to.be.true;
        });

        it("DEFAULT_ADMIN_ROLE should be able to grant and revoke admin roles", async function () {
            const { registry, defaultAdmin, user1, RoleAdminRole } = await loadFixture(deployContributorRegistryFixture);

            await registry.connect(defaultAdmin).grantRole(RoleAdminRole, user1.address);
            expect(await registry.hasRole(RoleAdminRole, user1.address)).to.be.true;

            await registry.connect(defaultAdmin).revokeRole(RoleAdminRole, user1.address);
            expect(await registry.hasRole(RoleAdminRole, user1.address)).to.be.false;
        });

        it("Non-admin users should not be able to grant admin roles", async function () {
            const { registry, user1, user2, RoleAdminRole, DefaultAdminRole } = await loadFixture(deployContributorRegistryFixture);
            await expect(
                registry.connect(user1).grantRole(RoleAdminRole, user2.address)
            ).to.be.revertedWith(
                `AccessControl: account ${user1.address.toLowerCase()} is missing role ${DefaultAdminRole}`
            );
        });
    });

    describe("Profile Management", function () {
        const profileURI = "ipfs://profile_hash";

        it("Should allow any user to set their profile URI", async function () {
            const { registry, user1 } = await loadFixture(deployContributorRegistryFixture);
            
            await expect(registry.connect(user1).setProfileURI(profileURI))
                .to.emit(registry, "ProfileUpdated")
                .withArgs(user1.address, profileURI);

            const profile = await registry.getProfile(user1.address);
            expect(profile.metadataURI).to.equal(profileURI);
            expect(profile.isRegistered).to.be.true;
        });

        it("Should allow a user to update their profile URI", async function () {
            const { registry, user1 } = await loadFixture(deployContributorRegistryFixture);
            const newProfileURI = "ipfs://new_profile_hash";

            await registry.connect(user1).setProfileURI(profileURI); // First set
            await registry.connect(user1).setProfileURI(newProfileURI); // Then update

            const profile = await registry.getProfile(user1.address);
            expect(profile.metadataURI).to.equal(newProfileURI);
        });
    });

    describe("Ecosystem Role Management", function () {
        const AnnotatorRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ANNOTATOR_ROLE"));

        it("Should allow ROLE_ADMIN to grant an ecosystem role", async function () {
            const { registry, roleAdmin, user1 } = await loadFixture(deployContributorRegistryFixture);

            await expect(registry.connect(roleAdmin).grantRole(AnnotatorRole, user1.address))
                .to.emit(registry, "RoleGranted")
                .withArgs(AnnotatorRole, user1.address, roleAdmin.address);

            expect(await registry.hasRole(AnnotatorRole, user1.address)).to.be.true;
        });

        it("Should allow ROLE_ADMIN to revoke an ecosystem role", async function () {
            const { registry, roleAdmin, user1 } = await loadFixture(deployContributorRegistryFixture);
            await registry.connect(roleAdmin).grantRole(AnnotatorRole, user1.address);
            
            await expect(registry.connect(roleAdmin).revokeRole(AnnotatorRole, user1.address))
                .to.emit(registry, "RoleRevoked")
                .withArgs(AnnotatorRole, user1.address, roleAdmin.address);

            expect(await registry.hasRole(AnnotatorRole, user1.address)).to.be.false;
        });
        
        it("Should not allow an account without ROLE_ADMIN to grant roles", async function () {
             const { registry, user1, user2, RoleAdminRole } = await loadFixture(deployContributorRegistryFixture);
             await expect(
                registry.connect(user1).grantRole(AnnotatorRole, user2.address)
            ).to.be.revertedWith(
                `AccessControl: account ${user1.address.toLowerCase()} is missing role ${RoleAdminRole}`
            );
        });

        it("Should not allow an account without ROLE_ADMIN to revoke roles", async function () {
             const { registry, roleAdmin, user1, user2, RoleAdminRole } = await loadFixture(deployContributorRegistryFixture);
             await registry.connect(roleAdmin).grantRole(AnnotatorRole, user2.address);
             
             await expect(
                registry.connect(user1).revokeRole(AnnotatorRole, user2.address)
            ).to.be.revertedWith(
                `AccessControl: account ${user1.address.toLowerCase()} is missing role ${RoleAdminRole}`
            );
        });
    });

    describe("Pausable Functionality", function () {
        it("Should allow PAUSER_ROLE to pause and unpause the contract", async function () {
            const { registry, pauser } = await loadFixture(deployContributorRegistryFixture);
            
            await expect(registry.connect(pauser).pause()).to.emit(registry, "Paused").withArgs(pauser.address);
            expect(await registry.paused()).to.be.true;
            
            await expect(registry.connect(pauser).unpause()).to.emit(registry, "Unpaused").withArgs(pauser.address);
            expect(await registry.paused()).to.be.false;
        });

        it("Should not allow non-PAUSER_ROLE to pause or unpause", async function () {
            const { registry, user1, PauserRole } = await loadFixture(deployContributorRegistryFixture);
            
            await expect(registry.connect(user1).pause()).to.be.revertedWith(
                `AccessControl: account ${user1.address.toLowerCase()} is missing role ${PauserRole}`
            );
            
            await registry.connect(pauser).pause(); // Pause it first
            await expect(registry.connect(user1).unpause()).to.be.revertedWith(
                `AccessControl: account ${user1.address.toLowerCase()} is missing role ${PauserRole}`
            );
        });
        
        it("Should prevent state-changing functions from being called while paused", async function () {
            const { registry, pauser, roleAdmin, user1 } = await loadFixture(deployContributorRegistryFixture);
            await registry.connect(pauser).pause();

            const AnnotatorRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ANNOTATOR_ROLE"));

            await expect(registry.connect(user1).setProfileURI("ipfs://...")).to.be.revertedWith("Pausable: paused");
            await expect(registry.connect(roleAdmin).grantRole(AnnotatorRole, user1.address)).to.be.revertedWith("Pausable: paused");
            await expect(registry.connect(roleAdmin).revokeRole(AnnotatorRole, user1.address)).to.be.revertedWith("Pausable: paused");
        });
    });
});
