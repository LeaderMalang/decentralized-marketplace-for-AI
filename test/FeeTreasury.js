const {
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FeeTreasury Contract", function () {
    async function deployFeeTreasuryFixture() {
        const [owner, admin, treasury, newTreasury, otherAccount] = await ethers.getSigners();

        const initialFeeBps = 250; // 2.5%

        const FeeTreasury = await ethers.getContractFactory("FeeTreasury");
        const feeTreasury = await FeeTreasury.deploy(admin.address, treasury.address, initialFeeBps);
        await feeTreasury.waitForDeployment();

        return { feeTreasury, admin, treasury, newTreasury, otherAccount, initialFeeBps };
    }

    describe("Deployment", function () {
        it("Should set the correct admin and treasury address", async function () {
            const { feeTreasury, admin, treasury } = await loadFixture(deployFeeTreasuryFixture);
            const ADMIN_ROLE = await feeTreasury.ADMIN_ROLE();
            expect(await feeTreasury.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
            expect(await feeTreasury.treasuryMultisig()).to.equal(treasury.address);
        });

        it("Should set the correct initial fee", async function () {
            const { feeTreasury, initialFeeBps } = await loadFixture(deployFeeTreasuryFixture);
            expect(await feeTreasury.feeBps()).to.equal(initialFeeBps);
        });
    });

    describe("Administrative Functions", function () {
        describe("setFeeBps", function () {
            it("Should allow the admin to set a new fee", async function () {
                const { feeTreasury, admin } = await loadFixture(deployFeeTreasuryFixture);
                const newFee = 500; // 5%
                await expect(feeTreasury.connect(admin).setFeeBps(newFee))
                    .to.emit(feeTreasury, "FeeUpdated")
                    .withArgs(newFee);
                expect(await feeTreasury.feeBps()).to.equal(newFee);
            });

            it("Should REVERT if a non-admin tries to set a new fee", async function () {
                const { feeTreasury, otherAccount } = await loadFixture(deployFeeTreasuryFixture);
                const ADMIN_ROLE = await feeTreasury.ADMIN_ROLE();
                await expect(
                    feeTreasury.connect(otherAccount).setFeeBps(500)
                ).to.be.revertedWith(`AccessControl: account ${otherAccount.address.toLowerCase()} is missing role ${ADMIN_ROLE.toLowerCase()}`);
            });

            it("Should REVERT if the new fee exceeds the maximum allowed fee", async function () {
                const { feeTreasury, admin } = await loadFixture(deployFeeTreasuryFixture);
                const highFee = 1001; // 10.01%, max is 10%
                await expect(
                    feeTreasury.connect(admin).setFeeBps(highFee)
                ).to.be.revertedWithCustomError(feeTreasury, "FeeTooHigh");
            });
        });

        describe("setTreasuryMultisig", function () {
            it("Should allow the admin to set a new treasury address", async function () {
                const { feeTreasury, admin, newTreasury } = await loadFixture(deployFeeTreasuryFixture);
                await expect(feeTreasury.connect(admin).setTreasuryMultisig(newTreasury.address))
                    .to.emit(feeTreasury, "TreasuryUpdated")
                    .withArgs(newTreasury.address);
                expect(await feeTreasury.treasuryMultisig()).to.equal(newTreasury.address);
            });

            it("Should REVERT if a non-admin tries to set a new treasury address", async function () {
                const { feeTreasury, otherAccount, newTreasury } = await loadFixture(deployFeeTreasuryFixture);
                 const ADMIN_ROLE = await feeTreasury.ADMIN_ROLE();
                await expect(
                    feeTreasury.connect(otherAccount).setTreasuryMultisig(newTreasury.address)
                ).to.be.revertedWith(`AccessControl: account ${otherAccount.address.toLowerCase()} is missing role ${ADMIN_ROLE.toLowerCase()}`);
            });

            it("Should REVERT if the new treasury address is the zero address", async function () {
                const { feeTreasury, admin } = await loadFixture(deployFeeTreasuryFixture);
                await expect(
                    feeTreasury.connect(admin).setTreasuryMultisig(ethers.ZeroAddress)
                ).to.be.revertedWithCustomError(feeTreasury, "ZeroAddress");
            });
        });
    });
});
