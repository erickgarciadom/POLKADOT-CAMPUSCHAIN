// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title CampusChain
/// @notice Catálogo y registro de pedidos de un marketplace universitario.
/// No guarda datos personales: solo direcciones, precios, estados y marcas de tiempo.
contract CampusChain {
    enum Status {
        NONE,
        CREATED,
        ACCEPTED,
        PAYMENT_REPORTED,
        DELIVERED,
        COMPLETED,
        CANCELLED
    }

    struct Product {
        address seller;
        string name;
        string description;
        string category;
        string pickupPoint;
        uint256 priceCents;
        bool available;
    }

    struct Order {
        uint256 productId;
        address buyer;
        address seller;
        uint256 quantity;
        uint256 totalCents;
        bytes32 orderHash;
        Status status;
        uint256 createdAt;
    }

    struct HistoryEntry {
        Status status;
        address changedBy;
        uint256 timestamp;
    }

    struct SellerStats {
        uint256 accepted;
        uint256 completed;
        uint256 cancelled;
    }

    error ProductNotFound();
    error ProductUnavailable();
    error OrderExists();
    error OrderNotFound();
    error NotBuyer();
    error NotSeller();
    error InvalidStatus(Status current);
    error SelfPurchase();
    error InvalidQuantity();

    event ProductCreated(uint256 indexed productId, address indexed seller, uint256 priceCents);
    event ProductAvailabilityChanged(uint256 indexed productId, bool available);
    event OrderCreated(
        bytes32 indexed orderId,
        uint256 indexed productId,
        address indexed buyer,
        address seller,
        uint256 totalCents
    );
    event OrderStatusChanged(
        bytes32 indexed orderId,
        Status newStatus,
        address changedBy,
        uint256 timestamp
    );

    uint256 public productCount;

    mapping(uint256 => Product) private products;
    mapping(bytes32 => Order) private orders;
    mapping(bytes32 => HistoryEntry[]) private histories;
    mapping(address => SellerStats) private stats;
    mapping(address => bytes32[]) private buyerOrders;
    mapping(address => bytes32[]) private sellerOrders;

    modifier orderExists(bytes32 orderId) {
        if (orders[orderId].status == Status.NONE) revert OrderNotFound();
        _;
    }

    modifier onlySeller(bytes32 orderId) {
        if (orders[orderId].seller != msg.sender) revert NotSeller();
        _;
    }

    modifier onlyBuyer(bytes32 orderId) {
        if (orders[orderId].buyer != msg.sender) revert NotBuyer();
        _;
    }

    modifier inStatus(bytes32 orderId, Status expected) {
        Status current = orders[orderId].status;
        if (current != expected) revert InvalidStatus(current);
        _;
    }

    function createProduct(
        string calldata name,
        string calldata description,
        string calldata category,
        string calldata pickupPoint,
        uint256 priceCents
    ) external returns (uint256 id) {
        id = ++productCount;
        products[id] = Product({
            seller: msg.sender,
            name: name,
            description: description,
            category: category,
            pickupPoint: pickupPoint,
            priceCents: priceCents,
            available: true
        });
        emit ProductCreated(id, msg.sender, priceCents);
    }

    function setAvailable(uint256 productId, bool available) external {
        Product storage product = products[productId];
        if (product.seller == address(0)) revert ProductNotFound();
        if (product.seller != msg.sender) revert NotSeller();
        product.available = available;
        emit ProductAvailabilityChanged(productId, available);
    }

    /// @notice orderHash lo calcula la app a partir de los datos del pedido; el contrato lo guarda tal cual.
    function createOrder(bytes32 orderId, uint256 productId, uint256 quantity, bytes32 orderHash) external {
        if (orders[orderId].status != Status.NONE) revert OrderExists();
        if (quantity == 0) revert InvalidQuantity();

        Product storage product = products[productId];
        if (product.seller == address(0)) revert ProductNotFound();
        if (!product.available) revert ProductUnavailable();
        if (product.seller == msg.sender) revert SelfPurchase();

        uint256 totalCents = product.priceCents * quantity;
        orders[orderId] = Order({
            productId: productId,
            buyer: msg.sender,
            seller: product.seller,
            quantity: quantity,
            totalCents: totalCents,
            orderHash: orderHash,
            status: Status.CREATED,
            createdAt: block.timestamp
        });
        buyerOrders[msg.sender].push(orderId);
        sellerOrders[product.seller].push(orderId);
        _record(orderId, Status.CREATED);
        emit OrderCreated(orderId, productId, msg.sender, product.seller, totalCents);
    }

    function acceptOrder(bytes32 orderId)
        external
        orderExists(orderId)
        onlySeller(orderId)
        inStatus(orderId, Status.CREATED)
    {
        stats[msg.sender].accepted++;
        _changeStatus(orderId, Status.ACCEPTED);
    }

    /// @notice El vendedor declara que recibió el pago. No verifica ninguna transferencia.
    function reportPayment(bytes32 orderId)
        external
        orderExists(orderId)
        onlySeller(orderId)
        inStatus(orderId, Status.ACCEPTED)
    {
        _changeStatus(orderId, Status.PAYMENT_REPORTED);
    }

    /// @notice El vendedor declara que entregó el producto.
    function confirmDelivery(bytes32 orderId)
        external
        orderExists(orderId)
        onlySeller(orderId)
        inStatus(orderId, Status.PAYMENT_REPORTED)
    {
        _changeStatus(orderId, Status.DELIVERED);
    }

    /// @notice El comprador confirma que recibió el producto. Solo entonces cuenta como completado.
    function completeOrder(bytes32 orderId)
        external
        orderExists(orderId)
        onlyBuyer(orderId)
        inStatus(orderId, Status.DELIVERED)
    {
        stats[orders[orderId].seller].completed++;
        _changeStatus(orderId, Status.COMPLETED);
    }

    function cancelOrder(bytes32 orderId)
        external
        orderExists(orderId)
        onlyBuyer(orderId)
        inStatus(orderId, Status.CREATED)
    {
        stats[orders[orderId].seller].cancelled++;
        _changeStatus(orderId, Status.CANCELLED);
    }

    function getProduct(uint256 productId)
        external
        view
        returns (
            address seller,
            string memory name,
            string memory description,
            string memory category,
            string memory pickupPoint,
            uint256 priceCents,
            bool available
        )
    {
        Product storage product = products[productId];
        if (product.seller == address(0)) revert ProductNotFound();
        return (
            product.seller,
            product.name,
            product.description,
            product.category,
            product.pickupPoint,
            product.priceCents,
            product.available
        );
    }

    function getOrder(bytes32 orderId)
        external
        view
        returns (
            uint256 productId,
            address buyer,
            address seller,
            uint256 quantity,
            uint256 totalCents,
            bytes32 orderHash,
            Status status,
            uint256 createdAt
        )
    {
        Order storage order = orders[orderId];
        return (
            order.productId,
            order.buyer,
            order.seller,
            order.quantity,
            order.totalCents,
            order.orderHash,
            order.status,
            order.createdAt
        );
    }

    function verifyOrderHash(bytes32 orderId, bytes32 hash)
        external
        view
        orderExists(orderId)
        returns (bool)
    {
        return orders[orderId].orderHash == hash;
    }

    function getHistory(bytes32 orderId) external view returns (HistoryEntry[] memory) {
        return histories[orderId];
    }

    function getBuyerOrders(address buyer) external view returns (bytes32[] memory) {
        return buyerOrders[buyer];
    }

    function getSellerOrders(address seller) external view returns (bytes32[] memory) {
        return sellerOrders[seller];
    }

    function getSellerStats(address seller)
        external
        view
        returns (uint256 accepted, uint256 completed, uint256 cancelled)
    {
        SellerStats storage s = stats[seller];
        return (s.accepted, s.completed, s.cancelled);
    }

    function _changeStatus(bytes32 orderId, Status newStatus) private {
        orders[orderId].status = newStatus;
        _record(orderId, newStatus);
        emit OrderStatusChanged(orderId, newStatus, msg.sender, block.timestamp);
    }

    function _record(bytes32 orderId, Status status) private {
        histories[orderId].push(
            HistoryEntry({status: status, changedBy: msg.sender, timestamp: block.timestamp})
        );
    }
}
