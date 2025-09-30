// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAssetToken
 * @dev Interface for the AssetToken contract.
 * Used by other contracts to interact with asset tokens without needing the full ABI.
 */
interface IAssetToken {
    /**
     * @dev Returns the owner of the `_tokenId` token.
     */
    function ownerOf(uint256 _tokenId) external view returns (address owner);

    /**
     * @dev Returns true if the `_tokenId` exists.
     */
    function exists(uint256 _tokenId) external view returns (bool);
}
