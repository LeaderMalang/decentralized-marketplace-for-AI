// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IRoyaltySplitFactory.sol";
import "./interfaces/IEscrow.sol";

/**
 * @title UsageReceiptVerifier
 * @author Hassan Ali
 * @notice Verifies signed EIP-712 usage receipts and forwards payments to Escrow.
 * @dev This contract is designed to be called by a trusted off-chain service (a "Verifier").
 * The end-user must first approve this contract to spend their USDC.
 */
contract UsageReceiptVerifier is EIP712, AccessControl, Pausable {
    using SafeERC20 for IERC20;

    // --- Roles ---
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // --- State Variables ---
    IERC20 public immutable usdc;
    IRoyaltySplitFactory public immutable royaltySplitFactory;
    IEscrow public immutable escrow; // MODIFIED: Added Escrow contract

    // Replay protection: mapping from a user address to their latest used nonce
    mapping(address => uint256) public nonces;

    // --- EIP-712 Structs and Hashes ---
    bytes32 private constant USAGE_RECEIPT_TYPEHASH =
        keccak256("UsageReceipt(uint256 assetId,uint256 amount,address user,uint256 nonce,uint256 deadline)");

    struct UsageReceipt {
        uint256 assetId;
        uint256 amount;
        address user;
        uint256 nonce;
        uint256 deadline;
    }

    // --- Errors ---
    error InvalidSignature();
    error ReceiptExpired(uint256 deadline, uint256 blockTimestamp);
    error InvalidNonce(uint256 expected, uint256 actual);
    error SplitterNotCreated(uint256 assetId);
    error ZeroAddress();

    // --- Constructor ---
    constructor(
        string memory _name,
        string memory _version,
        address _usdcAddress,
        address _royaltySplitFactoryAddress,
        address _escrowAddress, // MODIFIED: Added escrow address
        address _defaultAdmin,
        address _verifier,
        address _pauser
    ) EIP712(_name, _version) {
        if (
            _usdcAddress == address(0) || 
            _royaltySplitFactoryAddress == address(0) || 
            _escrowAddress == address(0) || // MODIFIED: Added check
            _defaultAdmin == address(0) || 
            _verifier == address(0) || 
            _pauser == address(0)
        ) {
            revert ZeroAddress();
        }
        usdc = IERC20(_usdcAddress);
        royaltySplitFactory = IRoyaltySplitFactory(_royaltySplitFactoryAddress);
        escrow = IEscrow(_escrowAddress); // MODIFIED: Set escrow address

        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(VERIFIER_ROLE, _verifier);
        _grantRole(PAUSER_ROLE, _pauser);
    }

    // --- Core Logic ---

    /**
     * @notice Verifies a signed usage receipt and executes payment if valid.
     * @dev Must be called by an address with VERIFIER_ROLE.
     * @param _receipt The UsageReceipt struct containing payment details.
     * @param _signature The EIP-712 signature from the user.
     */
    function verifyAndPayWithReceipt(UsageReceipt calldata _receipt, bytes calldata _signature)
        external
        whenNotPaused
        onlyRole(VERIFIER_ROLE)
    {
        // 1. Check if the receipt has expired
        if (block.timestamp > _receipt.deadline) {
            revert ReceiptExpired(_receipt.deadline, block.timestamp);
        }

        // 2. Verify the signature
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            USAGE_RECEIPT_TYPEHASH,
            _receipt.assetId,
            _receipt.amount,
            _receipt.user,
            _receipt.nonce,
            _receipt.deadline
        )));
        
        address signer = ECDSA.recover(digest, _signature);
        if (signer != _receipt.user || signer == address(0)) {
            revert InvalidSignature();
        }

        // 3. Prevent replay attacks by checking and incrementing the nonce
        uint256 expectedNonce = nonces[signer];
        if (_receipt.nonce != expectedNonce) {
            revert InvalidNonce(expectedNonce, _receipt.nonce);
        }
        nonces[signer]++;

        // 4. Get the destination PaymentSplitter address
        address splitterAddress = royaltySplitFactory.assetIdToSplitter(_receipt.assetId);
        if (splitterAddress == address(0)) {
            revert SplitterNotCreated(_receipt.assetId);
        }

        // 5. MODIFIED: Execute the payment by pulling funds and forwarding to Escrow
        usdc.safeTransferFrom(_receipt.user, address(escrow), _receipt.amount);
        escrow.holdPayment(_receipt.assetId, _receipt.user, _receipt.amount, splitterAddress);
    }

    // --- Pausable Functions ---

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}

