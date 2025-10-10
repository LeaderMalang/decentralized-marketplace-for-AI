// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUsageReceiptVerifier.sol"; // Assuming an interface exists

/**
 * @title Escrow
 * @author Your Name
 * @notice Holds payments for a defined period, allowing for disputes.
 * @dev Manages the lifecycle of payments from holding to release or refund.
 */
contract Escrow is AccessControl, Pausable {
    using SafeERC20 for IERC20;

    // --- Roles ---
    bytes32 public constant ARBITER_ROLE = keccak26_("ARBITER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE"); // The UsageReceiptVerifier contract

    // --- Enums and Structs ---
    enum Status { Held, Disputed, Released, Refunded }

    struct EscrowedPayment {
        uint256 id;
        Status status;
        address user;
        uint256 assetId;
        uint256 amount;
        address paymentSplitter;
        uint256 releaseTime;
    }

    // --- State Variables ---
    IERC20 public immutable usdc;
    uint256 public immutable holdDuration; // e.g., 3 days in seconds

    mapping(uint256 => EscrowedPayment) public payments;
    uint256 private _nextPaymentId;
    
    // --- Errors ---
    error InvalidStatus(Status currentStatus);
    error NotUser();
    error StillLocked(uint256 releaseTime, uint256 blockTimestamp);
    error ZeroAddress();

    // --- Events ---
    event PaymentHeld(uint256 indexed paymentId, uint256 indexed assetId, address indexed user, uint256 amount);
    event DisputeOpened(uint256 indexed paymentId);
    event PaymentReleased(uint256 indexed paymentId, address indexed destination);
    event PaymentRefunded(uint256 indexed paymentId, address indexed user);

    // --- Constructor ---
    constructor(
        address _usdcAddress,
        uint256 _holdDuration,
        address _defaultAdmin,
        address _arbiter,
        address _pauser,
        address _verifierAddress
    ) {
        if (_usdcAddress == address(0) || _defaultAdmin == address(0) || _arbiter == address(0) || _pauser == address(0) || _verifierAddress == address(0)) {
            revert ZeroAddress();
        }
        usdc = IERC20(_usdcAddress);
        holdDuration = _holdDuration;

        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(ARBITER_ROLE, _arbiter);
        _grantRole(PAUSER_ROLE, _pauser);
        _grantRole(VERIFIER_ROLE, _verifierAddress);
    }

    // --- Core Logic ---

    /**
     * @notice Places a payment into escrow.
     * @dev Only callable by the UsageReceiptVerifier contract.
     * The USDC must be transferred to this contract *before* this function is called.
     */
    function holdPayment(
        uint256 _assetId,
        address _user,
        uint256 _amount,
        address _paymentSplitter
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        uint256 paymentId = _nextPaymentId;
        payments[paymentId] = EscrowedPayment({
            id: paymentId,
            status: Status.Held,
            user: _user,
            assetId: _assetId,
            amount: _amount,
            paymentSplitter: _paymentSplitter,
            releaseTime: block.timestamp + holdDuration
        });
        _nextPaymentId++;
        emit PaymentHeld(paymentId, _assetId, _user, _amount);
    }

    /**
     * @notice Allows the user who made the payment to open a dispute.
     * @param _paymentId The ID of the payment to dispute.
     */
    function openDispute(uint256 _paymentId) external whenNotPaused {
        EscrowedPayment storage payment = payments[_paymentId];
        if (msg.sender != payment.user) revert NotUser();
        if (payment.status != Status.Held) revert InvalidStatus(payment.status);
        if (block.timestamp > payment.releaseTime) revert StillLocked(payment.releaseTime, block.timestamp); // Cannot dispute after window closes

        payment.status = Status.Disputed;
        emit DisputeOpened(_paymentId);
    }

    /**
     * @notice Releases funds after the hold duration has passed.
     * @dev Can be called by anyone, acting as a public utility to move funds.
     * @param _paymentId The ID of the payment to release.
     */
    function release(uint256 _paymentId) external whenNotPaused {
        EscrowedPayment storage payment = payments[_paymentId];
        if (payment.status != Status.Held) revert InvalidStatus(payment.status);
        if (block.timestamp < payment.releaseTime) revert StillLocked(payment.releaseTime, block.timestamp);

        payment.status = Status.Released;
        usdc.safeTransfer(payment.paymentSplitter, payment.amount);
        emit PaymentReleased(_paymentId, payment.paymentSplitter);
    }

    /**
     * @notice Allows a trusted arbiter to resolve a dispute.
     * @param _paymentId The ID of the disputed payment.
     * @param _refundToUser If true, refunds user; if false, pays contributors.
     */
    function resolveDispute(uint256 _paymentId, bool _refundToUser) external onlyRole(ARBITER_ROLE) whenNotPaused {
        EscrowedPayment storage payment = payments[_paymentId];
        if (payment.status != Status.Disputed) revert InvalidStatus(payment.status);

        if (_refundToUser) {
            payment.status = Status.Refunded;
            usdc.safeTransfer(payment.user, payment.amount);
            emit PaymentRefunded(_paymentId, payment.user);
        } else {
            payment.status = Status.Released;
            usdc.safeTransfer(payment.paymentSplitter, payment.amount);
            emit PaymentReleased(_paymentId, payment.paymentSplitter);
        }
    }
    
    // --- Pausable Functions ---
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
