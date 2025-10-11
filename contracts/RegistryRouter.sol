// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IAssetToken.sol";
import "./interfaces/IContributorRegistry.sol";
import "./interfaces/IProvenanceGraph.sol";
import "./interfaces/IRoyaltySplitFactory.sol";

/**
 * @title RegistryRouter
 * @author Hassan Ali
 * @notice A read-only contract that aggregates data from multiple core contracts.
 * @dev This contract simplifies off-chain data fetching by bundling multiple
 * on-chain calls into single, convenient view functions. It is stateless.
 */
contract RegistryRouter {

    // --- Core Contract Dependencies ---
    IAssetToken public immutable assetToken;
    IContributorRegistry public immutable contributorRegistry;
    IProvenanceGraph public immutable provenanceGraph;
    IRoyaltySplitFactory public immutable royaltySplitFactory;

    // --- Custom Structs for Data Aggregation ---

    /**
     * @notice A comprehensive view of all data associated with a single asset.
     * @param owner The current owner of the asset token.
     * @param metadataURI The URI for the asset's off-chain metadata (e.g., IPFS).
     * @param licenseId The identifier for the asset's license.
     * @param isFinalized True if the asset's provenance graph has been locked.
     * @param paymentSplitter The address of the dedicated payment contract for this asset.
     * @param contributorEdges An array of contributors and their revenue shares.
     * @param parentEdges An array of parent assets and their revenue shares.
     */
    struct AssetFullDetails {
        address owner;
        string metadataURI;
        uint256 licenseId;
        bool isFinalized;
        address paymentSplitter;
        IProvenanceGraph.Edge[] contributorEdges;
        IProvenanceGraph.Edge[] parentEdges;
    }
    
    /**
     * @notice A view of data associated with a single contributor.
     * @param profileURI The URI for the contributor's off-chain profile metadata.
     */
    struct ContributorDetails {
        string profileURI;
        // Note: Listing all roles for a user is an anti-pattern on-chain.
        // The off-chain service should check for specific roles it cares about
        // using `contributorRegistry.hasRole(role, address)`.
    }

    // --- Errors ---
    error ZeroAddress();

    // --- Constructor ---
    constructor(
        address _assetToken,
        address _contributorRegistry,
        address _provenanceGraph,
        address _royaltySplitFactory
    ) {
        if (_assetToken == address(0) || _contributorRegistry == address(0) || _provenanceGraph == address(0) || _royaltySplitFactory == address(0)) {
            revert ZeroAddress();
        }

        assetToken = IAssetToken(_assetToken);
        contributorRegistry = IContributorRegistry(_contributorRegistry);
        provenanceGraph = IProvenanceGraph(_provenanceGraph);
        royaltySplitFactory = IRoyaltySplitFactory(_royaltySplitFactory);
    }

    // --- View Functions ---

    /**
     * @notice Fetches all on-chain details for a given asset ID in a single call.
     * @param _assetId The ID of the asset to query.
     * @return A populated AssetFullDetails struct.
     */
    function getAssetFullDetails(uint256 _assetId)
        external
        view
        returns (AssetFullDetails memory)
    {
        return AssetFullDetails({
            owner: assetToken.ownerOf(_assetId),
            metadataURI: assetToken.uri(_assetId),
            licenseId: assetToken.licenseId(_assetId),
            isFinalized: provenanceGraph.isFinalized(_assetId),
            paymentSplitter: royaltySplitFactory.assetIdToSplitter(_assetId),
            contributorEdges: provenanceGraph.getContributorEdges(_assetId),
            parentEdges: provenanceGraph.getParentEdges(_assetId)
        });
    }

    /**
     * @notice Fetches details for a given contributor address.
     * @param _contributor The address of the contributor.
     * @return A populated ContributorDetails struct.
     */
    function getContributorDetails(address _contributor)
        external
        view
        returns (ContributorDetails memory)
    {
        return ContributorDetails({
            profileURI: contributorRegistry.profileURIs(_contributor)
        });
    }
}
