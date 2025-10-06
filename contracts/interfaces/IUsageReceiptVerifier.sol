// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IUsageReceiptVerifier Interface
 * @notice Defines the external functions for the UsageReceiptVerifier contract.
 */
interface IUsageReceiptVerifier {
    /**
     * @dev The UsageReceipt struct defines the data that a user signs off-chain.
     * It must be defined within the interface to be used as a function parameter.
     */
    struct UsageReceipt {
        uint256 assetId;
        uint256 amount;
        address user;
        uint256 nonce;
        uint256 deadline;
    }

    /**
     * @notice The core function to verify a signed receipt and trigger a payment.
     * @param _receipt The UsageReceipt struct containing payment details.
     * @param _signature The EIP-712 signature from the user.
     */
    function verifyAndPayWithReceipt(UsageReceipt calldata _receipt, bytes calldata _signature) external;
}
