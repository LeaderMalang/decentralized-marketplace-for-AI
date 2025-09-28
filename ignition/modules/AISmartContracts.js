const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const AISmartContractsModule = buildModule("AISmartContracts", (m) => {
  
  // Parameters for contract deployment
  const usdcAddress = m.getParameter(
    "usdcAddress",
    "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1" // Placeholder USDC address
  );

  // Deploy AssetToken Contract first
  const AssetToken = m.contract("AssetToken", [], { id: "AssetToken" });

  // // Deploy ContributorRegistry Contract (after AssetToken)
  const ContributorRegistry = m.contract("ContributorRegistry", [usdcAddress], { id: "ContributorRegistry", after: [AssetToken] });

  // // Deploy Micro-Lending Contract (after LPE Token)
  // const LPEMicroLending = m.contract("LPEMicroLending", [usdcAddress], { id: "LPEMicroLending", after: [LPEToken] });

  // // Deploy Staking Contract (after LPE Token)
  // const LPEStaking = m.contract("LPEStaking", [LPEToken], { id: "LPEStaking", after: [LPEToken] });

  // // Deploy DAO Contract for dispute resolution (after LPE Token)
  // const LPEDAO = m.contract("LPEDAO", [LPEToken], { id: "LPEDAO", after: [LPEToken] });

  return { AssetToken,ContributorRegistry
    // LPEEscrow, LPEMicroLending, LPEStaking, LPEDAO 
    };
});

module.exports = AISmartContractsModule;
