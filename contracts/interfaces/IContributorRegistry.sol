// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IContributorRegistry
 * @dev Interface for the ContributorRegistry contract.
 */
interface IContributorRegistry {
    /**
     * @dev Returns true if `_account` has been granted `_role`.
     */
    function hasRole(bytes32 _role, address _account) external view returns (bool);
}
