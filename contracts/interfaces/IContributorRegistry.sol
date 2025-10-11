// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IContributorRegistry Interface
 * @notice Defines the external functions for the ContributorRegistry contract.
 */
interface IContributorRegistry {
    /**
     * @notice Returns the profile URI for a given contributor address.
     * @dev This is the getter for the public `profileURIs` mapping.
     * @param _contributor The address of the contributor.
     * @return The URI string for the contributor's profile.
     */
    function profileURIs(address _contributor) external view returns (string memory);

    /**
     * @notice Checks if an account has a specific role.
     * @param role The role identifier (bytes32).
     * @param account The address of the account to check.
     * @return True if the account has the role, false otherwise.
     */
    function hasRole(bytes32 role, address account) external view returns (bool);
}

