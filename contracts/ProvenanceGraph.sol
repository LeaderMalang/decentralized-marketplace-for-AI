// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IAssetToken.sol";
import "./interfaces/IContributorRegistry.sol";

/**
 * @title ProvenanceGraph
 * @author Hassan Ali
 * @notice Manages the contribution graph for assets, linking them to
 * contributor wallets and parent assets. The owner of an asset
 * is responsible for defining and finalizing its provenance.
 */
contract ProvenanceGraph {
    // --- Structs ---

    struct ContributorEdge {
        address contributor;
        uint16 weightBps; // Basis points (1-10000)
    }

    struct ParentEdge {
        uint256 parentAssetId;
        uint16 weightBps; // Basis points (1-10000)
    }

    // --- State Variables ---

    IAssetToken public immutable assetToken;
    IContributorRegistry public immutable contributorRegistry;

    // Mapping from an asset's token ID to its list of contributor edges
    mapping(uint256 => ContributorEdge[]) private _contributorEdges;

    // Mapping from an asset's token ID to its list of parent asset edges
    mapping(uint256 => ParentEdge[]) private _parentEdges;

    // Mapping to track the total basis points allocated per asset
    mapping(uint256 => uint16) private _totalBpsAllocated;

    // Mapping to track if an asset's graph has been finalized
    mapping(uint256 => bool) private _isFinalized;

    // A defined role to check against in the ContributorRegistry
    bytes32 public constant CONTRIBUTOR_ROLE = keccak256("CONTRIBUTOR_ROLE");

    // --- Events ---

    event ContributorEdgeAdded(uint256 indexed assetId, address indexed contributor, uint16 weightBps);
    event ParentEdgeAdded(uint256 indexed childAssetId, uint256 indexed parentAssetId, uint16 weightBps);
    event GraphFinalized(uint256 indexed assetId);

    // --- Errors ---

    error NotAssetOwner(address caller, uint256 assetId);
    error GraphIsFinalized(uint256 assetId);
    error InvalidWeight(uint16 weightBps);
    error TotalWeightExceeded(uint256 assetId, uint16 currentWeight, uint16 newWeight);
    error NotAContributor(address potentialContributor);
    error AssetDoesNotExist(uint256 assetId);

    // --- Constructor ---

    constructor(address _assetTokenAddress, address _contributorRegistryAddress) {
        assetToken = IAssetToken(_assetTokenAddress);
        contributorRegistry = IContributorRegistry(_contributorRegistryAddress);
    }

    // --- Public & External Functions ---

    /**
     * @notice Adds a contributor and their contribution weight to an asset's graph.
     * @dev Can only be called by the owner of the `_assetId`.
     * @param _assetId The token ID of the asset.
     * @param _contributor The address of the contributor.
     * @param _weightBps The share of the contributor in basis points (1-10000).
     */
    function addContributorEdge(uint256 _assetId, address _contributor, uint16 _weightBps) external {
        if (assetToken.ownerOf(_assetId) != msg.sender) revert NotAssetOwner(msg.sender, _assetId);
        if (_isFinalized[_assetId]) revert GraphIsFinalized(_assetId);
        if (_weightBps == 0 || _weightBps > 10000) revert InvalidWeight(_weightBps);

        // Optional but recommended: check if the address is a registered contributor
        if (!contributorRegistry.hasRole(CONTRIBUTOR_ROLE, _contributor)) {
            revert NotAContributor(_contributor);
        }

        uint16 newTotalBps = _totalBpsAllocated[_assetId] + _weightBps;
        if (newTotalBps > 10000) revert TotalWeightExceeded(_assetId, _totalBpsAllocated[_assetId], _weightBps);

        _totalBpsAllocated[_assetId] = newTotalBps;
        _contributorEdges[_assetId].push(ContributorEdge({contributor: _contributor, weightBps: _weightBps}));

        emit ContributorEdgeAdded(_assetId, _contributor, _weightBps);
    }

    /**
     * @notice Adds a parent asset and its contribution weight to a child asset's graph.
     * @dev Can only be called by the owner of the `_childAssetId`.
     * @param _childAssetId The token ID of the child asset.
     * @param _parentAssetId The token ID of the parent asset.
     * @param _weightBps The share of the parent asset in basis points (1-10000).
     */
    function addParentEdge(uint256 _childAssetId, uint256 _parentAssetId, uint16 _weightBps) external {
        if (assetToken.ownerOf(_childAssetId) != msg.sender) revert NotAssetOwner(msg.sender, _childAssetId);
        if (_isFinalized[_childAssetId]) revert GraphIsFinalized(_childAssetId);
        if (_weightBps == 0 || _weightBps > 10000) revert InvalidWeight(_weightBps);
        if (!assetToken.exists(_parentAssetId)) revert AssetDoesNotExist(_parentAssetId);

        uint16 newTotalBps = _totalBpsAllocated[_childAssetId] + _weightBps;
        if (newTotalBps > 10000) revert TotalWeightExceeded(_childAssetId, _totalBpsAllocated[_childAssetId], _weightBps);

        _totalBpsAllocated[_childAssetId] = newTotalBps;
        _parentEdges[_childAssetId].push(ParentEdge({parentAssetId: _parentAssetId, weightBps: _weightBps}));

        emit ParentEdgeAdded(_childAssetId, _parentAssetId, _weightBps);
    }

    /**
     * @notice Finalizes the provenance graph for an asset, locking it permanently.
     * @dev Can only be called by the owner of the `_assetId`. The total weight
     * must be less than or equal to 10000 bps.
     * @param _assetId The token ID of the asset to finalize.
     */
    function finalize(uint256 _assetId) external {
        if (assetToken.ownerOf(_assetId) != msg.sender) revert NotAssetOwner(msg.sender, _assetId);
        if (_isFinalized[_assetId]) revert GraphIsFinalized(_assetId);

        _isFinalized[_assetId] = true;
        emit GraphFinalized(_assetId);
    }

    // --- View Functions ---

    /**
     * @notice Retrieves all contributor edges for a given asset.
     */
    function getContributorEdges(uint256 _assetId) external view returns (ContributorEdge[] memory) {
        return _contributorEdges[_assetId];
    }

    /**
     * @notice Retrieves all parent asset edges for a given asset.
     */
    function getParentEdges(uint256 _assetId) external view returns (ParentEdge[] memory) {
        return _parentEdges[_assetId];
    }

    /**
     * @notice Returns the total basis points allocated for a given asset.
     */
    function getTotalBpsAllocated(uint256 _assetId) external view returns (uint16) {
        return _totalBpsAllocated[_assetId];
    }

    /**
     * @notice Returns true if the graph for a given asset has been finalized.
     */
    function isFinalized(uint256 _assetId) external view returns (bool) {
        return _isFinalized[_assetId];
    }
}
