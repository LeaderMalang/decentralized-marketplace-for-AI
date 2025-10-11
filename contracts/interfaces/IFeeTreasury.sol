// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFeeTreasury Interface
 * @notice Defines the external functions for the FeeTreasury contract.
 */
interface IFeeTreasury {
    /**
     * @notice Returns the current protocol fee in basis points.
     * @return The fee in basis points (e.g., 250 for 2.5%).
     */
    function feeBps() external view returns (uint16);

    /**
     * @notice Returns the address of the multisig wallet where fees are sent.
     * @return The address of the treasury multisig.
     */
    function treasuryMultisig() external view returns (address);
}
