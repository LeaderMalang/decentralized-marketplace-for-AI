// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IProvenanceGraph Interface
 * @notice Defines the external functions and data structures for the ProvenanceGraph contract.
 */
interface IProvenanceGraph {
    /**
     * @notice Represents a link in the provenance graph.
     * @param target The address of the contributor or the parent asset's contract.
     * @param weightBps The share allocated to the target in basis points (1/10000).
     */
    struct Edge {
        address target;
        uint16 weightBps;
    }

    /**
     * @notice Checks if the provenance graph for a given asset has been finalized.
     * @param _assetId The ID of the asset.
     * @return True if the graph is finalized, false otherwise.
     */
    function isFinalized(uint256 _assetId) external view returns (bool);

    /**
     * @notice Retrieves all contributor edges for a given asset.
     * @param _assetId The ID of the asset.
     * @return An array of Edge structs representing the contributors.
     */
    function getContributorEdges(uint256 _assetId) external view returns (Edge[] memory);

    /**
     * @notice Retrieves all parent asset edges for a given asset.
     * @param _assetId The ID of the asset.
     * @return An array of Edge structs representing the parent assets.
     */
    function getParentEdges(uint256 _assetId) external view returns (Edge[] memory);
}

