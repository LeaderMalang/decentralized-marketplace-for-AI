// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/finance/PaymentSplitter.sol";
import "./interfaces/IProvenanceGraph.sol";

/**
 * @title RoyaltySplitFactory
 * @author Hassan Ali
 * @notice A factory contract that deploys a unique PaymentSplitter for each finalized asset.
 * This contract reads provenance data to create on-chain royalty distribution mechanisms.
 */
contract RoyaltySplitFactory {
    // --- State Variables ---

    IProvenanceGraph public immutable provenanceGraph;

    // Mapping from an asset's token ID to its deployed PaymentSplitter contract address
    mapping(uint256 => address) public assetIdToSplitter;

    // --- Events ---

    event SplitterCreated(uint256 indexed assetId, address indexed splitterAddress, address[] payees, uint256[] shares);

    // --- Errors ---

    error GraphNotFinalized(uint256 assetId);
    error SplitterAlreadyExists(uint256 assetId);
    error NoContributors(uint256 assetId);
    error ZeroAddress();

    // --- Constructor ---

    constructor(address _provenanceGraphAddress) {
        if (_provenanceGraphAddress == address(0)) revert ZeroAddress();
        provenanceGraph = IProvenanceGraph(_provenanceGraphAddress);
    }

    // --- Public & External Functions ---

    /**
     * @notice Deploys a new PaymentSplitter contract for a given asset.
     * @dev Reads contributor data from the finalized ProvenanceGraph for the asset.
     * Can be called by anyone, but only once per finalized asset.
     * @param _assetId The token ID of the asset for which to create a splitter.
     * @return splitterAddress The address of the newly deployed PaymentSplitter contract.
     */
    function createSplitter(uint256 _assetId) external returns (address splitterAddress) {
        // 1. VERIFY: Ensure the graph is finalized and a splitter doesn't already exist.
        if (!provenanceGraph.isFinalized(_assetId)) revert GraphNotFinalized(_assetId);
        if (assetIdToSplitter[_assetId] != address(0)) revert SplitterAlreadyExists(_assetId);

        // 2. RETRIEVE: Get the contributor data from the provenance graph.
        IProvenanceGraph.ContributorEdge[] memory edges = provenanceGraph.getContributorEdges(_assetId);
        if (edges.length == 0) revert NoContributors(_assetId);

        // 3. PREPARE: Format the data for the PaymentSplitter constructor.
        address[] memory payees = new address[](edges.length);
        uint256[] memory shares = new uint256[](edges.length);

        for (uint256 i = 0; i < edges.length; i++) {
            payees[i] = edges[i].contributor;
            // The shares in PaymentSplitter are relative, so basis points work perfectly.
            shares[i] = edges[i].weightBps;
        }

        // 4. DEPLOY: Create a new instance of the PaymentSplitter contract.
        PaymentSplitter newSplitter = new PaymentSplitter(payees, shares);
        splitterAddress = address(newSplitter);

        // 5. RECORD: Store the address of the new splitter.
        assetIdToSplitter[_assetId] = splitterAddress;

        emit SplitterCreated(_assetId, splitterAddress, payees, shares);
    }
}
