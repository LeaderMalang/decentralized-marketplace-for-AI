// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IProvenanceGraph
 * @dev Interface for the ProvenanceGraph contract.
 */
interface IProvenanceGraph {
    // A struct to mirror the ContributorEdge in the main contract
    struct ContributorEdge {
        address contributor;
        uint16 weightBps;
    }

    /**
     * @notice Returns true if the graph for a given asset has been finalized.
     */
    function isFinalized(uint256 _assetId) external view returns (bool);

    /**
     * @notice Retrieves all contributor edges for a given asset.
     */
    function getContributorEdges(uint256 _assetId) external view returns (ContributorEdge[] memory);
}
