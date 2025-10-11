// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title FeeTreasury
 * @author Hassan Ali
 * @notice Manages the protocol fee settings and the destination treasury address.
 * @dev This contract acts as a central configuration point for platform fees.
 */
contract FeeTreasury is AccessControl {
    // --- Roles ---
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // --- State Variables ---
    uint16 public feeBps;
    address public treasuryMultisig;
    
    // --- Constants ---
    uint16 public constant MAX_FEE_BPS = 1000; // 10% maximum fee, a safety measure

    // --- Events ---
    event FeeUpdated(uint16 newFeeBps);
    event TreasuryUpdated(address newTreasury);

    // --- Errors ---
    error ZeroAddress();
    error FeeTooHigh(uint16 maxFee, uint16 actualFee);

    // --- Constructor ---
    constructor(
        address _admin,
        address _initialTreasury,
        uint16 _initialFeeBps
    ) {
        if (_admin == address(0) || _initialTreasury == address(0)) {
            revert ZeroAddress();
        }
        if (_initialFeeBps > MAX_FEE_BPS) {
            revert FeeTooHigh(MAX_FEE_BPS, _initialFeeBps);
        }
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        
        treasuryMultisig = _initialTreasury;
        feeBps = _initialFeeBps;
    }

    // --- Admin Functions ---

    /**
     * @notice Sets the new protocol fee in basis points.
     * @dev Must be called by an address with ADMIN_ROLE.
     * @param _newFeeBps The new fee (e.g., 250 for 2.5%).
     */
    function setFeeBps(uint16 _newFeeBps) external onlyRole(ADMIN_ROLE) {
        if (_newFeeBps > MAX_FEE_BPS) {
            revert FeeTooHigh(MAX_FEE_BPS, _newFeeBps);
        }
        feeBps = _newFeeBps;
        emit FeeUpdated(_newFeeBps);
    }

    /**
     * @notice Sets the new address for the treasury multisig.
     * @dev Must be called by an address with ADMIN_ROLE.
     * @param _newTreasury The new multisig address.
     */
    function setTreasuryMultisig(address _newTreasury) external onlyRole(ADMIN_ROLE) {
        if (_newTreasury == address(0)) {
            revert ZeroAddress();
        }
        treasuryMultisig = _newTreasury;
        emit TreasuryUpdated(_newTreasury);
    }
}
