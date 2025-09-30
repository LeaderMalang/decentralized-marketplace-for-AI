// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AssetToken
 * @author Hassan Ali
 * @notice An ERC1155 contract to represent unique AI datasets and models as tokens.
 * @dev This contract uses AccessControl for role-based permissions.
 * - DEFAULT_ADMIN_ROLE: Can grant/revoke roles.
 * - MINTER_ROLE: Can mint new asset tokens.
 * - URI_SETTER_ROLE: Can update the metadata URI for an asset.
 */
contract AssetToken is ERC1155, AccessControl {
    using Counters for Counters.Counter;

    // --- Roles ---
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER_ROLE");

    // --- State Variables ---

    // Counter to ensure unique token IDs for each new asset.
    Counters.Counter private _tokenIdCounter;

    // Struct to hold metadata for each specific asset token.
    struct Asset {
        uint256 licenseId;
        string metadataURI;
    }

    // Mapping from token ID to its asset-specific metadata.
    mapping(uint256 => Asset) private _assets;

    // --- Events ---
    event AssetMinted(
        uint256 indexed tokenId,
        address indexed creator,
        address indexed owner,
        uint256 licenseId,
        string metadataURI
    );

    event LicenseUpdated(uint256 indexed tokenId, uint256 newLicenseId);
    event URIUpdated(uint256 indexed tokenId, string newURI);


    // --- Constructor ---

    /**
     * @notice Sets up the contract, granting admin and minter roles to the deployer.
     * @param _defaultAdmin The address to receive the DEFAULT_ADMIN_ROLE.
     * @param _minter The address to receive the initial MINTER_ROLE.
     * @param _uriSetter The address to receive the initial URI_SETTER_ROLE.
     * @param _initialURI The base URI for the collection (can be an empty string if unused).
     */
    constructor(
        address _defaultAdmin,
        address _minter,
        address _uriSetter,
        string memory _initialURI
    ) ERC1155(_initialURI) {
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(MINTER_ROLE, _minter);
        _grantRole(URI_SETTER_ROLE, _uriSetter);
    }


    // --- Core Functions ---

    /**
     * @notice Mints a new asset token representing a dataset or model.
     * @dev Only callable by accounts with MINTER_ROLE.
     * Mints a single copy of the token to the specified owner.
     * @param owner The address that will receive the minted asset token.
     * @param _licenseId The identifier for the license governing this asset.
     * @param _metadataURI The URI pointing to the JSON metadata for this asset.
     * @param _data Additional data with no specified format.
     * @return The ID of the newly created token.
     */
    function mint(
        address owner,
        uint256 _licenseId,
        string memory _metadataURI,
        bytes memory _data
    ) public virtual onlyRole(MINTER_ROLE) returns (uint256) {
        _tokenIdCounter.increment();
        uint256 newTokenId = _tokenIdCounter.current();

        // Mint one token for the owner. Amount is 1 as each asset is unique.
        _mint(owner, newTokenId, 1, _data);

        // Store the asset-specific metadata.
        _assets[newTokenId] = Asset({
            licenseId: _licenseId,
            metadataURI: _metadataURI
        });

        emit AssetMinted(
            newTokenId,
            _msgSender(),
            owner,
            _licenseId,
            _metadataURI
        );

        return newTokenId;
    }

    /**
     * @notice Updates the license ID for an existing asset token.
     * @dev Only callable by the DEFAULT_ADMIN_ROLE.
     * @param _tokenId The ID of the token to update.
     * @param _newLicenseId The new license ID.
     */
    function setLicense(
        uint256 _tokenId,
        uint256 _newLicenseId
    ) public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _tokenId > 0 && _tokenId <= _tokenIdCounter.current(),
            "AssetToken: License update for nonexistent token"
        );
        _assets[_tokenId].licenseId = _newLicenseId;
        emit LicenseUpdated(_tokenId, _newLicenseId);
    }

    /**
     * @notice Updates the metadata URI for an existing asset token.
     * @dev Only callable by the URI_SETTER_ROLE. This allows delegating metadata
     * updates without granting full admin rights.
     * @param _tokenId The ID of the token to update.
     * @param _newURI The new metadata URI.
     */
    function setURI(
        uint256 _tokenId,
        string memory _newURI
    ) public virtual onlyRole(URI_SETTER_ROLE) {
        require(
            _tokenId > 0 && _tokenId <= _tokenIdCounter.current(),
            "AssetToken: URI set for nonexistent token"
        );
        _assets[_tokenId].metadataURI = _newURI;
        emit URIUpdated(_tokenId, _newURI);
    }


    // --- View Functions ---

    /**
     * @notice Returns the URI for a given token ID.
     * @dev Overrides the default ERC1155 'uri' function to return per-ID URIs.
     * @param _tokenId The ID of the token.
     * @return The metadata URI string.
     */
    function uri(
        uint256 _tokenId
    ) public view virtual override returns (string memory) {
        require(
            _tokenId > 0 && _tokenId <= _tokenIdCounter.current(),
            "AssetToken: URI query for nonexistent token"
        );
        return _assets[_tokenId].metadataURI;
    }

    /**
     * @notice Returns the license ID for a given token ID.
     * @param _tokenId The ID of the token.
     * @return The license ID.
     */
    function license(uint256 _tokenId) public view returns (uint256) {
        require(
            _tokenId > 0 && _tokenId <= _tokenIdCounter.current(),
            "AssetToken: License query for nonexistent token"
        );
        return _assets[_tokenId].licenseId;
    }

    /**
     * @notice Returns all details for a given asset.
     * @param _tokenId The ID of the token.
     * @return A tuple containing the license ID and metadata URI.
     */
    function getAssetDetails(
        uint256 _tokenId
    ) public view returns (Asset memory) {
        require(
            _tokenId > 0 && _tokenId <= _tokenIdCounter.current(),
            "AssetToken: Details query for nonexistent token"
        );
        return _assets[_tokenId];
    }

    // --- Internal & Overrides ---

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
