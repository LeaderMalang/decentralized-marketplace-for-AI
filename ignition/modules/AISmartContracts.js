const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

// --- IMPORTANT: Replace this with the address of the Safe multisig you create ---
const SAFE_ADDRESS = "0x51C2E4c6Bd7202FD1943E9bA6711735dAdBcD52E";

const AISmartContractsModule = buildModule("AISmartContracts", (m) => {
  // --- Parameters for Roles ---
  // All powerful roles default to the single Safe multisig address for secure, committee-based governance.
  const defaultAdmin = m.getParameter("defaultAdmin", SAFE_ADDRESS);
  const roleAdmin = m.getParameter("roleAdmin", SAFE_ADDRESS);
  const pauser = m.getParameter("pauser", SAFE_ADDRESS);
  const uriSetter = m.getParameter("uriSetter", SAFE_ADDRESS);
  const arbiter = m.getParameter("arbiter", SAFE_ADDRESS); // For resolving escrow disputes
  
  // These roles might be delegated to more specific, automated addresses.
  const verifier = m.getParameter("verifier", "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1");
  const minter = m.getParameter("minter", "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1");

  // --- Parameters for Contracts ---
  const usdcAddress = m.getParameter(
     "usdcAddress",
     "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // Mainnet USDC address (replace for testnets)
   );
  const treasuryMultisig = m.getParameter("treasuryMultisig", SAFE_ADDRESS); // The platform's treasury is the Safe
  const initialFeeBps = m.getParameter("initialFeeBps", 250); // 2.5% protocol fee
  const disputeWindowSeconds = m.getParameter("disputeWindowSeconds", 3 * 24 * 60 * 60); // 3 days
  const initialURI = m.getParameter("initialURI", "https://api.yourplatform.com/assets/{id}");
  const eip712Name = m.getParameter("eip712Name", "AIUsageReceipts");
  const eip712Version = m.getParameter("eip712Version", "1");

  // --- Contract Deployment Order ---

  const AssetToken = m.contract("AssetToken", [defaultAdmin, minter, uriSetter, initialURI], { id: "AssetToken" });

  const ContributorRegistry = m.contract("ContributorRegistry", [defaultAdmin, roleAdmin, pauser], { id: "ContributorRegistry", after: [AssetToken] });

  const ProvenanceGraph = m.contract("ProvenanceGraph", [AssetToken, ContributorRegistry], { id: "ProvenanceGraph", after: [ContributorRegistry] });

  const RoyaltySplitFactory = m.contract("RoyaltySplitFactory", [ProvenanceGraph], { id: "RoyaltySplitFactory", after: [ProvenanceGraph] });
  
  const FeeTreasury = m.contract("FeeTreasury", [defaultAdmin, treasuryMultisig, initialFeeBps], { id: "FeeTreasury" });

  const Escrow = m.contract("Escrow", [usdcAddress, FeeTreasury, RoyaltySplitFactory, defaultAdmin, pauser, arbiter, disputeWindowSeconds], { id: "Escrow", after: [RoyaltySplitFactory, FeeTreasury] });

  const UsageReceiptVerifier = m.contract("UsageReceiptVerifier", [
      eip712Name,
      eip712Version,
      usdcAddress,
      Escrow, // Payments now go to the Escrow contract
      defaultAdmin,
      verifier,
      pauser
    ], { id: "UsageReceiptVerifier", after: [Escrow] }
  );
  
  const RegistryRouter = m.contract("RegistryRouter", [AssetToken, ContributorRegistry, ProvenanceGraph, RoyaltySplitFactory], { id: "RegistryRouter", after: [RoyaltySplitFactory] });

  // Return all deployed contracts for easy access and verification
  return { 
    AssetToken, 
    ContributorRegistry, 
    ProvenanceGraph, 
    RoyaltySplitFactory, 
    FeeTreasury,
    Escrow,
    UsageReceiptVerifier,
    RegistryRouter
  };
});

module.exports = AISmartContractsModule;

