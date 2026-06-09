const express = require('express');
const app = express();
app.use(express.json());

// ========== ЕДИНАЯ БАЗА ДАННЫХ ==========
// Все версии работают с этими данными
let products = [
    { id: 1, name: "Ноутбук", price: 1000, inStock: true, created: "2024-01-01" },
    { id: 2, name: "Мышь", price: 20, inStock: true, created: "2024-01-02" },
    { id: 3, name: "Клавиатура", price: 50, inStock: false, created: "2024-01-03" }
];
let nextId = 4;

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function findProduct(id) {
    return products.find(p => p.id === id);
}

function findProductIndex(id) {
    return products.findIndex(p => p.id === id);
}

// ========== V01 - ПРОСТАЯ ВЕРСИЯ (минимальные поля) ==========
app.get('/v01/products/', (req, res) => {
    // Возвращаем только id, name, price
    const simplified = products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price
    }));
    res.json(simplified);
});

app.get('/v01/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const product = findProduct(id);
    if (product) {
        // v01 возвращает только базовые поля
        res.json({
            id: product.id,
            name: product.name,
            price: product.price
        });
    } else {
        res.status(404).json({ error: "Product not found" });
    }
});

app.post('/v01/products/', (req, res) => {
    const { name, price } = req.body;
    if (!name || !price) {
        return res.status(400).json({ error: "Missing name or price" });
    }
    const newProduct = { 
        id: nextId++, 
        name, 
        price, 
        inStock: true,
        created: new Date().toISOString()
    };
    products.push(newProduct);
    res.status(201).json({ 
        message: "Product created in v01", 
        product: { id: newProduct.id, name: newProduct.name, price: newProduct.price }
    });
});

app.put('/v01/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { name, price } = req.body;
    const index = findProductIndex(id);
    
    if (index === -1) {
        return res.status(404).json({ error: "Product not found" });
    }
    if (!name || !price) {
        return res.status(400).json({ error: "Missing name or price" });
    }
    
    products[index] = { ...products[index], name, price, updated: new Date().toISOString() };
    res.json({ 
        message: "Product updated in v01", 
        product: { id: products[index].id, name: products[index].name, price: products[index].price }
    });
});

app.patch('/v01/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const index = findProductIndex(id);
    
    if (index === -1) {
        return res.status(404).json({ error: "Product not found" });
    }
    
    products[index] = { ...products[index], ...updates, patched: new Date().toISOString() };
    res.json({ 
        message: "Product patched in v01", 
        product: { id: products[index].id, name: products[index].name, price: products[index].price }
    });
});

app.delete('/v01/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = findProductIndex(id);
    
    if (index === -1) {
        return res.status(404).json({ error: "Product not found" });
    }
    
    const deleted = products.splice(index, 1)[0];
    res.json({ message: "Product deleted", deletedProduct: { id: deleted.id, name: deleted.name } });
});

// ========== V02 - РАСШИРЕННАЯ ВЕРСИЯ (все поля) ==========
app.get('/v02/products/', (req, res) => {
    // v02 возвращает все поля
    res.json(products);
});

app.get('/v02/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const product = findProduct(id);
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ error: "Product not found" });
    }
});

app.post('/v02/products/', (req, res) => {
    const { name, price, inStock } = req.body;
    if (!name || !price) {
        return res.status(400).json({ error: "Missing name or price" });
    }
    const newProduct = { 
        id: nextId++, 
        name, 
        price, 
        inStock: inStock !== undefined ? inStock : true,
        created: new Date().toISOString()
    };
    products.push(newProduct);
    res.status(201).json({ message: "Product created in v02", product: newProduct });
});

app.put('/v02/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { name, price, inStock } = req.body;
    const index = findProductIndex(id);
    
    if (index === -1) {
        return res.status(404).json({ error: "Product not found" });
    }
    
    products[index] = { 
        ...products[index], 
        name: name || products[index].name,
        price: price || products[index].price,
        inStock: inStock !== undefined ? inStock : products[index].inStock,
        updated: new Date().toISOString()
    };
    res.json({ message: "Product updated in v02", product: products[index] });
});

app.delete('/v02/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = findProductIndex(id);
    
    if (index === -1) {
        return res.status(404).json({ error: "Product not found" });
    }
    
    const deleted = products.splice(index, 1)[0];
    res.json({ message: "Product deleted from v02", deletedProduct: deleted });
});

// ========== КОРНЕВОЙ МАРШРУТ ==========
app.get('/', (req, res) => {
    res.json({ 
        versions: ["v01", "v02"],
        description: "Обе версии работают с одной базой данных",
        endpoints: {
            v01: {
                GET: ["/v01/products/", "/v01/products/:id"],
                POST: "/v01/products/",
                PUT: "/v01/products/:id",
                PATCH: "/v01/products/:id",
                DELETE: "/v01/products/:id"
            },
            v02: {
                GET: ["/v02/products/", "/v02/products/:id"],
                POST: "/v02/products/",
                PUT: "/v02/products/:id",
                DELETE: "/v02/products/:id"
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
