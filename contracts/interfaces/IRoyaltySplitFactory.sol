// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRoyaltySplitFactory Interface
 * @notice Defines the external functions for the RoyaltySplitFactory contract
 * that other contracts can interact with.
 */
interface IRoyaltySplitFactory {
    /**
     * @notice Returns the address of the PaymentSplitter contract created for a specific asset.
     * @param _assetId The ID of the asset.
     * @return The address of the deployed PaymentSplitter for that asset. Returns the zero
     * address if a splitter has not been created for the assetId.
     */
    function assetIdToSplitter(uint256 _assetId) external view returns (address);
}
