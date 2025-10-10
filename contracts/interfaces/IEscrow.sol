// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IEscrow Interface
 * @notice Defines the external functions for the Escrow contract.
 */
interface IEscrow {
    /**
     * @notice Called by the UsageReceiptVerifier to place a new payment into escrow.
     * @param assetId The ID of the asset being paid for.
     * @param user The address of the user who made the payment.
     * @param amount The amount of the payment.
     * @param paymentSplitter The final destination for the funds if not disputed.
     */
    function holdPayment(
        uint256 assetId,
        address user,
        uint256 amount,
        address paymentSplitter
    ) external;
}
