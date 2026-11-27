// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title IKiteVerifier
 * @notice Verification interface for Kite Agent Zero-Knowledge Attestation proofs
 */
interface IKiteVerifier {
    function verifyProof(
        bytes calldata proof,
        uint256[4] calldata publicInputs
    ) external view returns (bool);
}

/**
 * @title KiteAgentZKAttestation
 * @author Anyi-zheng
 * @notice On-chain registry verifying zero-knowledge proofs of off-chain AI Agent execution
 *         and anchoring non-repudiable state attestations on Kite Chain (x402 protocol).
 */
contract KiteAgentZKAttestation {
    // Kite Chain ChainID: 2368 (Testnet) / 2366 (Mainnet)
    uint256 public immutable chainId;
    address public owner;
    address public pendingOwner;
    IKiteVerifier public verifier;

    struct AttestationRecord {
        bytes32 agentId;
        bytes32 stateHash;
        uint256 computationEpoch;
        uint256 timestamp;
        address attestor;
        bytes32 x402ReceiptHash;
    }

    // Mapping from attestation digest to on-chain record
    mapping(bytes32 => AttestationRecord) public attestations;
    mapping(bytes32 => uint256) public agentLatestEpoch;

    event AttestationAnchored(
        bytes32 indexed attestationHash,
        bytes32 indexed agentId,
        bytes32 stateHash,
        uint256 computationEpoch,
        address indexed attestor,
        bytes32 x402ReceiptHash
    );

    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error InvalidProof();
    error StaleComputationEpoch(uint256 provided, uint256 current);
    error AttestationAlreadyExists(bytes32 digest);
    error Unauthorized();
    error InvalidVerifier(address verifierAddress);
    error EmptyAgentId();
    error EmptyStateHash();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address _verifier) {
        _requireVerifier(_verifier);
        owner = msg.sender;
        verifier = IKiteVerifier(_verifier);
        chainId = block.chainid;
    }

    /**
     * @notice Starts a two-step ownership transfer. The new owner must call acceptOwnership.
     *         Passing address(0) cancels a pending transfer.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Completes a pending ownership transfer; callable only by the pending owner.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    function setVerifier(address _newVerifier) external onlyOwner {
        _requireVerifier(_newVerifier);
        emit VerifierUpdated(address(verifier), _newVerifier);
        verifier = IKiteVerifier(_newVerifier);
    }

    /**
     * @notice Submits and verifies a zero-knowledge attestation of autonomous agent execution.
     * @dev Zero agentId and stateHash are reserved sentinels (rejected result / empty state tree)
     *      and are never anchored, whatever the verifier would accept.
     * @param agentId Unique identifier of the Kite Autonomous Agent
     * @param stateHash Merkle root or digest representing internal agent memory/state
     * @param computationEpoch Monotonically increasing epoch sequence
     * @param x402ReceiptHash Linked EIP-712/x402 micropayment settlement hash
     * @param zkProof Snark/Groth16 cryptographic proof
     */
    function anchorAttestation(
        bytes32 agentId,
        bytes32 stateHash,
        uint256 computationEpoch,
        bytes32 x402ReceiptHash,
        bytes calldata zkProof
    ) external returns (bytes32 attestationHash) {
        if (agentId == bytes32(0)) revert EmptyAgentId();
        if (stateHash == bytes32(0)) revert EmptyStateHash();

        if (computationEpoch <= agentLatestEpoch[agentId]) {
            revert StaleComputationEpoch(computationEpoch, agentLatestEpoch[agentId]);
        }

        attestationHash = keppetAttestationDigest(
            agentId,
            stateHash,
            computationEpoch,
            x402ReceiptHash
        );

        if (attestations[attestationHash].timestamp != 0) {
            revert AttestationAlreadyExists(attestationHash);
        }

        {
            _requireVerifier(address(verifier));
            uint256[4] memory publicInputs = [
                uint256(agentId),
                uint256(stateHash),
                computationEpoch,
                uint256(x402ReceiptHash)
            ];
            bool valid = verifier.verifyProof(zkProof, publicInputs);
            if (!valid) revert InvalidProof();
        }

        attestations[attestationHash] = AttestationRecord({
            agentId: agentId,
            stateHash: stateHash,
            computationEpoch: computationEpoch,
            timestamp: block.timestamp,
            attestor: msg.sender,
            x402ReceiptHash: x402ReceiptHash
        });

        agentLatestEpoch[agentId] = computationEpoch;

        emit AttestationAnchored(
            attestationHash,
            agentId,
            stateHash,
            computationEpoch,
            msg.sender,
            x402ReceiptHash
        );
    }

    function _requireVerifier(address verifierAddress) private view {
        if (verifierAddress.code.length == 0) revert InvalidVerifier(verifierAddress);
    }

    function keppetAttestationDigest(
        bytes32 agentId,
        bytes32 stateHash,
        uint256 epoch,
        bytes32 receiptHash
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(agentId, stateHash, epoch, receiptHash));
    }
}
