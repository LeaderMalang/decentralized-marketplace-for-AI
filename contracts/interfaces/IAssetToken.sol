// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAssetToken Interface
 * @notice Defines the external functions for the AssetToken contract needed by the RegistryRouter.
 */
interface IAssetToken {
    /**
     * @notice Returns the URI for a specific asset's metadata.
     */
    function uri(uint256 _assetId) external view returns (string memory);

    /**
     * @notice Returns the license identifier for a specific asset.
     */
    function licenseId(uint256 _assetId) external view returns (uint256);

    /**
     * @notice Returns the single owner of a specific asset.
     * @dev This is a custom function for router compatibility.
     */
    function ownerOf(uint256 _assetId) external view returns (address);
}

