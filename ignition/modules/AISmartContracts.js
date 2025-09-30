const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const AISmartContractsModule = buildModule("AISmartContracts", (m) => {
  
  // Parameters for contract deployment
  // const usdcAddress = m.getParameter(
  //   "usdcAddress",
  //   "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1" // Placeholder USDC address
  // );
  const defaultAdmin = m.getParameter(
    "defaultAdmin",
    "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1" // Placeholder USDC address
  );
  const roleAdmin = m.getParameter(
    "roleAdmin",
    "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1" // Placeholder USDC address
  );
  const pauser = m.getParameter(
    "pauser",
    "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1" // Placeholder USDC address
  );
  const uriSetter = m.getParameter(
    "uriSetter",
    "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1" // Placeholder USDC address
  );
  const minter = m.getParameter(
    "minter",
    "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1" // Placeholder USDC address
  );
  const initialURI = m.getParameter(
    "initialURI",
    "https://someasset.com" // Placeholder USDC address
  );
  // Deploy AssetToken Contract first
  const AssetToken = m.contract("AssetToken", [defaultAdmin,minter,uriSetter,initialURI], { id: "AssetToken" });

  // // Deploy ContributorRegistry Contract (after AssetToken)
  const ContributorRegistry = m.contract("ContributorRegistry", [defaultAdmin,roleAdmin,pauser], { id: "ContributorRegistry", after: [AssetToken] });

  // // Deploy ProvenanceGraph Contract (after ContributorRegistry)
  const ProvenanceGraph = m.contract("ProvenanceGraph", [AssetToken,ContributorRegistry], { id: "ProvenanceGraph", after: [ContributorRegistry] });

 

  return { AssetToken,ContributorRegistry,ProvenanceGraph
    
    };
});

module.exports = AISmartContractsModule;
