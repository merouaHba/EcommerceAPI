
const groupItemsBySeller = (items) => {
    const itemsBySeller = new Map();
    items.forEach((item) => {
        const sellerId = item.product.seller
        //  check if this seller exist in the array
        if (!itemsBySeller.has(sellerId)) {
            // if not create a this seller group
            itemsBySeller.set(sellerId,[])
        }
        itemsBySeller.get(sellerId).push(item)
    })
    return itemsBySeller
}

module.exports = groupItemsBySeller