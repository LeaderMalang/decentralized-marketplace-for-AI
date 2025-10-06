const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const AISmartContractsModule = buildModule("AISmartContracts", (m) => {
  // --- Parameters for Roles ---
  const defaultAdmin = m.getParameter(
    "defaultAdmin",
    "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1" // Placeholder defaultAdmin address
  );
  const roleAdmin = m.getParameter(
    "roleAdmin",
    "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1" // Placeholder roleAdmin address
  );
  const pauser = m.getParameter(
    "pauser",
    "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1" // Placeholder pauser address
  );
  const uriSetter = m.getParameter(
    "uriSetter",
    "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1" // Placeholder uriSetter address
  );
  const minter = m.getParameter(
    "minter",
    "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1" // Placeholder minter address
  );
   const verifier = m.getParameter(
    "verifier",
    "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1" // Placeholder verifier address
  );

  // --- Parameters for Contracts ---
   const usdcAddress = m.getParameter(
     "usdcAddress",
     "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // Mainnet USDC address
   );
  const initialURI = m.getParameter(
    "initialURI",
    "https://someasset.com" // Placeholder initialURI
  );
  const eip712Name = m.getParameter("eip712Name", "AIUsageReceipts");
  const eip712Version = m.getParameter("eip712Version", "1");


  // --- Contract Deployments ---

  // Deploy AssetToken Contract first
  const AssetToken = m.contract("AssetToken", [defaultAdmin, minter, uriSetter, initialURI], { id: "AssetToken" });

  // Deploy ContributorRegistry Contract
  const ContributorRegistry = m.contract("ContributorRegistry", [defaultAdmin, roleAdmin, pauser], { id: "ContributorRegistry", after: [AssetToken] });

  // Deploy ProvenanceGraph Contract
  const ProvenanceGraph = m.contract("ProvenanceGraph", [AssetToken, ContributorRegistry], { id: "ProvenanceGraph", after: [ContributorRegistry] });

  // Deploy RoyaltySplitFactory Contract
  const RoyaltySplitFactory = m.contract("RoyaltySplitFactory", [ProvenanceGraph], { id: "RoyaltySplitFactory", after: [ProvenanceGraph] });

  // Deploy UsageReceiptVerifier Contract
  const UsageReceiptVerifier = m.contract("UsageReceiptVerifier", [
      eip712Name,
      eip712Version,
      usdcAddress,
      RoyaltySplitFactory, // Pass the contract future directly
      defaultAdmin,
      verifier,
      pauser
    ], { id: "UsageReceiptVerifier", after: [RoyaltySplitFactory] }
  );

  // Return all deployed contracts
  return { AssetToken, ContributorRegistry, ProvenanceGraph, RoyaltySplitFactory, UsageReceiptVerifier };
});

module.exports = AISmartContractsModule;
