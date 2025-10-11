// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IFeeTreasury.sol";

/**
 * @title Escrow
 * @author Hassan Ali
 * @notice Holds payments temporarily to allow for disputes. Integrates with FeeTreasury
 * to split protocol fees on successful payments.
 */
contract Escrow is AccessControl {
    using SafeERC20 for IERC20;

    // --- Enums and Structs ---
    enum Status { Held, Disputed, Released, Refunded }

    struct EscrowItem {
        uint256 id;
        address user;
        uint256 assetId;
        uint256 amount;
        address paymentSplitter;
        uint256 releaseTime;
        Status status;
    }

    // --- Roles ---
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    // --- State Variables ---
    IERC20 public immutable usdc;
    IFeeTreasury public immutable feeTreasury; // ADDED: FeeTreasury integration

    mapping(uint256 => EscrowItem) public escrows;
    uint256 private _escrowIdCounter;

    // --- Constants ---
    uint256 public constant HOLD_PERIOD = 3 days;

    // --- Events ---
    event PaymentHeld(uint256 indexed escrowId, uint256 indexed assetId, address indexed user, uint256 amount);
    event DisputeOpened(uint256 indexed escrowId);
    event PaymentReleased(uint256 indexed escrowId, uint256 amountToContributors, uint256 protocolFee);
    event PaymentRefunded(uint256 indexed escrowId);

    // --- Errors ---
    error InvalidStatus();
    error NotAuthorized();
    error HoldPeriodNotOver();
    error DisputeWindowClosed();
    error ZeroAddress();

    // --- Constructor ---
    constructor(
        address _admin,
        address _arbiter,
        address _verifier,
        address _usdcAddress,
        address _feeTreasuryAddress // ADDED: FeeTreasury address
    ) {
        if (_admin == address(0) || _arbiter == address(0) || _verifier == address(0) || _usdcAddress == address(0) || _feeTreasuryAddress == address(0)) {
            revert ZeroAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ARBITER_ROLE, _arbiter);
        _grantRole(VERIFIER_ROLE, _verifier);

        usdc = IERC20(_usdcAddress);
        feeTreasury = IFeeTreasury(_feeTreasuryAddress); // ADDED: Initialize FeeTreasury
    }

    // --- Core Functions ---

    /**
     * @notice Holds a payment in escrow.
     * @dev Can only be called by a trusted Verifier contract.
     */
    function holdPayment(
        uint256 _assetId,
        address _user,
        uint256 _amount,
        address _paymentSplitter
    ) external onlyRole(VERIFIER_ROLE) {
        uint256 escrowId = ++_escrowIdCounter;
        escrows[escrowId] = EscrowItem({
            id: escrowId,
            user: _user,
            assetId: _assetId,
            amount: _amount,
            paymentSplitter: _paymentSplitter,
            releaseTime: block.timestamp + HOLD_PERIOD,
            status: Status.Held
        });
        emit PaymentHeld(escrowId, _assetId, _user, _amount);
    }

    /**
     * @notice Opens a dispute for a payment held in escrow.
     * @dev Can only be called by the user who made the payment, and only while status is Held.
     */
    function openDispute(uint256 _escrowId) external {
        EscrowItem storage item = escrows[_escrowId];
        if (item.user != msg.sender) revert NotAuthorized();
        if (item.status != Status.Held) revert InvalidStatus();
        if (block.timestamp > item.releaseTime) revert DisputeWindowClosed();

        item.status = Status.Disputed;
        emit DisputeOpened(_escrowId);
    }
    
    /**
     * @notice Releases a payment after the hold period is over.
     * @dev Can be called by anyone, but only executes if status is Held and time is up.
     * This function will split the payment between the contributors and the protocol treasury.
     */
    function release(uint256 _escrowId) external {
        EscrowItem storage item = escrows[_escrowId];
        if (item.status != Status.Held) revert InvalidStatus();
        if (block.timestamp < item.releaseTime) revert HoldPeriodNotOver();

        _splitAndSend(item); // MODIFIED: Use internal split function

        item.status = Status.Released;
    }
    
    /**
     * @notice Resolves a dispute.
     * @dev Can only be called by an Arbiter.
     */
    function resolveDispute(uint256 _escrowId, bool _refundToUser) external onlyRole(ARBITER_ROLE) {
        EscrowItem storage item = escrows[_escrowId];
        if (item.status != Status.Disputed) revert InvalidStatus();

        if (_refundToUser) {
            item.status = Status.Refunded;
            usdc.safeTransfer(item.user, item.amount);
            emit PaymentRefunded(_escrowId);
        } else {
            item.status = Status.Released;
            _splitAndSend(item); // MODIFIED: Use internal split function
        }
    }

    // --- Internal Functions ---

    /**
     * @notice Internal function to calculate fees and send funds.
     * @dev Splits funds between contributors and the treasury.
     */
    function _splitAndSend(EscrowItem storage _item) internal {
        uint16 currentFeeBps = feeTreasury.feeBps();
        address multisig = feeTreasury.treasuryMultisig();
        
        uint256 totalAmount = _item.amount;
        uint256 protocolFee = (totalAmount * currentFeeBps) / 10000;
        uint256 amountToContributors = totalAmount - protocolFee;

        // Transfer funds
        usdc.safeTransfer(multisig, protocolFee);
        usdc.safeTransfer(_item.paymentSplitter, amountToContributors);
        
        emit PaymentReleased(_item.id, amountToContributors, protocolFee);
    }
}

