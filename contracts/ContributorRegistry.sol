// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title ContributorRegistry
 * @author Your Name/Company
 * @notice Manages contributor profiles (wallet ↔ profile) and their roles.
 * @dev This contract uses AccessControl for administrative functions and is Pausable.
 * - DEFAULT_ADMIN_ROLE: The ultimate authority, can grant/revoke other admin roles.
 * - ROLE_ADMIN: Can grant/revoke ecosystem roles (e.g., ANNOTATOR) to contributors.
 * - PAUSER_ROLE: Can pause and unpause the contract's state-changing functions.
 */
contract ContributorRegistry is Context, AccessControl, Pausable {

    // --- Roles ---
    bytes32 public constant ROLE_ADMIN = keccak256("ROLE_ADMIN");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // --- State Variables ---
    struct Profile {
        string metadataURI; // URI to off-chain JSON profile data (name, bio, etc.)
        bool isRegistered;  // Flag to check if a profile has been set
    }

    // Mapping from a contributor's wallet address to their profile.
    mapping(address => Profile) private _profiles;

    // Mapping from a role hash to a contributor's address to check for role possession.
    // e.g., _roles[keccak256("ANNOTATOR_ROLE")][0x123...] = true;
    mapping(bytes32 => mapping(address => bool)) private _roles;

    // --- Events ---
    event ProfileUpdated(address indexed contributor, string newMetadataURI);
    event RoleGrantedOnChain(bytes32 indexed role, address indexed contributor, address indexed grantedBy);
    event RoleRevokedOnChain(bytes32 indexed role, address indexed contributor, address indexed revokedBy);


    // --- Constructor ---
    /**
     * @notice Sets up the contract and initial administrative roles.
     * @param _defaultAdmin The address to receive the DEFAULT_ADMIN_ROLE.
     * @param _roleAdmin The address for the initial ROLE_ADMIN.
     * @param _pauser The address for the initial PAUSER_ROLE.
     */
    constructor(
        address _defaultAdmin,
        address _roleAdmin,
        address _pauser
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(ROLE_ADMIN, _roleAdmin);
        _grantRole(PAUSER_ROLE, _pauser);
    }

    // --- Profile Management ---

    /**
     * @notice Allows a contributor to set or update their own profile URI.
     * @param _metadataURI The URI pointing to the contributor's off-chain metadata.
     */
    function setProfileURI(string memory _metadataURI) public virtual whenNotPaused {
        address contributor = _msgSender();
        _profiles[contributor] = Profile({
            metadataURI: _metadataURI,
            isRegistered: true
        });
        emit ProfileUpdated(contributor, _metadataURI);
    }

    // --- Role Management ---

    /**
     * @notice Grants an ecosystem role to a contributor.
     * @dev Only callable by accounts with ROLE_ADMIN.
     * @param _role The role to grant (e.g., keccak256("ANNOTATOR_ROLE")).
     * @param _contributor The address of the contributor to receive the role.
     */
    function grantRole(bytes32 _role, address _contributor) public virtual override onlyRole(ROLE_ADMIN) whenNotPaused {
        require(_contributor != address(0), "ContributorRegistry: Grant role to the zero address");
        _roles[_role][_contributor] = true;
        emit RoleGrantedOnChain(_role, _contributor, _msgSender());
    }

    /**
     * @notice Revokes an ecosystem role from a contributor.
     * @dev Only callable by accounts with ROLE_ADMIN.
     * @param _role The role to revoke.
     * @param _contributor The address of the contributor losing the role.
     */
    function revokeRole(bytes32 _role, address _contributor) public virtual override onlyRole(ROLE_ADMIN) whenNotPaused {
        require(_contributor != address(0), "ContributorRegistry: Revoke role from the zero address");
        _roles[_role][_contributor] = false;
        emit RoleRevokedOnChain(_role, _contributor, _msgSender());
    }

    // --- Pausable Functions ---

    /**
     * @notice Pauses all state-changing functions.
     * @dev Only callable by accounts with PAUSER_ROLE.
     */
    function pause() public virtual onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the contract.
     * @dev Only callable by accounts with PAUSER_ROLE.
     */
    function unpause() public virtual onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // --- View Functions ---

    /**
     * @notice Retrieves the profile details for a given contributor.
     * @param _contributor The address of the contributor.
     * @return The Profile struct containing the metadataURI and registration status.
     */
    function getProfile(address _contributor) public view virtual returns (Profile memory) {
        return _profiles[_contributor];
    }

    /**
     * @notice Checks if a contributor has a specific ecosystem role.
     * @param _role The role to check.
     * @param _contributor The address of the contributor.
     * @return True if the contributor has the role, false otherwise.
     */
    function hasRole(bytes32 _role, address _contributor) public view virtual override returns (bool) {
        return _roles[_role][_contributor];
    }

    // --- Overrides ---

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
